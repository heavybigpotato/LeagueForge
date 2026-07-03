/**
 * Storage adapter. The app is local-first: this wraps localStorage with
 * availability detection and graceful degradation (in-memory fallback), and
 * is the seam where a synced/server persistence layer would plug in later.
 * Nothing stored here is server-backed or encrypted — the UI says so.
 */
export interface StorageAdapter {
  get(key: string): string | null
  set(key: string, value: string): boolean
  remove(key: string): void
  available: boolean
}

function detectLocalStorage(): boolean {
  try {
    const probe = '__lf_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const memory = new Map<string, string>()

export const localStorageAdapter: StorageAdapter = (() => {
  const available = typeof window !== 'undefined' && detectLocalStorage()
  return {
    available,
    get(key) {
      if (!available) return memory.get(key) ?? null
      try {
        return window.localStorage.getItem(key)
      } catch {
        return memory.get(key) ?? null
      }
    },
    set(key, value) {
      memory.set(key, value)
      if (!available) return false
      try {
        window.localStorage.setItem(key, value)
        return true
      } catch {
        return false
      }
    },
    remove(key) {
      memory.delete(key)
      if (!available) return
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* nothing else to do locally */
      }
    },
  }
})()
