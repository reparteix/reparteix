/**
 * PeerJS-based WebRTC peer connection manager.
 *
 * This module abstracts PeerJS to provide a clean interface for:
 * - Creating and managing a local peer identity
 * - Connecting to remote peers
 * - Sending/receiving typed sync protocol messages
 * - Handling connection lifecycle events
 *
 * NOTE: This module requires the `peerjs` library and browser WebRTC APIs.
 * It is designed for browser environments only and is not testable in Node.js.
 */

import type { SyncConfig } from './config'
import type { SyncMessage } from './protocol'
import { encodeMessage, decodeMessage } from './protocol'

// ─── Minimal PeerJS type interfaces ─────────────────────────────────────────

/** Minimal interface for PeerJS DataConnection. */
interface PeerDataConnection {
  readonly peer: string
  readonly open: boolean
  send(data: string): void
  close(): void
  on(event: 'open', callback: () => void): void
  on(event: 'data', callback: (data: unknown) => void): void
  on(event: 'close', callback: () => void): void
  on(event: 'error', callback: (err: Error) => void): void
}

/** Minimal interface for PeerJS Peer. */
interface PeerInstance {
  connect(id: string, options?: { reliable?: boolean; serialization?: string }): PeerDataConnection
  on(event: 'open', callback: (id: string) => void): void
  on(event: 'connection', callback: (conn: PeerDataConnection) => void): void
  on(event: 'error', callback: (err: Error) => void): void
  on(event: 'disconnected', callback: () => void): void
  destroy(): void
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface PeerConnection {
  peerId: string
  state: ConnectionState
  send: (message: SyncMessage) => void
  close: () => void
}

export type MessageHandler = (peerId: string, message: SyncMessage) => void
export type ConnectionHandler = (connection: PeerConnection) => void
export type ErrorHandler = (error: Error) => void
export type StateChangeHandler = (state: ConnectionState) => void

export interface PeerManagerEvents {
  onMessage?: MessageHandler
  onPeerConnected?: ConnectionHandler
  onPeerDisconnected?: (peerId: string) => void
  onError?: ErrorHandler
  onStateChange?: StateChangeHandler
}

export interface PeerManagerOptions {
  config: SyncConfig
  events: PeerManagerEvents
}

// ─── PeerManager ────────────────────────────────────────────────────────────

/**
 * Manages WebRTC peer connections via PeerJS.
 *
 * Usage:
 * ```ts
 * const manager = createPeerManager({
 *   config: createSyncConfig(),
 *   events: {
 *     onMessage: (peerId, msg) => console.log(peerId, msg),
 *     onPeerConnected: (conn) => console.log('connected', conn.peerId),
 *   },
 * })
 *
 * await manager.init()
 * const conn = await manager.connectTo('remote-peer-id')
 * conn.send(createHelloMessage(manager.peerId!, ['group-1']))
 * ```
 */
export function createPeerManager(options: PeerManagerOptions) {
  const { config, events } = options
  const connections = new Map<string, PeerConnection>()

  // PeerJS Peer instance — lazily initialised in init()
  let peer: PeerInstance | null = null
  let localPeerId: string | null = null
  let state: ConnectionState = 'disconnected'

  function setState(newState: ConnectionState) {
    state = newState
    events.onStateChange?.(newState)
  }

  function wrapConnection(dataConn: PeerDataConnection, remotePeerId: string): PeerConnection {
    const connection: PeerConnection = {
      peerId: remotePeerId,
      state: 'connecting',
      send: (message: SyncMessage) => {
        if (dataConn.open) {
          dataConn.send(encodeMessage(message))
        }
      },
      close: () => {
        dataConn.close()
        connections.delete(remotePeerId)
      },
    }

    dataConn.on('open', () => {
      connection.state = 'connected'
      connections.set(remotePeerId, connection)
      events.onPeerConnected?.(connection)
    })

    dataConn.on('data', (raw: unknown) => {
      if (typeof raw !== 'string') return
      const message = decodeMessage(raw)
      if (message) {
        events.onMessage?.(remotePeerId, message)
      }
    })

    dataConn.on('close', () => {
      connection.state = 'disconnected'
      connections.delete(remotePeerId)
      events.onPeerDisconnected?.(remotePeerId)
    })

    dataConn.on('error', (err: Error) => {
      connection.state = 'error'
      events.onError?.(err)
    })

    return connection
  }

  return {
    /** The local peer ID assigned by the PeerJS server. Available after init(). */
    get peerId(): string | null {
      return localPeerId
    },

    /** Current connection state of the local peer. */
    get state(): ConnectionState {
      return state
    },

    /** All active peer connections. */
    get connections(): ReadonlyMap<string, PeerConnection> {
      return connections
    },

    /**
     * Initialise the PeerJS peer and register with the signaling server.
     * Resolves with the assigned peer ID.
     */
    async init(customPeerId?: string): Promise<string> {
      setState('connecting')

      // Dynamic import — PeerJS is a browser-only dependency
      const { Peer } = await import('peerjs')

      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PeerJS connection timeout'))
        }, config.connectionTimeoutMs)

        peer = new Peer(customPeerId ?? '', {
          host: config.peerJs.host,
          port: config.peerJs.port,
          path: config.peerJs.path,
          secure: config.peerJs.secure,
          config: {
            iceServers: config.iceServers,
          },
        }) as unknown as PeerInstance

        peer.on('open', (id: string) => {
          clearTimeout(timeout)
          localPeerId = id
          setState('connected')
          resolve(id)
        })

        peer.on('connection', (dataConn: PeerDataConnection) => {
          wrapConnection(dataConn, dataConn.peer)
        })

        peer.on('error', (err: Error) => {
          clearTimeout(timeout)
          setState('error')
          events.onError?.(err)
          reject(err)
        })

        peer.on('disconnected', () => {
          setState('disconnected')
        })
      })
    },

    /** Connect to a remote peer by their peer ID. */
    async connectTo(remotePeerId: string): Promise<PeerConnection> {
      if (!peer) throw new Error('PeerManager not initialised. Call init() first.')

      const existing = connections.get(remotePeerId)
      if (existing?.state === 'connected') return existing

      const dataConn = peer.connect(remotePeerId, {
        reliable: true,
        serialization: 'none',
      })

      const connection = wrapConnection(dataConn, remotePeerId)

      return new Promise<PeerConnection>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection to peer ${remotePeerId} timed out`))
        }, config.connectionTimeoutMs)

        dataConn.on('open', () => {
          clearTimeout(timeout)
          resolve(connection)
        })

        dataConn.on('error', (err: Error) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    },

    /** Disconnect from all peers and destroy the local peer. */
    destroy() {
      for (const conn of connections.values()) {
        conn.close()
      }
      connections.clear()
      peer?.destroy()
      peer = null
      localPeerId = null
      setState('disconnected')
    },
  }
}
