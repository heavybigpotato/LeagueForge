import type { League, Match, StandingRow, Team } from './types'
import { computeStandings } from './standings'

export interface AchievementAward {
  key: string
  title: string
  description: string
  rare: boolean
  teamId: string
}

/**
 * Season-level achievements derived from verified results only.
 * (Player-level awards such as Golden Boot hook in once per-player match
 * statistics are recorded.)
 */
export function evaluateSeasonAchievements(league: League, teams: Team[], matches: Match[]): AchievementAward[] {
  const table = computeStandings(league, teams, matches)
  if (table.length === 0) return []
  const awards: AchievementAward[] = []

  const leader = table[0]
  if (leader.played > 0) {
    awards.push({
      key: 'champion',
      title: 'Champion',
      description: 'Finished top of the league table.',
      rare: false,
      teamId: leader.teamId,
    })
    if (leader.losses === 0 && leader.draws === 0 && leader.played >= 3) {
      awards.push({
        key: 'perfect-season',
        title: 'Perfect Season',
        description: 'Won every verified match of the season.',
        rare: true,
        teamId: leader.teamId,
      })
    }
  }

  const bestDefense = minBy(table.filter((r) => r.played > 0), (r) => r.goalsAgainst)
  if (bestDefense) {
    awards.push({
      key: 'top-defender',
      title: 'Top Defense',
      description: 'Fewest goals conceded across the season.',
      rare: false,
      teamId: bestDefense.teamId,
    })
  }
  return awards
}

function minBy(rows: StandingRow[], f: (r: StandingRow) => number): StandingRow | undefined {
  let best: StandingRow | undefined
  for (const r of rows) if (!best || f(r) < f(best)) best = r
  return best
}
