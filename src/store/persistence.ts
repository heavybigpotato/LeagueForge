import type { AppState } from './store'
import { LEGACY_STORAGE_KEYS, SCHEMA_VERSION, STORAGE_KEY, VERIFICATION } from '../core/config'
import { newInviteCode } from '../core/ids'
import { localStorageAdapter, type StorageAdapter } from '../adapters/storage'

/**
 * Persistence layer. Saved state is wrapped in an envelope carrying the
 * schema version; loading validates, migrates old versions forward, and
 * falls back safely (preserving the corrupted raw payload so the user can
 * export it before resetting). Transient notifications never persist.
 */

export interface PersistedEnvelope {
  app: 'leagueforge'
  schemaVersion: number
  savedAt: number
  state: Omit<AppState, 'notifications'>
}

export interface LoadResult {
  state: AppState | null
  /** Raw payload we could not understand, kept so the user can export it. */
  corruptedRaw: string | null
  migratedFrom: number | null
}

export function emptyAppState(): AppState {
  return {
    users: [],
    currentUserId: null,
    primaryAccountIds: [],
    verifications: {},
    leagues: [],
    teams: [],
    matches: [],
    auditLog: [],
    notifications: [],
  }
}

/** Structural sanity check — arrays where arrays belong, ids where ids belong. */
export function validateStateShape(s: unknown): s is Omit<AppState, 'notifications'> {
  if (typeof s !== 'object' || s === null) return false
  const x = s as Record<string, unknown>
  const arrays = ['users', 'leagues', 'teams', 'matches', 'auditLog', 'primaryAccountIds'] as const
  for (const key of arrays) if (!Array.isArray(x[key])) return false
  if (typeof x.verifications !== 'object' || x.verifications === null) return false
  if (x.currentUserId !== null && typeof x.currentUserId !== 'string') return false
  for (const u of x.users as unknown[]) {
    const user = u as Record<string, unknown>
    if (typeof user?.id !== 'string' || typeof user?.username !== 'string') return false
  }
  for (const l of x.leagues as unknown[]) {
    const league = l as Record<string, unknown>
    if (typeof league?.id !== 'string' || typeof league?.commissionerId !== 'string') return false
  }
  return true
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>

/** Migrations keyed by the version they upgrade FROM. */
const MIGRATIONS: Record<number, Migration> = {
  // v6 → v7: verification codes gained an expiry model.
  6: (state) => {
    const verifications = (state.verifications ?? {}) as Record<string, Record<string, unknown>>
    const upgraded: Record<string, unknown> = {}
    const nowMs = Date.now()
    for (const [userId, v] of Object.entries(verifications)) {
      upgraded[userId] = {
        ...v,
        issuedAt: v.issuedAt ?? nowMs,
        expiresAt: v.expiresAt ?? nowMs + VERIFICATION.ttlMs,
      }
    }
    return { ...state, verifications: upgraded }
  },
  // v7 → v8: teams became independent of leagues (leagueId may now be null).
  // Existing teams keep the league they were created in — no data changes.
  7: (state) => state,
  // v8 → v9: playoffs removed; leagues gained a join code. Drop any playoff
  // matches and playoffFormat, and mint a join code for existing leagues.
  8: (state) => {
    const leagues = (state.leagues as Record<string, unknown>[] | undefined) ?? []
    const matches = (state.matches as Record<string, unknown>[] | undefined) ?? []
    return {
      ...state,
      leagues: leagues.map((l) => {
        const { playoffFormat: _drop, ...rest } = l
        return { ...rest, joinCode: (l.joinCode as string) ?? newInviteCode() }
      }),
      matches: matches.filter((m) => m.stage !== 'playoff'),
    }
  },
  // v9 → v10: knockout returns as a mode; double round robin is gone.
  // Fold any double-round-robin leagues back to a single round robin.
  9: (state) => {
    const leagues = (state.leagues as Record<string, unknown>[] | undefined) ?? []
    return {
      ...state,
      leagues: leagues.map((l) => (l.scheduleFormat === 'double-round-robin' ? { ...l, scheduleFormat: 'round-robin' } : l)),
    }
  },
}

export function migrate(state: Record<string, unknown>, fromVersion: number): Record<string, unknown> | null {
  let current = state
  for (let version = fromVersion; version < SCHEMA_VERSION; version++) {
    const step = MIGRATIONS[version]
    if (!step) return null // unknown gap — treat as unsupported
    current = step(current)
  }
  return current
}

export function loadState(storage: StorageAdapter = localStorageAdapter): LoadResult {
  const raw = storage.get(STORAGE_KEY)
  if (raw) {
    const result = parseEnvelope(raw)
    if (result) return result
    return { state: null, corruptedRaw: raw, migratedFrom: null }
  }

  // First run on this key: look for a known legacy payload to migrate.
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const legacy = storage.get(legacyKey)
    if (!legacy) continue
    try {
      const parsed = JSON.parse(legacy) as Record<string, unknown>
      const migrated = migrate(parsed, 6)
      if (migrated && validateStateShape(migrated)) {
        return { state: { ...emptyAppState(), ...migrated, notifications: [] } as AppState, corruptedRaw: null, migratedFrom: 6 }
      }
    } catch {
      /* unreadable legacy state is ignored, not fatal */
    }
  }
  return { state: null, corruptedRaw: null, migratedFrom: null }
}

function parseEnvelope(raw: string): LoadResult | null {
  try {
    const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>
    if (envelope.app !== 'leagueforge' || typeof envelope.schemaVersion !== 'number' || !envelope.state) return null
    let state: Record<string, unknown> = envelope.state as Record<string, unknown>
    let migratedFrom: number | null = null
    if (envelope.schemaVersion > SCHEMA_VERSION) return null // from a newer app — do not guess
    if (envelope.schemaVersion < SCHEMA_VERSION) {
      const migrated = migrate(state, envelope.schemaVersion)
      if (!migrated) return null
      state = migrated
      migratedFrom = envelope.schemaVersion
    }
    if (!validateStateShape(state)) return null
    return { state: { ...emptyAppState(), ...state, notifications: [] } as AppState, corruptedRaw: null, migratedFrom }
  } catch {
    return null
  }
}

export function saveState(state: AppState, storage: StorageAdapter = localStorageAdapter, savedAt: number = Date.now()): boolean {
  const { notifications: _transient, ...persistable } = state
  const envelope: PersistedEnvelope = { app: 'leagueforge', schemaVersion: SCHEMA_VERSION, savedAt, state: persistable }
  return storage.set(STORAGE_KEY, JSON.stringify(envelope))
}

export function clearState(storage: StorageAdapter = localStorageAdapter) {
  storage.remove(STORAGE_KEY)
  for (const key of LEGACY_STORAGE_KEYS) storage.remove(key)
}

export function lastSavedAt(storage: StorageAdapter = localStorageAdapter): number | null {
  const raw = storage.get(STORAGE_KEY)
  if (!raw) return null
  try {
    const envelope = JSON.parse(raw) as PersistedEnvelope
    return typeof envelope.savedAt === 'number' ? envelope.savedAt : null
  } catch {
    return null
  }
}
