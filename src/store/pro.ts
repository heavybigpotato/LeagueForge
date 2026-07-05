import { useEffect, useState } from 'react'
import { PRO, type AccentId } from '../core/config'
import { verifyProKey } from '../core/pro'
import { localStorageAdapter } from '../adapters/storage'

/**
 * Pro unlock state, stored separately from app data so erasing leagues never
 * revokes a purchase and backups never leak a license key. Two values: the
 * license key (verified on every read — a bogus stored key never unlocks
 * anything) and the chosen accent theme.
 */

const KEY_STORAGE = 'leagueforge-pro-key'
const ACCENT_STORAGE = 'leagueforge-accent'

export function storedProKey(): string | null {
  return localStorageAdapter.get(KEY_STORAGE)
}

export function isProUnlocked(): boolean {
  const key = storedProKey()
  return key !== null && verifyProKey(key, PRO.keySecret)
}

/** Returns true (and stores the key) only when it verifies. */
export function activateProKey(raw: string): boolean {
  if (!verifyProKey(raw, PRO.keySecret)) return false
  localStorageAdapter.set(KEY_STORAGE, raw.trim())
  notify()
  return true
}

export function getAccent(): AccentId {
  const raw = localStorageAdapter.get(ACCENT_STORAGE) as AccentId | null
  return raw && (isProUnlocked() || raw === 'volt') ? raw : 'volt'
}

export function setAccent(accent: AccentId): void {
  localStorageAdapter.set(ACCENT_STORAGE, accent)
  notify()
}

// In-page listeners so the theme and Pro badges react instantly on unlock.
const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

export function useProState(): { unlocked: boolean; accent: AccentId } {
  const [, bump] = useState(0)
  useEffect(() => {
    const refresh = () => bump((n) => n + 1)
    listeners.add(refresh)
    return () => void listeners.delete(refresh)
  }, [])
  return { unlocked: isProUnlocked(), accent: getAccent() }
}
