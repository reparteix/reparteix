import { describe, it, expect } from 'vitest'
import {
  createHelloMessage,
  createRequestSyncMessage,
  createSyncDataMessage,
  createSyncAckMessage,
  createErrorMessage,
  encodeMessage,
  decodeMessage,
  SYNC_PROTOCOL_VERSION,
} from './protocol'

describe('sync protocol', () => {
  describe('message factories', () => {
    it('creates a hello message', () => {
      const msg = createHelloMessage('peer-1', ['group-a', 'group-b'])
      expect(msg).toEqual({
        type: 'hello',
        protocolVersion: SYNC_PROTOCOL_VERSION,
        peerId: 'peer-1',
        groupIds: ['group-a', 'group-b'],
      })
    })

    it('creates a request-sync message', () => {
      const msg = createRequestSyncMessage('group-a')
      expect(msg).toEqual({ type: 'request-sync', groupId: 'group-a' })
    })

    it('creates a sync-data message', () => {
      const payload = { iv: 'aWY=', ciphertext: 'Y2lwaGVy', salt: 'c2FsdA==' }
      const msg = createSyncDataMessage('group-a', payload)
      expect(msg).toEqual({ type: 'sync-data', groupId: 'group-a', payload })
    })

    it('creates a sync-ack message with ok status', () => {
      const msg = createSyncAckMessage('group-a', 'ok')
      expect(msg).toEqual({ type: 'sync-ack', groupId: 'group-a', status: 'ok' })
    })

    it('creates a sync-ack message with error and reason', () => {
      const msg = createSyncAckMessage('group-a', 'error', 'Decryption failed')
      expect(msg).toEqual({
        type: 'sync-ack',
        groupId: 'group-a',
        status: 'error',
        message: 'Decryption failed',
      })
    })

    it('creates an error message', () => {
      const msg = createErrorMessage('PROTOCOL_MISMATCH', 'Unsupported version')
      expect(msg).toEqual({
        type: 'error',
        code: 'PROTOCOL_MISMATCH',
        message: 'Unsupported version',
      })
    })
  })

  describe('encodeMessage / decodeMessage', () => {
    it('round-trips a hello message', () => {
      const original = createHelloMessage('peer-1', ['g1'])
      const encoded = encodeMessage(original)
      const decoded = decodeMessage(encoded)
      expect(decoded).toEqual(original)
    })

    it('round-trips a request-sync message', () => {
      const original = createRequestSyncMessage('group-x')
      const encoded = encodeMessage(original)
      const decoded = decodeMessage(encoded)
      expect(decoded).toEqual(original)
    })

    it('round-trips a sync-data message', () => {
      const payload = { iv: 'aWY=', ciphertext: 'Y2lwaGVy', salt: 'c2FsdA==' }
      const original = createSyncDataMessage('group-x', payload)
      const encoded = encodeMessage(original)
      const decoded = decodeMessage(encoded)
      expect(decoded).toEqual(original)
    })

    it('round-trips a sync-ack message', () => {
      const original = createSyncAckMessage('group-x', 'no-data')
      const encoded = encodeMessage(original)
      const decoded = decodeMessage(encoded)
      expect(decoded).toEqual(original)
    })

    it('round-trips an error message', () => {
      const original = createErrorMessage('TIMEOUT', 'Connection timed out')
      const encoded = encodeMessage(original)
      const decoded = decodeMessage(encoded)
      expect(decoded).toEqual(original)
    })

    it('returns null for invalid JSON', () => {
      expect(decodeMessage('not valid json')).toBeNull()
    })

    it('returns null for valid JSON that does not match any message type', () => {
      expect(decodeMessage('{"type":"unknown","foo":"bar"}')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(decodeMessage('')).toBeNull()
    })

    it('returns null for missing required fields', () => {
      expect(decodeMessage('{"type":"hello"}')).toBeNull()
    })
  })
})
