import { describe, it, expect } from 'vitest'
import {
  generateSalt,
  deriveGroupKey,
  encryptPayload,
  decryptPayload,
  encryptSyncPayload,
  decryptSyncPayload,
} from './crypto'

describe('crypto', () => {
  const TEST_PASSPHRASE = 'test-group-passphrase-2024'

  describe('generateSalt', () => {
    it('returns a Uint8Array of 16 bytes', () => {
      const salt = generateSalt()
      expect(salt).toBeInstanceOf(Uint8Array)
      expect(salt.length).toBe(16)
    })

    it('generates different salts each time', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      expect(salt1).not.toEqual(salt2)
    })
  })

  describe('deriveGroupKey', () => {
    it('derives a CryptoKey from passphrase and salt', async () => {
      const salt = generateSalt()
      const key = await deriveGroupKey(TEST_PASSPHRASE, salt)
      expect(key).toBeDefined()
      expect(key.type).toBe('secret')
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
      expect(key.usages).toContain('encrypt')
      expect(key.usages).toContain('decrypt')
    })

    it('derives the same key for the same passphrase and salt', async () => {
      const salt = generateSalt()
      const key1 = await deriveGroupKey(TEST_PASSPHRASE, salt)
      const key2 = await deriveGroupKey(TEST_PASSPHRASE, salt)

      // Keys are non-extractable by design; verify equivalence via encrypt/decrypt round-trip
      const plaintext = 'test equivalence'
      const encrypted = await encryptPayload(key1, plaintext, salt)
      const decrypted = await decryptPayload(key2, encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('derives different keys for different passphrases', async () => {
      const salt = generateSalt()
      const key1 = await deriveGroupKey('passphrase-a', salt)
      const key2 = await deriveGroupKey('passphrase-b', salt)

      const plaintext = 'test divergence'
      const encrypted = await encryptPayload(key1, plaintext, salt)
      // Decrypting with a different key should fail
      await expect(decryptPayload(key2, encrypted)).rejects.toThrow()
    })

    it('derives different keys for different salts', async () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      const key1 = await deriveGroupKey(TEST_PASSPHRASE, salt1)
      const key2 = await deriveGroupKey(TEST_PASSPHRASE, salt2)

      const plaintext = 'test salt divergence'
      const encrypted = await encryptPayload(key1, plaintext, salt1)
      // Decrypting with key derived from different salt should fail
      await expect(decryptPayload(key2, encrypted)).rejects.toThrow()
    })
  })

  describe('encryptPayload / decryptPayload', () => {
    it('round-trips a plaintext string', async () => {
      const salt = generateSalt()
      const key = await deriveGroupKey(TEST_PASSPHRASE, salt)
      const plaintext = 'Hello, Reparteix sync!'

      const encrypted = await encryptPayload(key, plaintext, salt)
      expect(encrypted.iv).toBeTruthy()
      expect(encrypted.ciphertext).toBeTruthy()
      expect(encrypted.salt).toBeTruthy()

      const decrypted = await decryptPayload(key, encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('handles JSON payloads correctly', async () => {
      const salt = generateSalt()
      const key = await deriveGroupKey(TEST_PASSPHRASE, salt)
      const envelope = {
        version: 1,
        group: { id: 'g1', name: 'Test Group', members: [] },
        expenses: [],
        payments: [],
      }

      const plaintext = JSON.stringify(envelope)
      const encrypted = await encryptPayload(key, plaintext, salt)
      const decrypted = await decryptPayload(key, encrypted)

      expect(JSON.parse(decrypted)).toEqual(envelope)
    })

    it('handles empty strings', async () => {
      const salt = generateSalt()
      const key = await deriveGroupKey(TEST_PASSPHRASE, salt)

      const encrypted = await encryptPayload(key, '', salt)
      const decrypted = await decryptPayload(key, encrypted)
      expect(decrypted).toBe('')
    })

    it('handles unicode content', async () => {
      const salt = generateSalt()
      const key = await deriveGroupKey(TEST_PASSPHRASE, salt)
      const plaintext = 'Despesa de 42,50€ — Sopar amb amics 🍕'

      const encrypted = await encryptPayload(key, plaintext, salt)
      const decrypted = await decryptPayload(key, encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('produces different ciphertexts for the same plaintext (random IV)', async () => {
      const salt = generateSalt()
      const key = await deriveGroupKey(TEST_PASSPHRASE, salt)
      const plaintext = 'same data'

      const enc1 = await encryptPayload(key, plaintext, salt)
      const enc2 = await encryptPayload(key, plaintext, salt)

      // IVs should differ
      expect(enc1.iv).not.toBe(enc2.iv)
      // Ciphertexts should also differ due to different IVs
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
    })

    it('fails to decrypt with the wrong key', async () => {
      const salt = generateSalt()
      const correctKey = await deriveGroupKey('correct-passphrase', salt)
      const wrongKey = await deriveGroupKey('wrong-passphrase', salt)

      const encrypted = await encryptPayload(correctKey, 'secret data', salt)

      await expect(decryptPayload(wrongKey, encrypted)).rejects.toThrow()
    })

    it('fails to decrypt with tampered ciphertext', async () => {
      const salt = generateSalt()
      const key = await deriveGroupKey(TEST_PASSPHRASE, salt)

      const encrypted = await encryptPayload(key, 'important data', salt)
      // Tamper with ciphertext
      const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -4) + 'AAAA' }

      await expect(decryptPayload(key, tampered)).rejects.toThrow()
    })
  })

  describe('encryptSyncPayload / decryptSyncPayload', () => {
    it('round-trips with passphrase-based encryption', async () => {
      const data = JSON.stringify({ version: 1, group: { id: 'g1' } })
      const passphrase = 'my-secret-group-key'

      const encrypted = await encryptSyncPayload(passphrase, data)
      expect(encrypted.iv).toBeTruthy()
      expect(encrypted.ciphertext).toBeTruthy()
      expect(encrypted.salt).toBeTruthy()

      const decrypted = await decryptSyncPayload(passphrase, encrypted)
      expect(decrypted).toBe(data)
    })

    it('fails with wrong passphrase', async () => {
      const data = 'sensitive group data'
      const encrypted = await encryptSyncPayload('correct-pass', data)

      await expect(decryptSyncPayload('wrong-pass', encrypted)).rejects.toThrow()
    })

    it('each encryption uses a fresh salt and IV', async () => {
      const data = 'same payload'
      const passphrase = 'same-pass'

      const enc1 = await encryptSyncPayload(passphrase, data)
      const enc2 = await encryptSyncPayload(passphrase, data)

      expect(enc1.salt).not.toBe(enc2.salt)
      expect(enc1.iv).not.toBe(enc2.iv)
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
    })
  })
})
