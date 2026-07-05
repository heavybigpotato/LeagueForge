import type { AppState } from './store'
import { SCHEMA_VERSION } from '../core/config'

/**
 * Backup export. Everything a device knows can leave as one JSON file —
 * versioned, human-readable, yours. (In-app import was removed; a backup
 * can be inspected or restored by placing it back into local storage with
 * the developer tools, and mainly serves as an archival copy.)
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
