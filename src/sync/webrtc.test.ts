import { beforeEach, describe, expect, it, vi } from 'vitest'

const { MockConnection, MockPeer, peerInstances } = vi.hoisted(() => {
  const peerInstances: any[] = []

  class MockConnection {
    peer: string
    open = false
    sent: string[] = []
    handlers: Record<string, Array<(value: any) => void>> = {}

    constructor(peer: string) {
      this.peer = peer
    }

    on(event: string, handler: (value: any) => void) {
      this.handlers[event] ??= []
      this.handlers[event].push(handler)
      return this
    }

    send(message: string) {
      this.sent.push(message)
    }

    close() {
      this.emit('close', undefined)
    }

    emit(event: string, value: any) {
      for (const handler of this.handlers[event] ?? []) {
        handler(value)
      }
    }
  }

  class MockPeer {
    id: string
    options: unknown
    handlers: Record<string, Array<(value: any) => void>> = {}
    connectCalls: Array<{ remotePeerId: string; options: unknown; connection: InstanceType<typeof MockConnection> }> = []
    destroyed = false

    constructor(id: string, options: unknown) {
      this.id = id
      this.options = options
      peerInstances.push(this)
    }

    on(event: string, handler: (value: any) => void) {
      this.handlers[event] ??= []
      this.handlers[event].push(handler)
      return this
    }

    connect(remotePeerId: string, options: unknown) {
      const connection = new MockConnection(remotePeerId)
      this.connectCalls.push({ remotePeerId, options, connection })
      return connection
    }

    destroy() {
      this.destroyed = true
    }

    emit(event: string, value: any) {
      for (const handler of this.handlers[event] ?? []) {
        handler(value)
      }
    }
  }

  return { MockConnection, MockPeer, peerInstances }
})

vi.mock('peerjs', () => ({
  Peer: MockPeer,
}))

import { createWebRtcSyncPeer } from './webrtc'

describe('webrtc sync peer', () => {
  beforeEach(() => {
    peerInstances.length = 0
  })

  it('connects to a remote peer on open, forwards messages, and reports status', () => {
    const status: string[] = []
    const transport = createWebRtcSyncPeer({
      peerId: 'local-peer',
      remotePeerId: 'remote-peer',
      config: {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        key: 'peerjs',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
      onStatus: (message) => status.push(message),
    })

    const received: string[] = []
    const unsubscribe = transport.subscribe((message) => received.push(message))
    const peer = peerInstances[0]

    expect(transport.id).toBe('local-peer')
    expect(peer.options).toEqual({
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      key: 'peerjs',
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
      debug: 1,
    })

    peer.emit('open', 'local-peer')

    expect(status).toContain('Peer actiu: local-peer')
    expect(status).toContain('Connectant amb remote-peer...')
    expect(peer.connectCalls).toHaveLength(1)

    const connection = peer.connectCalls[0].connection
    connection.open = true
    connection.emit('open', undefined)

    transport.send('hola')
    expect(connection.sent).toEqual(['hola'])

    connection.emit('data', 'ping')
    connection.emit('data', { type: 'sync-update', ok: true })

    unsubscribe()
    connection.emit('data', 'ignored')

    expect(received).toEqual(['ping', JSON.stringify({ type: 'sync-update', ok: true })])

    connection.emit('error', new Error('boom'))
    connection.emit('close', undefined)

    expect(status).toContain('Connexió oberta amb remote-peer')
    expect(status).toContain('Error de connexió: boom')
    expect(status).toContain('Connexió tancada amb remote-peer')
  })

  it('handles incoming connections, missing active peers, peer errors, and destroy', () => {
    const status: string[] = []
    const transport = createWebRtcSyncPeer({
      peerId: 'host-peer',
      config: {
        iceServers: [],
      },
      onStatus: (message) => status.push(message),
    })

    const peer = peerInstances[0]

    transport.send('before-open')
    expect(status).toContain('No hi ha cap peer connectat')

    const incoming = new MockConnection('guest-peer')
    incoming.open = true
    const received: string[] = []
    transport.subscribe((message) => received.push(message))

    peer.emit('connection', incoming)
    incoming.emit('data', 'hola des del convidat')
    transport.send('resposta')
    peer.emit('error', new Error('peer fail'))
    transport.destroy()

    expect(status).toContain('Peer entrant: guest-peer')
    expect(status).toContain('Connexió oberta amb guest-peer')
    expect(status).toContain('Error PeerJS: peer fail')
    expect(status).toContain('Connexió tancada amb guest-peer')
    expect(received).toEqual(['hola des del convidat'])
    expect(incoming.sent).toEqual(['resposta'])
    expect(peer.destroyed).toBe(true)
  })
})
