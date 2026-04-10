import { Peer } from 'peerjs'
import type { DataConnection, PeerJSOption } from 'peerjs'
import type { SyncTransportPeer } from './transport'

export interface SyncRtcConfig {
  host?: string
  port?: number
  path?: string
  secure?: boolean
  key?: string
  iceServers: RTCIceServer[]
}

export interface CreateWebRtcPeerOptions {
  peerId: string
  remotePeerId?: string
  config: SyncRtcConfig
  onStatus?: (status: string) => void
}

export interface WebRtcSyncTransportPeer extends SyncTransportPeer {
  connect(remotePeerId: string): void
  destroy(): void
}

function toPeerOptions(config: SyncRtcConfig): PeerJSOption {
  return {
    host: config.host,
    port: config.port,
    path: config.path,
    secure: config.secure,
    key: config.key,
    config: {
      iceServers: config.iceServers,
    },
    debug: 1,
  }
}

export function createWebRtcSyncPeer(options: CreateWebRtcPeerOptions): WebRtcSyncTransportPeer {
  const handlers = new Set<(message: string) => void>()
  let activeConnection: DataConnection | null = null

  const peer = new Peer(options.peerId, toPeerOptions(options.config))

  const bindConnection = (connection: DataConnection) => {
    activeConnection = connection
    options.onStatus?.(`Connexió oberta amb ${connection.peer}`)

    connection.on('data', (data) => {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      for (const handler of handlers) {
        handler(message)
      }
    })

    connection.on('close', () => {
      options.onStatus?.(`Connexió tancada amb ${connection.peer}`)
      if (activeConnection === connection) activeConnection = null
    })

    connection.on('error', (error) => {
      options.onStatus?.(`Error de connexió: ${error.message}`)
    })
  }

  peer.on('open', (id) => {
    options.onStatus?.(`Peer actiu: ${id}`)
    if (options.remotePeerId) {
      transport.connect(options.remotePeerId)
    }
  })

  peer.on('connection', (connection) => {
    options.onStatus?.(`Peer entrant: ${connection.peer}`)
    bindConnection(connection)
  })

  peer.on('error', (error) => {
    options.onStatus?.(`Error PeerJS: ${error.message}`)
  })

  const transport: WebRtcSyncTransportPeer = {
    id: options.peerId,
    send(message: string) {
      if (!activeConnection || !activeConnection.open) {
        options.onStatus?.('No hi ha cap peer connectat')
        return
      }
      activeConnection.send(message)
    },
    subscribe(handler: (message: string) => void) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    connect(remotePeerId: string) {
      options.onStatus?.(`Connectant amb ${remotePeerId}...`)
      const connection = peer.connect(remotePeerId, { reliable: true, serialization: 'json' })
      connection.on('open', () => bindConnection(connection))
    },
    destroy() {
      activeConnection?.close()
      peer.destroy()
    },
  }

  return transport
}
