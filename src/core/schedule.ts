import type { League, Match, Team } from './types'
import { newId } from './ids'

/**
 * Round-robin fixture generation (circle method). Only official teams are
 * ever scheduled — pending teams do not exist as far as the league calendar
 * is concerned.
 */
export function generateRoundRobin(
  league: League,
  teams: Team[],
  opts: { double?: boolean; startDate?: Date; venue?: string } = {},
): Match[] {
  const official = teams.filter((t) => t.status === 'official')
  if (official.length < 2) return []

  const ids = official.map((t) => t.id)
  if (ids.length % 2 === 1) ids.push('__bye__')
  const n = ids.length
  const roundsCount = n - 1
  const half = n / 2
  const start = opts.startDate ?? new Date(league.seasonStart)

  const matches: Match[] = []
  const rotation = [...ids]
  for (let round = 0; round < roundsCount; round++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i]
      const away = rotation[n - 1 - i]
      if (home === '__bye__' || away === '__bye__') continue
      const date = new Date(start.getTime() + round * 7 * 24 * 3600 * 1000)
      matches.push(makeMatch(league, round + 1, home, away, date, opts.venue))
      if (opts.double) {
        const returnDate = new Date(start.getTime() + (round + roundsCount) * 7 * 24 * 3600 * 1000)
        matches.push(makeMatch(league, round + 1 + roundsCount, away, home, returnDate, opts.venue))
      }
    }
    // rotate all but the first element
    rotation.splice(1, 0, rotation.pop() as string)
  }
  return matches
}

function makeMatch(league: League, round: number, homeTeamId: string, awayTeamId: string, date: Date, venue?: string): Match {
  return {
    id: newId('match'),
    leagueId: league.id,
    round,
    homeTeamId,
    awayTeamId,
    scheduledAt: date.toISOString(),
    venue: venue ?? league.homeVenue,
    status: 'scheduled',
    evidence: [],
    checkIns: [],
  }
}
