export { type SyncConfig, type PeerJsConfig, DEFAULT_SYNC_CONFIG, createSyncConfig } from './config'

export {
  SYNC_PROTOCOL_VERSION,
  SyncMessageSchema,
  type SyncMessage,
  type HelloMessage,
  type RequestSyncMessage,
  type SyncDataMessage,
  type SyncAckMessage,
  type ErrorMessage,
  createHelloMessage,
  createRequestSyncMessage,
  createSyncDataMessage,
  createSyncAckMessage,
  createErrorMessage,
  encodeMessage,
  decodeMessage,
} from './protocol'

export {
  type ConnectionState,
  type PeerConnection,
  type PeerManagerEvents,
  type PeerManagerOptions,
  createPeerManager,
} from './peer-manager'
