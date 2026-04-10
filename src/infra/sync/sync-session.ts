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
  createSyncAckMessage,
  createErrorMessage,
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
  groupId: string
  passphrase: string
  error: string | null
  report: SyncReport | null
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
    groupId,
    passphrase,
    error: null,
    report: null,
    message: 'Inicialitzant…',
  }

  function update(patch: Partial<SyncSessionStatus>) {
    status = { ...status, ...patch }
    for (const listener of listeners) {
      listener(status)
    }
  }

  // Build a group-specific peer ID prefix for discovery
  function buildGroupPeerId(): string {
    // Hash group ID + passphrase to create a deterministic but private room ID
    const raw = `reparteix-${groupId}-${passphrase}`
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
    }
    const roomHash = Math.abs(hash).toString(36)
    return `reparteix-${roomHash}`
  }

  const config = createSyncConfig(configOverrides)

  const peerManager = createPeerManager({
    config,
    events: {
      onMessage: handleMessage,
      onPeerConnected: handlePeerConnected,
      onPeerDisconnected: handlePeerDisconnected,
      onError: (err) => update({ state: 'error', error: err.message, message: `Error: ${err.message}` }),
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

    update({
      remotePeerId,
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
      // Build envelope from local data
      const envelope = await buildEnvelope()
      if (!envelope) {
        conn.send(createSyncAckMessage(groupId, 'no-data'))
        return
      }

      // Encrypt and send
      const json = JSON.stringify(envelope)
      const encrypted = await encryptSyncPayload(passphrase, json)
      conn.send(createSyncDataMessage(groupId, encrypted))
      update({ message: 'Dades enviades. Esperant resposta…' })
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

      update({
        state: 'completed',
        report,
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
    if (message.status === 'ok') {
      // If we haven't received data yet, the peer has applied our data
      if (status.state === 'syncing') {
        update({
          message: 'El peer ha rebut les dades correctament. Esperant dades del peer…',
        })
      }
    } else if (message.status === 'no-data') {
      update({ message: 'El peer no té dades per aquest grup.' })
    } else if (message.status === 'error') {
      update({
        state: 'error',
        error: message.message ?? 'Error desconegut del peer',
        message: `Error del peer: ${message.message ?? 'Error desconegut'}`,
      })
    }
  }

  function handlePeerConnected(conn: PeerConnection) {
    update({
      remotePeerId: conn.peerId,
      state: 'syncing',
      message: 'Peer connectat. Intercanviant dades…',
    })

    // Send hello
    conn.send(createHelloMessage(peerManager.peerId!, [groupId]))
  }

  function handlePeerDisconnected() {
    if (status.state !== 'completed' && status.state !== 'error') {
      update({
        remotePeerId: null,
        state: 'error',
        error: 'Peer desconnectat',
        message: 'El peer s\'ha desconnectat abans de completar la sincronització.',
      })
    }
  }

  function handleStateChange(connState: ConnectionState) {
    if (connState === 'error') {
      update({ state: 'error', error: 'Error de connexió', message: 'Error connectant amb el servidor de senyalització.' })
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

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
      update({ state: 'initializing', message: 'Connectant al servidor de senyalització…' })

      try {
        const roomPeerId = buildGroupPeerId()
        const peerId = await peerManager.init(roomPeerId)
        update({
          state: 'waiting-for-peer',
          peerId,
          message: 'Esperant que l\'altre dispositiu es connecti…',
        })
        return peerId
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error inicialitzant'
        update({ state: 'error', error: msg, message: `Error: ${msg}` })
        throw err
      }
    },

    /** Start as guest: connect to the host peer and begin sync. */
    async joinSession(): Promise<void> {
      update({ state: 'initializing', message: 'Connectant al servidor de senyalització…' })

      try {
        await peerManager.init()
        update({
          state: 'connecting',
          peerId: peerManager.peerId,
          message: 'Connectant amb el peer…',
        })

        const roomPeerId = buildGroupPeerId()
        await peerManager.connectTo(roomPeerId)
        // The rest is handled by onPeerConnected → handlePeerConnected
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error connectant'
        update({ state: 'error', error: msg, message: `Error: ${msg}` })
        throw err
      }
    },

    /** Clean up all resources. */
    destroy() {
      peerManager.destroy()
      listeners.clear()
    },
  }
}
