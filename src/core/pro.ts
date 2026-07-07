/**
 * LeagueForge Pro license keys — pure, dependency-free, verifiable offline.
 *
 * Format: LFPRO-XXXXX-XXXXX-CCCCC
 *   - two 5-char payload groups, random, unambiguous alphabet (no 0/O, 1/I)
 *   - one 5-char checksum derived from payload + the operator's secret
 *
 * The operator mints keys with `npm run pro:key` (scripts/pro-key.mjs, same
 * algorithm) after each sale; the app verifies them with the secret baked
 * into the build. This is honor-level protection — appropriate for a
 * cosmetic unlock in a local-first app. It keeps casual sharing in check;
 * it is not DRM and does not pretend to be.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const PRO_KEY_PREFIX = 'LFPRO'

/** Deterministic 5-char checksum of a payload under a secret. */
export function proChecksum(payload: string, secret: string): string {
  let h1 = 0xdeadbeef ^ secret.length
  let h2 = 0x41c6ce57 ^ payload.length
  const str = `${secret}:${payload}:${secret}`
  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i) + round
      h1 = Math.imul(h1 ^ ch, 2654435761)
      h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  }
  let value = (h2 >>> 0) * 4294967296 + (h1 >>> 0)
  let out = ''
  for (let i = 0; i < 5; i++) {
    out += ALPHABET[value % ALPHABET.length]
    value = Math.floor(value / ALPHABET.length)
  }
  return out
}

/** Mint a fresh key. Used by the operator script and by tests. */
export function generateProKey(secret: string, random: () => number = Math.random): string {
  let payload = ''
  for (let i = 0; i < 10; i++) payload += ALPHABET[Math.floor(random() * ALPHABET.length)]
  return formatProKey(payload + proChecksum(payload, secret))
}

function formatProKey(chars15: string): string {
  return `${PRO_KEY_PREFIX}-${chars15.slice(0, 5)}-${chars15.slice(5, 10)}-${chars15.slice(10, 15)}`
}

/** Forgiving normalization: case, spaces, and dashes (keys never contain 0/O/1/I). */
export function normalizeProKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** True when the key's checksum matches under the given secret. */
export function verifyProKey(raw: string, secret: string): boolean {
  const clean = normalizeProKey(raw)
  if (!clean.startsWith(PRO_KEY_PREFIX)) return false
  const body = clean.slice(PRO_KEY_PREFIX.length)
  if (body.length !== 15) return false
  const payload = body.slice(0, 10)
  const checksum = body.slice(10)
  if ([...body].some((c) => !ALPHABET.includes(c))) return false
  return proChecksum(payload, secret) === checksum
}
