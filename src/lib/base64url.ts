/**
 * Base64url encoding/decoding utilities for URL-safe string encoding.
 * Uses the URL-safe base64 variant (RFC 4648 §5): - instead of +, _ instead of /, no padding.
 */

/**
 * Encode a string to base64url (URL-safe base64 without padding).
 * Correctly handles UTF-8 multi-byte characters.
 */
export function encodeBase64Url(str: string): string {
  const utf8 = new TextEncoder().encode(str)
  let binary = ''
  for (const byte of utf8) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode a base64url string back to a UTF-8 string.
 * Handles the URL-safe variant (- instead of +, _ instead of /).
 */
export function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}
