import * as Y from 'yjs'

function normalizeBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes)
}

function bytesToBinary(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
}

function binaryToBytes(binary: string): Uint8Array<ArrayBuffer> {
  return normalizeBytes(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export interface SyncEnvelope {
  iv: string
  payload: string
}

export interface GroupSnapshot {
  title: string
  expenses: Array<{ id: string; description: string; amount: number }>
}

function toBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return binaryToBytes(atob(value))
}

async function importGroupKey(groupKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', normalizeBytes(groupKey), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function generateGroupKey(): Promise<Uint8Array<ArrayBuffer>> {
  return normalizeBytes(crypto.getRandomValues(new Uint8Array(32)))
}

export function createGroupDoc(initialTitle = 'Nou grup'): Y.Doc {
  const doc = new Y.Doc()
  const meta = doc.getMap<string>('meta')
  const expenses = doc.getArray<{ id: string; description: string; amount: number }>('expenses')
  meta.set('title', initialTitle)
  if (expenses.length === 0) expenses.insert(0, [])
  return doc
}

export function addExpenseToDoc(doc: Y.Doc, expense: { id: string; description: string; amount: number }) {
  const expenses = doc.getArray<{ id: string; description: string; amount: number }>('expenses')
  expenses.push([expense])
}

export function readGroupSnapshot(doc: Y.Doc): GroupSnapshot {
  const meta = doc.getMap<string>('meta')
  const expenses = doc.getArray<{ id: string; description: string; amount: number }>('expenses')
  return {
    title: meta.get('title') ?? 'Nou grup',
    expenses: expenses.toArray(),
  }
}

export async function exportEncryptedUpdate(doc: Y.Doc, groupKey: Uint8Array): Promise<SyncEnvelope> {
  const update = Y.encodeStateAsUpdate(doc)
  const iv = normalizeBytes(crypto.getRandomValues(new Uint8Array(12)))
  const key = await importGroupKey(groupKey)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, normalizeBytes(update))
  return {
    iv: toBase64(iv),
    payload: toBase64(new Uint8Array(encrypted)),
  }
}

export async function applyEncryptedUpdate(doc: Y.Doc, envelope: SyncEnvelope, groupKey: Uint8Array) {
  const key = await importGroupKey(groupKey)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
    key,
    fromBase64(envelope.payload),
  )
  Y.applyUpdate(doc, new Uint8Array(decrypted))
}

export async function createInvitePayload(groupKey: Uint8Array, groupId: string): Promise<string> {
  return JSON.stringify({ groupId, key: toBase64(groupKey) })
}

export async function readInvitePayload(payload: string): Promise<{ groupId: string; groupKey: Uint8Array }> {
  const parsed = JSON.parse(payload) as { groupId: string; key: string }
  return { groupId: parsed.groupId, groupKey: fromBase64(parsed.key) }
}

export function debugSnapshot(snapshot: GroupSnapshot): string {
  return `${snapshot.title}: ${snapshot.expenses.map((expense) => `${expense.description}(${expense.amount})`).join(', ')}`
}
