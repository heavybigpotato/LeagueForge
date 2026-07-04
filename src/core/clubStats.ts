import type { League, Match } from './types'
import { computeTeamStats, type TeamSeasonStats } from './teamStats'

/**
 * A club's story across everything it has ever played — all leagues, all
 * seasons. Titles come from archived season records (a finished league table
 * or a completed cup), so a trophy is only counted once the season is done.
 */

export interface Honour {
  leagueId: string
  leagueName: string
  season: number
  kind: 'league' | 'cup'
  at: number
}

export interface ClubProfile {
  /** Verified record across every official match the team has ever played. */
  allTime: TeamSeasonStats
  /** Championships won, newest first. */
  titles: Honour[]
  /** Distinct leagues the club has been part of. */
  appearances: number
}

export function clubProfile(teamId: string, leagues: League[], matches: Match[]): ClubProfile {
  const allTime = computeTeamStats(teamId, matches)

  const titles: Honour[] = []
  const leaguesSeen = new Set<string>()
  for (const league of leagues) {
    for (const record of league.seasons) {
      if (record.championTeamId === teamId) {
        titles.push({
          leagueId: league.id,
          leagueName: league.name,
          season: record.season,
          kind: league.scheduleFormat === 'knockout' ? 'cup' : 'league',
          at: record.endedAt,
        })
      }
      // The frozen table records everyone who took part that season.
      if (record.table.some((r) => r.teamId === teamId)) leaguesSeen.add(league.id)
    }
  }

  titles.sort((a, b) => b.at - a.at)
  return { allTime, titles, appearances: leaguesSeen.size }
}

/** Total trophies, split by kind — handy for a one-line honours summary. */
export function trophyCount(titles: Honour[]): { total: number; leagues: number; cups: number } {
  const leagues = titles.filter((t) => t.kind === 'league').length
  const cups = titles.filter((t) => t.kind === 'cup').length
  return { total: titles.length, leagues, cups }
}
