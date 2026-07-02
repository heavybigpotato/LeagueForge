import type { League, Match, Team } from './types'

/**
 * Power Rankings — a weekly, opinionated ordering that goes beyond the
 * table. Unlike standings (pure points), the rating rewards HOW a team is
 * playing: margin of victory (capped so running up the score doesn't pay),
 * strength of the opponent, and recency (this month matters more than
 * opening day). Derived exclusively from verified regular-season results.
 */

export interface PowerRank {
  teamId: string
  rank: number
  /** 0–100 scale. */
  rating: number
  /** Places gained (+) or lost (−) since before the most recent round. */
  movement: number
}

const MARGIN_CAP = 3
const RECENCY_HALF_LIFE = 4 // matches

export function powerRankings(league: League, teams: Team[], matches: Match[]): PowerRank[] {
  const official = teams.filter((t) => t.leagueId === league.id && t.status === 'official')
  if (official.length === 0) return []

  const verified = matches
    .filter((m) => m.leagueId === league.id && m.status === 'official' && m.result && m.stage !== 'playoff')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  const latestRound = Math.max(0, ...verified.map((m) => m.round))
  const current = rate(official, verified)
  const previous = rate(official, verified.filter((m) => m.round !== latestRound))
  const prevRank = new Map(previous.map((r, i) => [r.teamId, i + 1]))

  return current.map((r, i) => ({
    teamId: r.teamId,
    rank: i + 1,
    rating: r.rating,
    movement: (prevRank.get(r.teamId) ?? i + 1) - (i + 1),
  }))
}

function rate(teams: Team[], verified: Match[]): { teamId: string; rating: number }[] {
  // Pass 1: raw per-team result quality with recency weighting.
  const raw = new Map<string, number>(teams.map((t) => [t.id, 0.5]))
  const games = new Map<string, { opp: string; score: number; weight: number }[]>(teams.map((t) => [t.id, []]))

  for (const t of teams) {
    const mine = verified.filter((m) => m.homeTeamId === t.id || m.awayTeamId === t.id)
    mine.forEach((m, idx) => {
      const isHome = m.homeTeamId === t.id
      const scored = isHome ? m.result!.homeScore : m.result!.awayScore
      const conceded = isHome ? m.result!.awayScore : m.result!.homeScore
      const margin = Math.max(-MARGIN_CAP, Math.min(MARGIN_CAP, scored - conceded))
      // 1 for a win, 0.5 draw, 0 loss — nudged by capped margin
      const base = scored > conceded ? 1 : scored === conceded ? 0.5 : 0
      const score = base + margin * 0.06
      const age = mine.length - 1 - idx
      const weight = Math.pow(0.5, age / RECENCY_HALF_LIFE)
      games.get(t.id)!.push({ opp: isHome ? m.awayTeamId : m.homeTeamId, score, weight })
    })
  }

  // Pass 2 (twice): blend in opponent strength so beating good teams counts more.
  for (let pass = 0; pass < 2; pass++) {
    const snapshot = new Map(raw)
    for (const t of teams) {
      const gs = games.get(t.id)!
      if (gs.length === 0) continue
      let total = 0
      let weightSum = 0
      for (const g of gs) {
        const oppStrength = snapshot.get(g.opp) ?? 0.5
        total += (g.score * 0.7 + oppStrength * 0.6 * (g.score >= 0.5 ? 1 : 0.4)) * g.weight
        weightSum += g.weight
      }
      raw.set(t.id, total / weightSum)
    }
  }

  const values = [...raw.values()]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return teams
    .map((t) => ({ teamId: t.id, rating: Math.round(((raw.get(t.id)! - min) / span) * 60 + 35) }))
    .sort((a, b) => b.rating - a.rating || a.teamId.localeCompare(b.teamId))
}
