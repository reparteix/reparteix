/**
 * Sync session orchestrator — production-ready service that wires together
 * peer-manager, crypto, protocol and SDK merge logic into a complete
 * peer-to-peer sync workflow.
 *
 * This is the main entry point for sync operations. It handles:
 * - Creating/joining sync sessions with passphrase-based encryption
 * - Full protocol handshake (hello → request-sync → sync-data → ack)
 * - Bidirectional sync: both peers exchange data
 * - Connection lifecycle and error handling
 */

import { createPeerManager, createSyncConfig, type SyncConfigOverrides } from './index'
import type { PeerConnection, ConnectionState } from './peer-manager'
import {
  createHelloMessage,
  createRequestSyncMessage,
  createSyncDataMessage,
  createSyncDataChunkMessage,
  createSyncAckMessage,
  createErrorMessage,
  MAX_SYNC_DATA_CHUNKS,
  MAX_SYNC_DATA_CHUNK_LENGTH,
  SYNC_PROTOCOL_VERSION,
  type SyncMessage,
} from './protocol'
import { encryptSyncPayload, decryptSyncPayload } from '../../domain/services/crypto'
import type { EncryptedPayload } from '../../domain/services/crypto'
import { SyncEnvelopeV1Schema } from '../../domain/entities'
import type { SyncEnvelopeV1 } from '../../domain/entities'
import type { SyncReport } from '../../domain/services/sync'
import { reparteix } from '../../sdk'

// ─── Types ──────────────────────────────────────────────────────────────────

export type SyncSessionState =
  | 'idle'
  | 'initializing'
  | 'waiting-for-peer'
  | 'connecting'
  | 'syncing'
  | 'completed'
  | 'error'

export interface SyncSessionStatus {
  state: SyncSessionState
  peerId: string | null
  remotePeerId: string | null
  remotePeerIds: string[]
  groupId: string
  passphrase: string
  error: string | null
  report: SyncReport | null
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  /** Human-readable progress message */
  message: string
}

export type SyncSessionListener = (status: SyncSessionStatus) => void

// ─── Session ────────────────────────────────────────────────────────────────

export function createSyncSession(
  groupId: string,
  passphrase: string,
  configOverrides?: SyncConfigOverrides,
) {
  const listeners = new Set<SyncSessionListener>()

  let status: SyncSessionStatus = {
    state: 'idle',
    peerId: null,
    remotePeerId: null,
    remotePeerIds: [],
    groupId,
    passphrase,
    error: null,
    report: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    message: 'Inicialitzant…',
  }

  function update(patch: Partial<SyncSessionStatus>) {
    status = { ...status, ...patch }
    for (const listener of listeners) {
      listener(status)
    }
  }

  function addRemotePeer(remotePeerId: string) {
    const remotePeerIds = status.remotePeerIds.includes(remotePeerId)
      ? status.remotePeerIds
      : [...status.remotePeerIds, remotePeerId]
    update({ remotePeerId, remotePeerIds })
  }

  function removeRemotePeer(remotePeerId: string) {
    const remotePeerIds = status.remotePeerIds.filter((id) => id !== remotePeerId)
    update({
      remotePeerIds,
      remotePeerId: remotePeerIds.at(-1) ?? null,
    })
  }

  // Build a group-specific peer ID prefix for discovery using SHA-256
  async function buildGroupPeerId(): Promise<string> {
    const raw = `reparteix-${groupId}-${passphrase}`
    const encoded = new TextEncoder().encode(raw)
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded)
    const hashArray = new Uint8Array(hashBuffer)
    // Take first 8 bytes and convert to hex for a compact, collision-resistant room ID
    let hex = ''
    for (let i = 0; i < 8; i++) {
      hex += hashArray[i].toString(16).padStart(2, '0')
    }
    return `reparteix-${hex}`
  }

  const config = createSyncConfig(configOverrides)
  // Conservative per-message payload size. The practical JSON channel limit is
  // lower than the raw PeerJS transport limit once protocol/message overhead is
  // included, so keep chunks comfortably small.
  const MAX_SYNC_CHUNK_SIZE = MAX_SYNC_DATA_CHUNK_LENGTH
  const MAX_INCOMING_TRANSFER_AGE_MS = 60_000
  let outgoingTransferInFlight = false
  let incomingTransferInFlight = false
  let hadLocalGroupAtSessionStart: boolean | null = null
  const peerSyncState = new Map<string, {
    localDataSent: boolean
    localDataApplied: boolean
    remoteAppliedLocalData: boolean
    remoteHadNoData: boolean
  }>()
  const incomingPayloadChunks = new Map<string, {
    remotePeerId: string
    groupId: string
    total: number
    chunks: string[]
    createdAt: number
  }>()

  function buildTransferId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
    return `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  function getEncodedMessageLength(message: SyncMessage): number {
    return JSON.stringify(message).length
  }

  function cleanupExpiredIncomingTransfers() {
    const now = Date.now()
    for (const [key, transfer] of incomingPayloadChunks.entries()) {
      if (now - transfer.createdAt > MAX_INCOMING_TRANSFER_AGE_MS) {
        incomingPayloadChunks.delete(key)
      }
    }
  }

  function getPeerSyncState(remotePeerId: string) {
    const existing = peerSyncState.get(remotePeerId)
    if (existing) return existing

    const created = {
      localDataSent: false,
      localDataApplied: false,
      remoteAppliedLocalData: false,
      remoteHadNoData: false,
    }
    peerSyncState.set(remotePeerId, created)
    return created
  }

  async function sendEncryptedPayload(conn: PeerConnection, targetGroupId: string, payload: EncryptedPayload) {
    const syncDataMessage = createSyncDataMessage(targetGroupId, payload)

    if (getEncodedMessageLength(syncDataMessage) <= MAX_SYNC_CHUNK_SIZE) {
      update({ message: 'Enviant dades…' })
      conn.send(syncDataMessage)
      update({ message: 'Dades enviades. Esperant aplicació…' })
      return
    }

    const serializedPayload = JSON.stringify(payload)
    const transferId = buildTransferId()
    const chunks: string[] = []
    let cursor = 0

    while (cursor < serializedPayload.length) {
      const index = chunks.length
      const remainingLength = serializedPayload.length - cursor
      let low = 1
      let high = remainingLength
      let bestLength = 0

      while (low <= high) {
        const middle = Math.floor((low + high) / 2)
        const candidateChunk = serializedPayload.slice(cursor, cursor + middle)
        const candidateMessage = createSyncDataChunkMessage(targetGroupId, transferId, index, 1, candidateChunk)

        if (getEncodedMessageLength(candidateMessage) <= MAX_SYNC_CHUNK_SIZE) {
          bestLength = middle
          low = middle + 1
        } else {
          high = middle - 1
        }
      }

      if (bestLength === 0) {
        throw new Error('No s\'ha pogut fragmentar el missatge dins del límit del canal')
      }

      chunks.push(serializedPayload.slice(cursor, cursor + bestLength))
      cursor += bestLength
    }

    if (chunks.length > MAX_SYNC_DATA_CHUNKS) {
      throw new Error('El grup és massa gran per sincronitzar-lo amb aquest canal actual')
    }

    const total = chunks.length
    outgoingTransferInFlight = true
    for (const [index, chunk] of chunks.entries()) {
      update({ message: `Enviant dades grans… (${index + 1}/${total})` })
      conn.send(createSyncDataChunkMessage(targetGroupId, transferId, index, total, chunk))
    }
    outgoingTransferInFlight = false
    update({ message: 'Dades enviades. Esperant aplicació…' })
  }

  async function handleSyncDataChunk(
    remotePeerId: string,
    receivedGroupId: string,
    transferId: string,
    index: number,
    total: number,
    chunk: string,
  ) {
    const conn = peerManager.connections.get(remotePeerId)

    if (receivedGroupId !== groupId) {
      conn?.send(createSyncAckMessage(receivedGroupId, 'error', 'Grup no correspon'))
      return
    }

    if (total > MAX_SYNC_DATA_CHUNKS || chunk.length > MAX_SYNC_DATA_CHUNK_LENGTH || index < 0 || index >= total) {
      conn?.send(createSyncAckMessage(receivedGroupId, 'error', 'Fragments de sync invàlids'))
      return
    }

    cleanupExpiredIncomingTransfers()

    const transferKey = `${remotePeerId}:${transferId}`
    const existing = incomingPayloadChunks.get(transferKey)
    const transfer = existing ?? {
      remotePeerId,
      groupId: receivedGroupId,
      total,
      chunks: Array.from({ length: total }, () => ''),
      createdAt: Date.now(),
    }

    if (transfer.total !== total || transfer.remotePeerId !== remotePeerId || transfer.groupId !== receivedGroupId) {
      incomingPayloadChunks.delete(transferKey)
      conn?.send(createSyncAckMessage(receivedGroupId, 'error', 'Transferència fragmentada inconsistent'))
      return
    }

    transfer.chunks[index] = chunk
    incomingPayloadChunks.set(transferKey, transfer)
    incomingTransferInFlight = true

    const receivedCount = transfer.chunks.filter((value) => value.length > 0).length
    const isComplete = receivedCount === total
    if (!isComplete) {
      update({ message: `Rebent dades grans… (${receivedCount}/${total})` })
      return
    }

    incomingPayloadChunks.delete(transferKey)
    incomingTransferInFlight = false

    let payload: EncryptedPayload
    try {
      payload = JSON.parse(transfer.chunks.join('')) as EncryptedPayload
    } catch {
      throw new Error('No s\'han pogut reconstruir les dades rebudes')
    }

    await handleSyncData(remotePeerId, receivedGroupId, payload)
  }

  /** Translate common PeerJS errors to user-friendly Catalan messages. */
  function friendlyError(err: Error): string {
    const msg = err.message
    if (msg.includes('Could not connect to peer') || msg.includes('peer-unavailable')) {
      return 'L\'altre dispositiu no està disponible. Assegura\'t que té la sessió de sync oberta.'
    }
    if (msg.includes('is taken') || msg.includes('unavailable-id')) {
      return 'Ja hi ha una sessió activa amb aquesta contrasenya. Tanca-la i torna-ho a provar.'
    }
    if (msg.includes('Lost connection to server') || msg.includes('disconnected')) {
      return 'S\'ha perdut la connexió amb el servidor de senyalització.'
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'La connexió ha trigat massa. Comprova la xarxa i torna-ho a provar.'
    }
    return msg
  }

  const peerManager = createPeerManager({
    config,
    events: {
      onMessage: handleMessage,
      onPeerConnected: handlePeerConnected,
      onPeerDisconnected: handlePeerDisconnected,
      onError: (err) => {
        const friendly = friendlyError(err)
        update({ state: 'error', error: friendly, message: `Error: ${friendly}` })
      },
      onStateChange: handleStateChange,
    },
  })

  // ─── Protocol handling ──────────────────────────────────────────────

  async function handleMessage(remotePeerId: string, message: SyncMessage) {
    try {
      switch (message.type) {
        case 'hello':
          await handleHello(remotePeerId, message)
          break
        case 'request-sync':
          await handleRequestSync(remotePeerId, message.groupId)
          break
        case 'sync-data':
          await handleSyncData(remotePeerId, message.groupId, message.payload)
          break
        case 'sync-data-chunk':
          await handleSyncDataChunk(
            remotePeerId,
            message.groupId,
            message.transferId,
            message.index,
            message.total,
            message.chunk,
          )
          break
        case 'sync-ack':
          handleSyncAck(message)
          break
        case 'error':
          update({ state: 'error', error: message.message, message: `Error del peer: ${message.message}` })
          break
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconegut'
      update({ state: 'error', error: errorMsg, message: `Error processant missatge: ${errorMsg}` })
    }
  }

  async function handleHello(remotePeerId: string, message: SyncMessage & { type: 'hello' }) {
    if (message.protocolVersion !== SYNC_PROTOCOL_VERSION) {
      const conn = peerManager.connections.get(remotePeerId)
      conn?.send(createErrorMessage('PROTOCOL_MISMATCH', `Versió del protocol incompatible: ${message.protocolVersion}`))
      return
    }

    addRemotePeer(remotePeerId)
    update({
      state: 'syncing',
      message: 'Connectat. Sincronitzant dades…',
    })

    // Request sync for our group
    const conn = peerManager.connections.get(remotePeerId)
    if (conn) {
      conn.send(createRequestSyncMessage(groupId))
    }
  }

  async function handleRequestSync(remotePeerId: string, requestedGroupId: string) {
    const conn = peerManager.connections.get(remotePeerId)
    if (!conn) return

    if (requestedGroupId !== groupId) {
      conn.send(createSyncAckMessage(requestedGroupId, 'error', 'Grup no disponible'))
      return
    }

    update({ message: 'Preparant dades per enviar…' })

    try {
      if (hadLocalGroupAtSessionStart === false) {
        conn.send(createSyncAckMessage(groupId, 'no-data'))
        return
      }

      // Build envelope from local data
      const envelope = await buildEnvelope()
      if (!envelope) {
        conn.send(createSyncAckMessage(groupId, 'no-data'))
        return
      }

      // Encrypt and send
      const json = JSON.stringify(envelope)
      const encrypted = await encryptSyncPayload(passphrase, json)
      await sendEncryptedPayload(conn, groupId, encrypted)
      getPeerSyncState(remotePeerId).localDataSent = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error preparant dades'
      conn.send(createSyncAckMessage(groupId, 'error', msg))
    }
  }

  async function handleSyncData(remotePeerId: string, receivedGroupId: string, payload: EncryptedPayload) {
    const conn = peerManager.connections.get(remotePeerId)

    if (receivedGroupId !== groupId) {
      conn?.send(createSyncAckMessage(receivedGroupId, 'error', 'Grup no correspon'))
      return
    }

    update({ message: 'Desxifrant i aplicant dades…' })

    try {
      // Decrypt
      const json = await decryptSyncPayload(passphrase, payload)
      const raw: unknown = JSON.parse(json)

      // Validate
      SyncEnvelopeV1Schema.parse(raw)

      // Apply merge via SDK
      const report = await reparteix.sync.applyGroupJson(raw)

      conn?.send(createSyncAckMessage(groupId, 'ok'))
      getPeerSyncState(remotePeerId).localDataApplied = true

      update({
        state: 'completed',
        report,
        lastSuccessAt: new Date().toISOString(),
        message: buildReportSummary(report),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error aplicant dades'

      // If decryption fails, it's likely a wrong passphrase
      const isDecryptError = msg.includes('decrypt') || msg.includes('operation')
      const userMsg = isDecryptError
        ? 'Contrasenya incorrecta o dades corruptes'
        : msg

      conn?.send(createSyncAckMessage(groupId, 'error', userMsg))
      update({ state: 'error', error: userMsg, message: `Error: ${userMsg}` })
    }
  }

  function handleSyncAck(message: SyncMessage & { type: 'sync-ack' }) {
    const remotePeerId = status.remotePeerId
    const syncState = remotePeerId ? getPeerSyncState(remotePeerId) : null

    if (message.status === 'ok') {
      if (status.state === 'syncing') {
        if (syncState) {
          syncState.remoteAppliedLocalData = true
        }

        if (syncState?.localDataApplied || syncState?.remoteHadNoData) {
          update({
            state: 'completed',
            lastSuccessAt: new Date().toISOString(),
            message: syncState?.localDataApplied
              ? 'Sincronització completada. Els dos dispositius ja estan al dia.'
              : 'Sincronització completada. L’altre dispositiu ha aplicat les dades i no tenia canvis addicionals per enviar.',
          })
          return
        }

        update({
          message: 'L’altre dispositiu ha rebut i aplicat les dades correctament. Esperant dades remotes…',
        })
      }
    } else if (message.status === 'no-data') {
      if (status.state === 'syncing') {
        if (syncState) {
          syncState.remoteHadNoData = true
        }

        if (syncState?.localDataApplied || syncState?.localDataSent || syncState?.remoteAppliedLocalData) {
          update({
            state: 'completed',
            lastSuccessAt: new Date().toISOString(),
            message: 'Sincronització completada. L’altre dispositiu no tenia canvis addicionals per enviar.',
          })
        } else {
          update({ message: 'El peer no té dades per aquest grup.' })
        }
      }
    } else if (message.status === 'error') {
      update({
        state: 'error',
        error: message.message ?? 'Error desconegut del peer',
        message: `Error del peer: ${message.message ?? 'Error desconegut'}`,
      })
    }
  }

  function handlePeerConnected(conn: PeerConnection) {
    addRemotePeer(conn.peerId)
    update({
      state: 'syncing',
      message: 'Peer connectat. Intercanviant dades…',
    })

    // Send hello
    conn.send(createHelloMessage(peerManager.peerId!, [groupId]))
  }

  function handlePeerDisconnected(remotePeerId: string) {
    const syncState = peerSyncState.get(remotePeerId)
    peerSyncState.delete(remotePeerId)
    removeRemotePeer(remotePeerId)
    for (const [key, transfer] of incomingPayloadChunks.entries()) {
      if (transfer.remotePeerId === remotePeerId) {
        incomingPayloadChunks.delete(key)
      }
    }
    if (status.state !== 'completed' && status.state !== 'error') {
      const wasTransferring = outgoingTransferInFlight || incomingTransferInFlight
      outgoingTransferInFlight = false
      incomingTransferInFlight = false

      const canTreatAsCompleted = !wasTransferring && (
        syncState?.localDataApplied ||
        syncState?.remoteAppliedLocalData
      )

      if (canTreatAsCompleted) {
        update({
          state: 'completed',
          lastSuccessAt: new Date().toISOString(),
          message: syncState?.localDataApplied
            ? 'Sincronització completada. L’altre dispositiu ha tancat la sessió després d’aplicar els canvis.'
            : 'Sincronització completada. L’altre dispositiu ha rebut i aplicat les dades abans de tancar la sessió.',
        })
        return
      }

      update({
        state: 'error',
        error: wasTransferring
          ? 'La connexió de sync s\'ha interromput durant la transferència'
          : 'La connexió amb l\'altre dispositiu s\'ha tancat',
        message: wasTransferring
          ? 'La connexió de sync s\'ha interromput mentre s\'enviaven o rebien dades. Caldrà tornar-ho a provar.'
          : 'La connexió amb l\'altre dispositiu s\'ha tancat abans de completar la sincronització.',
      })
    }
  }

  function handleStateChange(connState: ConnectionState) {
    if (connState === 'error') {
      update({ state: 'error', error: 'Error de connexió', message: 'Error connectant amb el servidor de senyalització.' })
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  async function loadLocalGroupExists(): Promise<boolean> {
    try {
      return (await reparteix.getGroup(groupId)) !== null
    } catch {
      return false
    }
  }

  async function buildEnvelope(): Promise<SyncEnvelopeV1 | null> {
    try {
      const group = await reparteix.getGroup(groupId)
      if (!group) return null

      const expenses = await reparteix.listExpenses(groupId)
      const payments = await reparteix.listPayments(groupId)

      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        group,
        expenses,
        payments,
      }
    } catch {
      return null
    }
  }

  function buildReportSummary(report: SyncReport): string {
    const parts: string[] = []

    const totalCreated = report.created.groups + report.created.expenses + report.created.payments + report.created.members
    const totalUpdated = report.updated.groups + report.updated.expenses + report.updated.payments + report.updated.members
    const totalConflicts = report.conflicts.length

    if (totalCreated > 0) parts.push(`${totalCreated} element${totalCreated > 1 ? 's' : ''} creat${totalCreated > 1 ? 's' : ''}`)
    if (totalUpdated > 0) parts.push(`${totalUpdated} actualitzat${totalUpdated > 1 ? 's' : ''}`)
    if (totalConflicts > 0) parts.push(`${totalConflicts} conflicte${totalConflicts > 1 ? 's' : ''}`)

    if (parts.length === 0) return 'Sincronització completada. Les dades ja estaven al dia.'
    return `Sincronització completada: ${parts.join(', ')}.`
  }

  // ─── Public API ───────────────────────────────────────────────────────

  return {
    get status() {
      return status
    },

    subscribe(listener: SyncSessionListener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    /** Start as host: initialise peer and wait for a remote peer to connect. */
    async startAsHost(): Promise<string> {
      update({
        state: 'initializing',
        lastAttemptAt: new Date().toISOString(),
        error: null,
        message: 'Connectant al servidor de senyalització…',
      })

      try {
        hadLocalGroupAtSessionStart = await loadLocalGroupExists()
        const roomPeerId = await buildGroupPeerId()
        const peerId = await peerManager.init(roomPeerId)
        update({
          state: 'waiting-for-peer',
          peerId,
          message: 'Esperant que l\'altre dispositiu es connecti…',
        })
        return peerId
      } catch (err) {
        const msg = err instanceof Error ? friendlyError(err) : 'Error inicialitzant'
        update({ state: 'error', error: msg, message: `Error: ${msg}` })
        throw err
      }
    },

    /** Start as guest: connect to the host peer and begin sync. */
    async joinSession(): Promise<void> {
      update({
        state: 'initializing',
        lastAttemptAt: new Date().toISOString(),
        error: null,
        message: 'Connectant al servidor de senyalització…',
      })

      try {
        hadLocalGroupAtSessionStart = await loadLocalGroupExists()
        await peerManager.init()
        update({
          state: 'connecting',
          peerId: peerManager.peerId,
          message: 'Connectant amb el peer…',
        })

        const roomPeerId = await buildGroupPeerId()
        await peerManager.connectTo(roomPeerId)
        // The rest is handled by onPeerConnected → handlePeerConnected
      } catch (err) {
        const msg = err instanceof Error ? friendlyError(err) : 'Error connectant'
        update({ state: 'error', error: msg, message: `Error: ${msg}` })
        throw err
      }
    },

    /**
     * Sync v2 entry point: try to create the room first, otherwise join the existing one.
     */
    async startSync(): Promise<void> {
      const roomPeerId = await buildGroupPeerId()
      update({
        state: 'initializing',
        lastAttemptAt: new Date().toISOString(),
        error: null,
        message: 'Preparant sincronització…',
      })

      try {
        hadLocalGroupAtSessionStart = await loadLocalGroupExists()
        const peerId = await peerManager.init(roomPeerId)
        update({
          state: 'waiting-for-peer',
          peerId,
          message: 'Sessió creada. Esperant que es connecti un altre dispositiu…',
        })
        return
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error inicialitzant'
        if (!msg.includes('is taken') && !msg.includes('unavailable-id')) {
          const friendly = err instanceof Error ? friendlyError(err) : 'Error inicialitzant'
          update({ state: 'error', error: friendly, message: `Error: ${friendly}` })
          throw err
        }
      }

      try {
        hadLocalGroupAtSessionStart = await loadLocalGroupExists()
        await peerManager.init()
        update({
          state: 'connecting',
          peerId: peerManager.peerId,
          message: 'Sessió existent detectada. Connectant per sincronitzar…',
        })
        await peerManager.connectTo(roomPeerId)
      } catch (err) {
        const msg = err instanceof Error ? friendlyError(err) : 'Error connectant'
        update({ state: 'error', error: msg, message: `Error: ${msg}` })
        throw err
      }
    },

    /** Clean up all resources. */
    destroy() {
      hadLocalGroupAtSessionStart = null
      peerSyncState.clear()
      peerManager.destroy()
      listeners.clear()
    },
  }
}
