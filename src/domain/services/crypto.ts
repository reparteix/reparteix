/** App-level encryption for sync payloads using WebCrypto API (AES-256-GCM + PBKDF2). */

const PBKDF2_ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256
const IV_LENGTH_BYTES = 12
const SALT_LENGTH_BYTES = 16

export interface EncryptedPayload {
  /** Base64-encoded initialisation vector */
  iv: string
  /** Base64-encoded ciphertext */
  ciphertext: string
  /** Base64-encoded salt used for key derivation */
  salt: string
}

const subtle = globalThis.crypto?.subtle

/** Generate a cryptographically random salt. */
export function generateSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES))
}

/** Derive an AES-256-GCM key from a passphrase and salt using PBKDF2. */
export async function deriveGroupKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt a plaintext string with the given AES-GCM key. */
export async function encryptPayload(
  key: CryptoKey,
  plaintext: string,
  salt: Uint8Array,
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder()
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(plaintext),
  )

  return {
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(ciphertextBuffer)),
    salt: uint8ToBase64(salt),
  }
}

/** Decrypt an encrypted payload with the given AES-GCM key. */
export async function decryptPayload(key: CryptoKey, encrypted: EncryptedPayload): Promise<string> {
  const iv = base64ToUint8(encrypted.iv)
  const ciphertext = base64ToUint8(encrypted.ciphertext)

  const plaintextBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer,
  )

  return new TextDecoder().decode(plaintextBuffer)
}

/** Encrypt a sync envelope JSON string end-to-end using a group passphrase. */
export async function encryptSyncPayload(
  passphrase: string,
  data: string,
): Promise<EncryptedPayload> {
  const salt = generateSalt()
  const key = await deriveGroupKey(passphrase, salt)
  return encryptPayload(key, data, salt)
}

/** Decrypt a sync envelope from an encrypted payload using a group passphrase. */
export async function decryptSyncPayload(
  passphrase: string,
  encrypted: EncryptedPayload,
): Promise<string> {
  const salt = base64ToUint8(encrypted.salt)
  const key = await deriveGroupKey(passphrase, salt)
  return decryptPayload(key, encrypted)
}

// ─── Base64 helpers (URL-safe not needed here; standard base64 is fine) ─────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
