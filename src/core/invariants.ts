import type { League, Match, Team, User } from './types'
import { PLATFORM_MIN_PLAYERS } from './types'
import { LIMITS } from './config'

/**
 * Integrity invariants. These are the promises the platform makes; the
 * checker walks a full state snapshot and reports every violation. It runs
 * in the Data Center health panel and in tests, and guards import so a
 * malformed backup can never smuggle in state the domain rules would
 * have rejected.
 */

export interface StateSnapshot {
  users: User[]
  leagues: League[]
  teams: Team[]
  matches: Match[]
  auditLog: { id: string; leagueId: string }[]
}

export interface Violation {
  rule: string
  detail: string
}

export function checkInvariants(s: StateSnapshot): Violation[] {
  const v: Violation[] = []
  const userIds = new Set(s.users.map((u) => u.id))
  const leagueIds = new Set(s.leagues.map((l) => l.id))
  const teamIds = new Set(s.teams.map((t) => t.id))
  const teamById = new Map(s.teams.map((t) => [t.id, t]))
  const leagueById = new Map(s.leagues.map((l) => [l.id, l]))

  // ---- referential integrity
  for (const t of s.teams) {
    // Free-agent teams (leagueId null) are valid — they exist between leagues.
    if (t.leagueId !== null && !leagueIds.has(t.leagueId)) {
      v.push({ rule: 'orphaned-team', detail: `Team "${t.name}" references missing league ${t.leagueId}.` })
    }
    if (!userIds.has(t.captainId)) v.push({ rule: 'orphaned-user', detail: `Team "${t.name}" captain ${t.captainId} does not exist.` })
    for (const id of t.memberIds) {
      if (!userIds.has(id)) v.push({ rule: 'orphaned-user', detail: `Team "${t.name}" roster references missing user ${id}.` })
    }
    if (!t.memberIds.includes(t.captainId)) {
      v.push({ rule: 'captain-not-on-roster', detail: `Team "${t.name}" captain is not on its own roster.` })
    }
  }
  for (const m of s.matches) {
    if (!leagueIds.has(m.leagueId)) v.push({ rule: 'orphaned-match', detail: `Match ${m.id} references missing league.` })
    if (!teamIds.has(m.homeTeamId) || !teamIds.has(m.awayTeamId)) {
      v.push({ rule: 'orphaned-match', detail: `Match ${m.id} references a missing team.` })
    }
  }
  for (const a of s.auditLog) {
    if (!leagueIds.has(a.leagueId)) v.push({ rule: 'orphaned-audit', detail: `Audit entry ${a.id} references missing league.` })
  }
  for (const l of s.leagues) {
    if (!userIds.has(l.commissionerId)) v.push({ rule: 'orphaned-user', detail: `League "${l.name}" commissioner does not exist.` })
  }

  // ---- competition integrity
  for (const m of s.matches) {
    const home = teamById.get(m.homeTeamId)
    const away = teamById.get(m.awayTeamId)
    if (home?.status === 'pending' || away?.status === 'pending') {
      v.push({ rule: 'pending-team-scheduled', detail: `Match ${m.id} involves a pending team — pending teams cannot be scheduled.` })
    }
    if (m.status === 'official' && !m.result) {
      v.push({ rule: 'official-without-result', detail: `Match ${m.id} is official but has no verified result.` })
    }
    if (m.status !== 'official' && m.result) {
      v.push({ rule: 'result-without-verification', detail: `Match ${m.id} carries a result but was never verified.` })
    }
    if (m.stage === 'playoff' && m.result && m.result.homeScore === m.result.awayScore) {
      v.push({ rule: 'cup-draw', detail: `Cup tie ${m.id} ended level — a knockout tie must have a winner.` })
    }
  }

  // ---- roster integrity (league bounds when in a league, platform bounds when free)
  for (const t of s.teams) {
    const league = t.leagueId !== null ? leagueById.get(t.leagueId) : null
    const min = league ? league.minPlayersPerTeam : PLATFORM_MIN_PLAYERS
    const max = league ? league.maxPlayersPerTeam : LIMITS.maxRoster
    if (t.status === 'official' && t.memberIds.length < min) {
      v.push({ rule: 'official-below-minimum', detail: `Official team "${t.name}" has ${t.memberIds.length} players, below the minimum of ${min}.` })
    }
    if (t.memberIds.length > max) {
      v.push({ rule: 'roster-over-maximum', detail: `Team "${t.name}" exceeds the roster maximum.` })
    }
  }
  // one account, one team per league
  for (const l of s.leagues) {
    const seen = new Map<string, string>()
    for (const t of s.teams.filter((x) => x.leagueId === l.id)) {
      for (const uid of t.memberIds) {
        const already = seen.get(uid)
        if (already && already !== t.id) {
          v.push({ rule: 'duplicate-membership', detail: `A user is on two teams in league "${l.name}".` })
        }
        seen.set(uid, t.id)
      }
    }
  }

  return v
}
