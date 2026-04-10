import { describe, it, expect } from 'vitest'
import { DEFAULT_SYNC_CONFIG, createSyncConfig } from './config'

describe('sync config', () => {
  describe('DEFAULT_SYNC_CONFIG', () => {
    it('uses public PeerJS server', () => {
      expect(DEFAULT_SYNC_CONFIG.peerJs.host).toBe('0.peerjs.com')
      expect(DEFAULT_SYNC_CONFIG.peerJs.port).toBe(443)
      expect(DEFAULT_SYNC_CONFIG.peerJs.secure).toBe(true)
    })

    it('uses Google public STUN servers', () => {
      expect(DEFAULT_SYNC_CONFIG.iceServers).toHaveLength(2)
      expect(DEFAULT_SYNC_CONFIG.iceServers[0]).toEqual({
        urls: 'stun:stun.l.google.com:19302',
      })
    })

    it('has a reasonable connection timeout', () => {
      expect(DEFAULT_SYNC_CONFIG.connectionTimeoutMs).toBeGreaterThanOrEqual(5000)
    })
  })

  describe('createSyncConfig', () => {
    it('returns defaults when called with no overrides', () => {
      const config = createSyncConfig()
      expect(config).toEqual(DEFAULT_SYNC_CONFIG)
    })

    it('merges peerJs overrides', () => {
      const config = createSyncConfig({
        peerJs: { host: 'my-peer-server.com', port: 9000 },
      })
      expect(config.peerJs.host).toBe('my-peer-server.com')
      expect(config.peerJs.port).toBe(9000)
      // Keeps defaults for unspecified fields
      expect(config.peerJs.path).toBe('/')
      expect(config.peerJs.secure).toBe(true)
    })

    it('replaces iceServers when provided', () => {
      const customIce = [{ urls: 'stun:my-stun.example.com:3478' }]
      const config = createSyncConfig({ iceServers: customIce })
      expect(config.iceServers).toEqual(customIce)
    })

    it('overrides timeout', () => {
      const config = createSyncConfig({ connectionTimeoutMs: 30_000 })
      expect(config.connectionTimeoutMs).toBe(30_000)
    })

    it('enables debug mode', () => {
      const config = createSyncConfig({ debug: true })
      expect(config.debug).toBe(true)
    })

    it('supports full self-hosted configuration', () => {
      const config = createSyncConfig({
        peerJs: {
          host: 'peer.mycompany.com',
          port: 8443,
          path: '/peerjs',
          secure: true,
        },
        iceServers: [
          { urls: 'stun:stun.mycompany.com:3478' },
          {
            urls: 'turn:turn.mycompany.com:3478',
            username: 'user',
            credential: 'pass',
          },
        ],
        connectionTimeoutMs: 20_000,
        debug: true,
      })

      expect(config.peerJs.host).toBe('peer.mycompany.com')
      expect(config.iceServers).toHaveLength(2)
      expect(config.iceServers[1]).toMatchObject({ urls: 'turn:turn.mycompany.com:3478' })
      expect(config.connectionTimeoutMs).toBe(20_000)
      expect(config.debug).toBe(true)
    })
  })
})
