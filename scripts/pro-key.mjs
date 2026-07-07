#!/usr/bin/env node
/**
 * Mint LeagueForge Pro license keys after each sale:
 *
 *   npm run pro:key                       one key with the secret from config
 *   npm run pro:key -- 3                  three keys
 *   PRO_SECRET=my-secret npm run pro:key  override the secret (must match config)
 *
 * KEEP IN SYNC with src/core/pro.ts (proChecksum / generateProKey) — the app
 * verifies with the same algorithm and the same secret.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function proChecksum(payload, secret) {
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

function secretFromConfig() {
  const configPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'config.ts')
  const source = readFileSync(configPath, 'utf8')
  const match = source.match(/keySecret:\s*'([^']+)'/)
  if (!match) throw new Error('Could not find PRO.keySecret in src/core/config.ts')
  return match[1]
}

const secret = process.env.PRO_SECRET ?? secretFromConfig()
const count = Math.max(1, Math.min(100, Number(process.argv[2]) || 1))

if (secret === 'leagueforge-dev-secret-change-me') {
  console.error('⚠ PRO.keySecret is still the dev default — change it in src/core/config.ts before selling.\n')
}

for (let k = 0; k < count; k++) {
  let payload = ''
  for (let i = 0; i < 10; i++) payload += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  const body = payload + proChecksum(payload, secret)
  console.log(`LFPRO-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 15)}`)
}
