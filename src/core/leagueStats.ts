import type { League, Match, Team } from './types'
import { computeStandings } from './standings'

/**
 * League-wide season stats for the visual "Season stats" panel, derived from
 * verified regular-season results of the current season only.
 */

export interface LeagueSeasonStats {
  played: number
  goals: number
  avgGoals: number
  /** Result split for the donut. */
  results: { homeWins: number; awayWins: number; draws: number }
  /** Goals scored per round, for the bar chart (round order). */
  goalsByRound: { round: number; goals: number }[]
  topAttack?: { teamId: string; value: number }
  bestDefense?: { teamId: string; value: number }
  mostWins?: { teamId: string; value: number }
  biggestWin?: { matchId: string; homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number; margin: number }
  highestScoring?: { matchId: string; homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number; total: number }
}

export function leagueSeasonStats(league: League, teams: Team[], matches: Match[]): LeagueSeasonStats {
  const verified = matches.filter(
    (m) =>
      m.leagueId === league.id &&
      m.status === 'official' &&
      m.result &&
      m.stage !== 'playoff' &&
      (m.season ?? 1) === league.currentSeason,
  )

  let goals = 0
  let homeWins = 0
  let awayWins = 0
  let draws = 0
  const byRound = new Map<number, number>()
  let biggestWin: LeagueSeasonStats['biggestWin']
  let highestScoring: LeagueSeasonStats['highestScoring']

  for (const m of verified) {
    const { homeScore, awayScore } = m.result!
    const total = homeScore + awayScore
    goals += total
    if (homeScore > awayScore) homeWins += 1
    else if (awayScore > homeScore) awayWins += 1
    else draws += 1
    byRound.set(m.round, (byRound.get(m.round) ?? 0) + total)

    const margin = Math.abs(homeScore - awayScore)
    if (margin > 0 && (!biggestWin || margin > biggestWin.margin)) {
      biggestWin = { matchId: m.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeScore, awayScore, margin }
    }
    if (!highestScoring || total > highestScoring.total) {
      highestScoring = { matchId: m.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeScore, awayScore, total }
    }
  }

  const rows = computeStandings(league, teams, matches).filter((r) => r.played > 0)
  const best = (pick: (r: (typeof rows)[number]) => number, dir: 1 | -1): { teamId: string; value: number } | undefined => {
    if (rows.length === 0) return undefined
    const winner = rows.reduce((a, b) => (dir === 1 ? (pick(b) > pick(a) ? b : a) : pick(b) < pick(a) ? b : a))
    return { teamId: winner.teamId, value: pick(winner) }
  }

  return {
    played: verified.length,
    goals,
    avgGoals: verified.length ? Math.round((goals / verified.length) * 10) / 10 : 0,
    results: { homeWins, awayWins, draws },
    goalsByRound: [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, g]) => ({ round, goals: g })),
    topAttack: best((r) => r.goalsFor, 1),
    bestDefense: best((r) => r.goalsAgainst, -1),
    mostWins: best((r) => r.wins, 1),
    biggestWin,
    highestScoring,
  }
}
