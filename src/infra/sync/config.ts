/** Sync infrastructure configuration — configurable for public or self-hosted setups. */

export interface PeerJsConfig {
  host: string
  port: number
  path: string
  secure: boolean
}

export interface SyncConfig {
  /** PeerJS signaling server settings. */
  peerJs: PeerJsConfig
  /** ICE servers for WebRTC (STUN/TURN). */
  iceServers: RTCIceServer[]
  /** Maximum time (ms) to wait for a peer connection. */
  connectionTimeoutMs: number
  /** Enable debug logging for sync operations. */
  debug: boolean
}

/** Default public configuration — zero setup required. */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  peerJs: {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
  },
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  connectionTimeoutMs: 15_000,
  debug: false,
}

export type SyncConfigOverrides = Partial<Omit<SyncConfig, 'peerJs'>> & {
  peerJs?: Partial<PeerJsConfig>
}

/** Create a sync config by merging overrides with the defaults. */
export function createSyncConfig(overrides: SyncConfigOverrides = {}): SyncConfig {
  return {
    ...DEFAULT_SYNC_CONFIG,
    ...overrides,
    peerJs: {
      ...DEFAULT_SYNC_CONFIG.peerJs,
      ...overrides.peerJs,
    },
    iceServers: overrides.iceServers ?? DEFAULT_SYNC_CONFIG.iceServers,
  }
}
