import type { Match } from './types'

/**
 * Team-level season statistics, derived from verified results only.
 * LeagueForge deliberately tracks the team, not individuals.
 */
export interface TeamSeasonStats {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  cleanSheets: number
  home: { wins: number; draws: number; losses: number }
  away: { wins: number; draws: number; losses: number }
  /** e.g. { type: 'W', count: 3 } = won last three; null before any result. */
  currentStreak: { type: 'W' | 'D' | 'L'; count: number } | null
  longestWinStreak: number
  biggestWin: { opponentTeamId: string; scored: number; conceded: number } | null
}

export function computeTeamStats(teamId: string, matches: Match[]): TeamSeasonStats {
  const stats: TeamSeasonStats = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    home: { wins: 0, draws: 0, losses: 0 },
    away: { wins: 0, draws: 0, losses: 0 },
    currentStreak: null,
    longestWinStreak: 0,
    biggestWin: null,
  }

  const played = matches
    .filter((m) => m.status === 'official' && m.result && (m.homeTeamId === teamId || m.awayTeamId === teamId))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  let winRun = 0
  for (const m of played) {
    const isHome = m.homeTeamId === teamId
    const scored = isHome ? m.result!.homeScore : m.result!.awayScore
    const conceded = isHome ? m.result!.awayScore : m.result!.homeScore
    const side = isHome ? stats.home : stats.away
    const outcome: 'W' | 'D' | 'L' = scored > conceded ? 'W' : scored === conceded ? 'D' : 'L'

    stats.played += 1
    stats.goalsFor += scored
    stats.goalsAgainst += conceded
    if (conceded === 0) stats.cleanSheets += 1

    if (outcome === 'W') {
      stats.wins += 1
      side.wins += 1
      winRun += 1
      stats.longestWinStreak = Math.max(stats.longestWinStreak, winRun)
      const margin = scored - conceded
      if (!stats.biggestWin || margin > stats.biggestWin.scored - stats.biggestWin.conceded) {
        stats.biggestWin = { opponentTeamId: isHome ? m.awayTeamId : m.homeTeamId, scored, conceded }
      }
    } else {
      winRun = 0
      if (outcome === 'D') {
        stats.draws += 1
        side.draws += 1
      } else {
        stats.losses += 1
        side.losses += 1
      }
    }

    if (stats.currentStreak && stats.currentStreak.type === outcome) stats.currentStreak.count += 1
    else stats.currentStreak = { type: outcome, count: 1 }
  }

  return stats
}
