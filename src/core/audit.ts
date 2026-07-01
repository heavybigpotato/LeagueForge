import type { AuditAction, AuditEntry, Id } from './types'
import { newId } from './ids'

/**
 * The audit log is append-only. There is deliberately no API to edit or
 * remove entries; every mutation in the engine returns a new frozen entry
 * that gets appended to the league's history.
 */
export function auditEntry(
  leagueId: Id,
  actorId: Id,
  action: AuditAction,
  detail: string,
  at: number = Date.now(),
): AuditEntry {
  return Object.freeze({
    id: newId('audit'),
    leagueId,
    at,
    actorId,
    action,
    detail,
  })
}

/** Append entries without mutating the existing log. */
export function appendAudit(log: readonly AuditEntry[], ...entries: AuditEntry[]): AuditEntry[] {
  return [...log, ...entries]
}
