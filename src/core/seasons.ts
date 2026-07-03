import type { AuditEntry, League, Match, Team } from './types'
import { auditEntry } from './audit'
import { computeStandings } from './standings'

/**
 * Season lifecycle. A league runs numbered seasons; every match is stamped
 * with its season, and standings, form, and power rankings only ever read
 * the current one. Ending a season freezes a SeasonRecord — the final table
 * and the champion (whoever topped it) — into the league's permanent
 * history, bumps the season counter, and unlocks rosters so squads can be
 * reshaped and registration reopens before the next campaign.
 */

/** Matches belonging to the league's season currently in progress. */
export function currentSeasonMatches(league: League, matches: Match[]): Match[] {
  return matches.filter((m) => m.leagueId === league.id && (m.season ?? 1) === league.currentSeason)
}

export function endSeason(
  league: League,
  teams: Team[],
  matches: Match[],
  actorId: string,
  now: number = Date.now(),
): { league: League; teams: Team[]; audit: AuditEntry[] } {
  if (actorId !== league.commissionerId) throw new Error('Only the commissioner can end the season.')
  const table = computeStandings(league, teams, matches)
  const played = table.some((r) => r.played > 0)
  if (!played) {
    throw new Error('Nothing to archive yet — verify at least one result before ending the season.')
  }
  // The champion is whoever tops the verified table.
  const championTeamId = table[0]?.teamId

  const record = {
    season: league.currentSeason,
    endedAt: now,
    championTeamId,
    tableLeaderTeamId: championTeamId,
    table,
  }
  const nextLeague: League = {
    ...league,
    currentSeason: league.currentSeason + 1,
    seasons: [...league.seasons, record],
  }
  // Between seasons every roster unlocks — captains can reshape their squad
  // before the new campaign begins.
  const nextTeams = teams.map((t) => (t.leagueId === league.id ? { ...t, rosterLocked: false } : t))

  const champ = teams.find((t) => t.id === championTeamId)
  return {
    league: nextLeague,
    teams: nextTeams,
    audit: [
      auditEntry(
        league.id,
        actorId,
        'season.ended',
        `Season ${record.season} archived — ${champ ? `"${champ.name}" are champions` : 'no champion'} (${table.length} teams). Season ${nextLeague.currentSeason} registration is open.`,
        now,
      ),
    ],
  }
}
