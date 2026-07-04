import type { AuditEntry, League, Match, Team } from './types'
import { auditEntry } from './audit'
import { newId } from './ids'

/**
 * Single-elimination knockout cups. The bracket is stored as ordinary
 * matches (stage 'playoff' with round/slot coordinates), so every cup tie
 * runs through the exact same verification pipeline as a league game:
 * captains submit and confirm, disputes freeze the tie, a referee or the
 * commissioner resolves. Cup ties never count toward a table and can never
 * end in a draw — someone has to go through.
 *
 * A cup needs a power-of-two field (2, 4, 8, or 16) so the bracket is clean
 * with no byes.
 */

export interface BracketSlot {
  round: number
  slot: number
  match?: Match
}

export interface Bracket {
  rounds: BracketSlot[][]
  roundNames: string[]
  championTeamId?: string
}

const ROUND_NAMES: Record<number, string[]> = {
  1: ['Final'],
  2: ['Semifinals', 'Final'],
  3: ['Quarterfinals', 'Semifinals', 'Final'],
  4: ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'],
}

export const CUP_SIZES = [2, 4, 8, 16] as const

/** A cup draws cleanly only from a power-of-two field. */
export function isValidCupSize(n: number): boolean {
  return (CUP_SIZES as readonly number[]).includes(n)
}

/** Standard bracket order so seed 1 meets seed 2 only in the final. */
function seedOrder(size: number): number[] {
  let order = [0]
  while (order.length < size) {
    const n = order.length * 2
    const next: number[] = []
    for (const s of order) {
      next.push(s)
      next.push(n - 1 - s)
    }
    order = next
  }
  return order
}

export function cupMatches(leagueId: string, matches: Match[], season = 1): Match[] {
  return matches.filter((m) => m.leagueId === leagueId && m.stage === 'playoff' && (m.season ?? 1) === season)
}

export function cupStarted(leagueId: string, matches: Match[], season = 1): boolean {
  return cupMatches(leagueId, matches, season).length > 0
}

/**
 * Draw round 1. Teams are seeded by the order they registered (earliest =
 * top seed). Requires a power-of-two field.
 */
export function drawCup(
  league: League,
  teams: Team[],
  actorId: string,
  now: number = Date.now(),
): { matches: Match[]; audit: AuditEntry[] } {
  if (actorId !== league.commissionerId) throw new Error('Only the commissioner can draw the cup.')
  if (cupStarted(league.id, [], league.currentSeason)) throw new Error('The cup has already been drawn.')
  const size = teams.length
  if (!isValidCupSize(size)) {
    throw new Error(`A cup needs 2, 4, 8, or 16 teams — you have ${size}.`)
  }
  const seeds = teams.slice().sort((a, b) => a.createdAt - b.createdAt).map((t) => t.id)
  const order = seedOrder(size)
  const baseDate = nextSaturday(now)
  const created: Match[] = []
  for (let slot = 0; slot < size / 2; slot++) {
    created.push({
      id: newId('match'),
      leagueId: league.id,
      round: 100 + slot,
      homeTeamId: seeds[order[slot * 2]],
      awayTeamId: seeds[order[slot * 2 + 1]],
      scheduledAt: new Date(baseDate).toISOString(),
      venue: league.homeVenue,
      status: 'scheduled',
      season: league.currentSeason,
      stage: 'playoff',
      playoffRound: 1,
      playoffSlot: slot,
      evidence: [],
      checkIns: [],
    })
  }
  const totalRounds = Math.log2(size)
  return {
    matches: created,
    audit: [
      auditEntry(
        league.id,
        actorId,
        'playoffs.started',
        `The cup is drawn — ${size} teams into the ${ROUND_NAMES[totalRounds]?.[0] ?? 'bracket'}, ${size / 2} ties in round one.`,
        now,
      ),
    ],
  }
}

/**
 * Called after any cup result becomes official: creates next-round ties for
 * every decided pairing, and reports a champion when the final is verified.
 */
export function advanceCup(
  league: League,
  matches: Match[],
  actorId: string,
  now: number = Date.now(),
): { matches: Match[]; audit: AuditEntry[]; championTeamId?: string } {
  const ties = cupMatches(league.id, matches, league.currentSeason)
  if (ties.length === 0) return { matches: [], audit: [] }
  const size = firstRoundSize(ties)
  const totalRounds = Math.log2(size)
  const created: Match[] = []
  const audit: AuditEntry[] = []

  for (let round = 1; round < totalRounds; round++) {
    const slots = size / Math.pow(2, round + 1)
    for (let slot = 0; slot < slots; slot++) {
      const exists = ties.some((m) => m.playoffRound === round + 1 && m.playoffSlot === slot)
      if (exists) continue
      const a = ties.find((m) => m.playoffRound === round && m.playoffSlot === slot * 2)
      const b = ties.find((m) => m.playoffRound === round && m.playoffSlot === slot * 2 + 1)
      const winA = winnerOf(a)
      const winB = winnerOf(b)
      if (!winA || !winB) continue
      const next: Match = {
        id: newId('match'),
        leagueId: league.id,
        round: 100 + round * 10 + slot,
        homeTeamId: winA,
        awayTeamId: winB,
        scheduledAt: new Date(nextSaturday(now)).toISOString(),
        venue: league.homeVenue,
        status: 'scheduled',
        season: league.currentSeason,
        stage: 'playoff',
        playoffRound: round + 1,
        playoffSlot: slot,
        evidence: [],
        checkIns: [],
      }
      created.push(next)
      ties.push(next)
      const name = ROUND_NAMES[totalRounds]?.[round] ?? `Round ${round + 1}`
      audit.push(auditEntry(league.id, actorId, 'playoffs.advanced', `${name} set — winners go through.`, now))
    }
  }

  const final = ties.find((m) => m.playoffRound === totalRounds)
  const championTeamId = winnerOf(final)
  return { matches: created, audit, championTeamId }
}

/** Structure the bracket (including undecided future slots) for rendering. */
export function bracket(leagueId: string, matches: Match[], season = 1): Bracket | null {
  const ties = cupMatches(leagueId, matches, season)
  if (ties.length === 0) return null
  const size = firstRoundSize(ties)
  const totalRounds = Math.log2(size)
  const rounds: BracketSlot[][] = []
  for (let round = 1; round <= totalRounds; round++) {
    const slots = size / Math.pow(2, round)
    const row: BracketSlot[] = []
    for (let slot = 0; slot < slots; slot++) {
      row.push({ round, slot, match: ties.find((m) => m.playoffRound === round && m.playoffSlot === slot) })
    }
    rounds.push(row)
  }
  const final = ties.find((m) => m.playoffRound === totalRounds && m.playoffSlot === 0)
  return {
    rounds,
    roundNames: ROUND_NAMES[totalRounds] ?? rounds.map((_, i) => `Round ${i + 1}`),
    championTeamId: winnerOf(final),
  }
}

/** Human label for a cup tie, e.g. "Semifinal 2" or "Final". */
export function cupLabel(leagueId: string, matches: Match[], match: Match): string {
  if (match.stage !== 'playoff' || !match.playoffRound) return `Round ${match.round}`
  const ties = cupMatches(leagueId, matches, match.season ?? 1)
  const totalRounds = Math.log2(Math.max(2, firstRoundSize(ties)))
  const names = ROUND_NAMES[totalRounds] ?? []
  const name = names[match.playoffRound - 1] ?? `Cup round ${match.playoffRound}`
  const slotsInRound = firstRoundSize(ties) / Math.pow(2, match.playoffRound)
  const singular = name.endsWith('s') ? name.slice(0, -1) : name
  return slotsInRound > 1 ? `${singular} ${(match.playoffSlot ?? 0) + 1}` : name
}

function firstRoundSize(ties: Match[]): number {
  return ties.filter((m) => m.playoffRound === 1).length * 2
}

export function winnerOf(m?: Match): string | undefined {
  if (!m || m.status !== 'official' || !m.result) return undefined
  if (m.result.homeScore === m.result.awayScore) return undefined
  return m.result.homeScore > m.result.awayScore ? m.homeTeamId : m.awayTeamId
}

function nextSaturday(from: number): number {
  const d = new Date(from)
  d.setHours(18, 0, 0, 0)
  const day = d.getDay()
  const delta = ((6 - day + 7) % 7) || 7
  d.setDate(d.getDate() + delta)
  return d.getTime()
}
