import type { AuditEntry, League, Match, Team } from './types'
import { auditEntry } from './audit'
import { computeStandings } from './standings'
import { bracket } from './playoffs'

/**
 * Season lifecycle. A league runs numbered seasons; every match is stamped
 * with its season, and standings, form, playoffs, and power rankings only
 * ever read the current one. Ending a season freezes a SeasonRecord —
 * final table, table leader, and playoff champion — into the league's
 * permanent history, bumps the season counter, and (if the league allows
 * it or between seasons) unlocks rosters so squads can be reshaped before
 * the next campaign.
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
  const championTeamId = bracket(league.id, matches, league.currentSeason)?.championTeamId
  if (!played && !championTeamId) {
    throw new Error('Nothing to archive yet — verify at least one result before ending the season.')
  }

  const record = {
    season: league.currentSeason,
    endedAt: now,
    championTeamId,
    tableLeaderTeamId: table[0]?.played ? table[0].teamId : undefined,
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

  const champName = championTeamId ? `champions decided` : 'no playoff champion'
  return {
    league: nextLeague,
    teams: nextTeams,
    audit: [
      auditEntry(
        league.id,
        actorId,
        'season.ended',
        `Season ${record.season} archived (${table.length} teams, ${champName}). Season ${nextLeague.currentSeason} begins — rosters unlocked.`,
        now,
      ),
    ],
  }
}
