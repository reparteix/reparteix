/** Sync protocol message types for WebRTC peer-to-peer communication. */

import { z } from 'zod/v4'
import type { EncryptedPayload } from '../../domain/services/crypto'

// ─── Protocol Version ───────────────────────────────────────────────────────

export const SYNC_PROTOCOL_VERSION = 1

// ─── Message Schemas ────────────────────────────────────────────────────────

const EncryptedPayloadSchema = z.object({
  iv: z.string(),
  ciphertext: z.string(),
  salt: z.string(),
})

const HelloMessageSchema = z.object({
  type: z.literal('hello'),
  protocolVersion: z.number(),
  peerId: z.string(),
  groupIds: z.array(z.string()),
})

const RequestSyncMessageSchema = z.object({
  type: z.literal('request-sync'),
  groupId: z.string(),
})

const SyncDataMessageSchema = z.object({
  type: z.literal('sync-data'),
  groupId: z.string(),
  payload: EncryptedPayloadSchema,
})

const SyncDataChunkMessageSchema = z.object({
  type: z.literal('sync-data-chunk'),
  groupId: z.string(),
  transferId: z.string(),
  index: z.number().int().min(0),
  total: z.number().int().positive(),
  chunk: z.string(),
})

const SyncAckMessageSchema = z.object({
  type: z.literal('sync-ack'),
  groupId: z.string(),
  status: z.enum(['ok', 'error', 'no-data']),
  message: z.string().optional(),
})

const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
})

export const SyncMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  RequestSyncMessageSchema,
  SyncDataMessageSchema,
  SyncDataChunkMessageSchema,
  SyncAckMessageSchema,
  ErrorMessageSchema,
])

// ─── TypeScript Types ───────────────────────────────────────────────────────

export type HelloMessage = z.infer<typeof HelloMessageSchema>
export type RequestSyncMessage = z.infer<typeof RequestSyncMessageSchema>
export type SyncDataMessage = z.infer<typeof SyncDataMessageSchema>
export type SyncDataChunkMessage = z.infer<typeof SyncDataChunkMessageSchema>
export type SyncAckMessage = z.infer<typeof SyncAckMessageSchema>
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>
export type SyncMessage = z.infer<typeof SyncMessageSchema>

// ─── Message Factories ──────────────────────────────────────────────────────

export function createHelloMessage(peerId: string, groupIds: string[]): HelloMessage {
  return {
    type: 'hello',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    peerId,
    groupIds,
  }
}

export function createRequestSyncMessage(groupId: string): RequestSyncMessage {
  return { type: 'request-sync', groupId }
}

export function createSyncDataMessage(
  groupId: string,
  payload: EncryptedPayload,
): SyncDataMessage {
  return { type: 'sync-data', groupId, payload }
}

export function createSyncDataChunkMessage(
  groupId: string,
  transferId: string,
  index: number,
  total: number,
  chunk: string,
): SyncDataChunkMessage {
  return { type: 'sync-data-chunk', groupId, transferId, index, total, chunk }
}

export function createSyncAckMessage(
  groupId: string,
  status: 'ok' | 'error' | 'no-data',
  message?: string,
): SyncAckMessage {
  return { type: 'sync-ack', groupId, status, message }
}

export function createErrorMessage(code: string, message: string): ErrorMessage {
  return { type: 'error', code, message }
}

// ─── Encoding / Decoding ────────────────────────────────────────────────────

/** Encode a SyncMessage to a JSON string for transmission over a data channel. */
export function encodeMessage(message: SyncMessage): string {
  return JSON.stringify(message)
}

/** Decode and validate a raw message into a SyncMessage. Accepts either a JSON string or a parsed object. Returns null if invalid. */
export function decodeMessage(raw: unknown): SyncMessage | null {
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    return SyncMessageSchema.parse(parsed)
  } catch {
    return null
  }
}
