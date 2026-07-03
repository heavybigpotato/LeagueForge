import type { AppState } from './store'
import { SCHEMA_VERSION } from '../core/config'
import { checkInvariants, type Violation } from '../core/invariants'
import { migrate, validateStateShape, emptyAppState } from './persistence'

/**
 * Backup export/import. Everything a device knows can leave as one JSON
 * file and come back on another device. Imports are validated structurally,
 * migrated across schema versions, and integrity-checked before they are
 * allowed to replace local state.
 */

export interface BackupFile {
  app: 'leagueforge-backup'
  schemaVersion: number
  exportedAt: number
  state: Omit<AppState, 'notifications'>
}

export function exportBackup(state: AppState, exportedAt: number = Date.now()): string {
  const { notifications: _transient, ...persistable } = state
  const file: BackupFile = { app: 'leagueforge-backup', schemaVersion: SCHEMA_VERSION, exportedAt, state: persistable }
  return JSON.stringify(file, null, 2)
}

export interface ImportPreview {
  ok: boolean
  errors: string[]
  warnings: string[]
  schemaVersion?: number
  exportedAt?: number
  counts?: { users: number; leagues: number; teams: number; matches: number; auditEntries: number; seasonsArchived: number }
  violations?: Violation[]
  /** Present only when ok — the state that would be applied. */
  state?: AppState
}

export function validateBackup(json: string): ImportPreview {
  let parsed: Partial<BackupFile>
  try {
    parsed = JSON.parse(json) as Partial<BackupFile>
  } catch {
    return { ok: false, errors: ['This file is not valid JSON.'], warnings: [] }
  }
  if (parsed.app !== 'leagueforge-backup') {
    return { ok: false, errors: ['This file is not a LeagueForge backup (missing signature).'], warnings: [] }
  }
  if (typeof parsed.schemaVersion !== 'number') {
    return { ok: false, errors: ['Backup has no schema version.'], warnings: [] }
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, errors: [`Backup uses schema v${parsed.schemaVersion}, newer than this app (v${SCHEMA_VERSION}). Update the app first.`], warnings: [] }
  }
  if (!parsed.state || typeof parsed.state !== 'object') {
    return { ok: false, errors: ['Backup contains no state.'], warnings: [] }
  }

  let state: Record<string, unknown> = parsed.state as Record<string, unknown>
  if (parsed.schemaVersion < SCHEMA_VERSION) {
    const migrated = migrate(state, parsed.schemaVersion)
    if (!migrated) return { ok: false, errors: [`Cannot migrate from schema v${parsed.schemaVersion}.`], warnings: [] }
    state = migrated
  }
  if (!validateStateShape(state)) {
    return { ok: false, errors: ['Backup state is malformed (wrong structure).'], warnings: [] }
  }

  const full = { ...emptyAppState(), ...(state as object), notifications: [] } as AppState

  // duplicate-id detection
  const errors: string[] = []
  for (const [name, list] of [
    ['user', full.users],
    ['league', full.leagues],
    ['team', full.teams],
    ['match', full.matches],
  ] as const) {
    const ids = list.map((x: { id: string }) => x.id)
    if (new Set(ids).size !== ids.length) errors.push(`Backup contains duplicate ${name} ids.`)
  }
  if (errors.length > 0) return { ok: false, errors, warnings: [] }

  const violations = checkInvariants(full)
  const warnings = violations.map((x) => `${x.rule}: ${x.detail}`)

  return {
    ok: true,
    errors: [],
    warnings,
    schemaVersion: parsed.schemaVersion,
    exportedAt: parsed.exportedAt,
    counts: {
      users: full.users.length,
      leagues: full.leagues.length,
      teams: full.teams.length,
      matches: full.matches.length,
      auditEntries: full.auditLog.length,
      seasonsArchived: full.leagues.reduce((n, l) => n + l.seasons.length, 0),
    },
    violations,
    state: full,
  }
}
