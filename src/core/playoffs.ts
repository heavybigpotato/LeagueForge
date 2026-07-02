import type { AuditEntry, League, Match, Team } from './types'
import { auditEntry } from './audit'
import { computeStandings } from './standings'
import { newId } from './ids'

/**
 * Single-elimination playoffs seeded from the regular-season standings.
 *
 * The bracket is stored as ordinary matches (stage 'playoff' with
 * round/slot coordinates), so every playoff result goes through the exact
 * same verification pipeline as the regular season: captains submit and
 * confirm, disputes freeze the bracket, the commissioner/referee resolves.
 * Playoff matches never count toward the standings, and playoff matches
 * cannot end in a draw.
 */

export interface BracketSlot {
  round: number
  slot: number
  match?: Match
  /** Team ids when known; undefined while waiting on an earlier round. */
  homeTeamId?: string
  awayTeamId?: string
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

/** Largest power of two ≤ n (bracket size). */
export function bracketSize(officialTeams: number): number {
  let size = 2
  while (size * 2 <= officialTeams && size * 2 <= 16) size *= 2
  return officialTeams >= 2 ? size : 0
}

export function playoffMatches(leagueId: string, matches: Match[]): Match[] {
  return matches.filter((m) => m.leagueId === leagueId && m.stage === 'playoff')
}

export function playoffsStarted(leagueId: string, matches: Match[]): boolean {
  return playoffMatches(leagueId, matches).length > 0
}

/**
 * Seed round 1 from the current standings. Commissioner-only, requires at
 * least two official teams, and can only happen once per season.
 */
export function startPlayoffs(
  league: League,
  teams: Team[],
  matches: Match[],
  actorId: string,
  now: number = Date.now(),
): { matches: Match[]; audit: AuditEntry[] } {
  if (actorId !== league.commissionerId) throw new Error('Only the commissioner can start the playoffs.')
  if (league.playoffFormat === 'none') throw new Error('This league is configured without playoffs.')
  if (playoffsStarted(league.id, matches)) throw new Error('The playoffs have already started.')
  const standings = computeStandings(league, teams, matches)
  const size = bracketSize(standings.length)
  if (size < 2) throw new Error('At least 2 official teams are required to start the playoffs.')

  const seeds = standings.slice(0, size).map((r) => r.teamId)
  const order = seedOrder(size)
  const baseDate = nextSaturday(now)
  const created: Match[] = []
  for (let slot = 0; slot < size / 2; slot++) {
    const homeSeed = order[slot * 2]
    const awaySeed = order[slot * 2 + 1]
    created.push({
      id: newId('match'),
      leagueId: league.id,
      round: 100 + slot,
      homeTeamId: seeds[homeSeed],
      awayTeamId: seeds[awaySeed],
      scheduledAt: new Date(baseDate).toISOString(),
      venue: `${league.city} Arena`,
      status: 'scheduled',
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
        `Playoffs started: top ${size} seeds enter a ${ROUND_NAMES[totalRounds]?.[0] ?? 'bracket'} bracket (${size / 2} ties, seeded from the verified standings).`,
        now,
      ),
    ],
  }
}

/**
 * Called after any result becomes official: creates next-round matches for
 * every decided pair, and reports a champion when the final is verified.
 * Pure — returns only what should be appended.
 */
export function advancePlayoffs(
  league: League,
  matches: Match[],
  actorId: string,
  now: number = Date.now(),
): { matches: Match[]; audit: AuditEntry[]; championTeamId?: string } {
  const po = playoffMatches(league.id, matches)
  if (po.length === 0) return { matches: [], audit: [] }
  const size = firstRoundSize(po)
  const totalRounds = Math.log2(size)
  const created: Match[] = []
  const audit: AuditEntry[] = []

  for (let round = 1; round < totalRounds; round++) {
    const slots = size / Math.pow(2, round + 1)
    for (let slot = 0; slot < slots; slot++) {
      const exists = po.some((m) => m.playoffRound === round + 1 && m.playoffSlot === slot)
      if (exists) continue
      const a = po.find((m) => m.playoffRound === round && m.playoffSlot === slot * 2)
      const b = po.find((m) => m.playoffRound === round && m.playoffSlot === slot * 2 + 1)
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
        venue: `${league.city} Arena`,
        status: 'scheduled',
        stage: 'playoff',
        playoffRound: round + 1,
        playoffSlot: slot,
        evidence: [],
        checkIns: [],
      }
      created.push(next)
      po.push(next)
      const name = ROUND_NAMES[totalRounds]?.[round] ?? `Round ${round + 1}`
      audit.push(auditEntry(league.id, actorId, 'playoffs.advanced', `${name} set: winners advance in the bracket.`, now))
    }
  }

  const final = po.find((m) => m.playoffRound === totalRounds)
  const championTeamId = winnerOf(final)
  return { matches: created, audit, championTeamId }
}

/** Structure the bracket (including undecided future slots) for rendering. */
export function bracket(leagueId: string, matches: Match[]): Bracket | null {
  const po = playoffMatches(leagueId, matches)
  if (po.length === 0) return null
  const size = firstRoundSize(po)
  const totalRounds = Math.log2(size)
  const rounds: BracketSlot[][] = []
  for (let round = 1; round <= totalRounds; round++) {
    const slots = size / Math.pow(2, round)
    const row: BracketSlot[] = []
    for (let slot = 0; slot < slots; slot++) {
      const match = po.find((m) => m.playoffRound === round && m.playoffSlot === slot)
      row.push({ round, slot, match, homeTeamId: match?.homeTeamId, awayTeamId: match?.awayTeamId })
    }
    rounds.push(row)
  }
  const final = po.find((m) => m.playoffRound === totalRounds && m.playoffSlot === 0)
  return {
    rounds,
    roundNames: ROUND_NAMES[totalRounds] ?? rounds.map((_, i) => `Round ${i + 1}`),
    championTeamId: winnerOf(final),
  }
}

/** Human label for a playoff match, e.g. "Semifinal 2" or "Final". */
export function playoffLabel(leagueId: string, matches: Match[], match: Match): string {
  if (match.stage !== 'playoff' || !match.playoffRound) return `Round ${match.round}`
  const po = playoffMatches(leagueId, matches)
  const totalRounds = Math.log2(Math.max(2, firstRoundSize(po)))
  const names = ROUND_NAMES[totalRounds] ?? []
  const name = names[match.playoffRound - 1] ?? `Playoff round ${match.playoffRound}`
  const slotsInRound = firstRoundSize(po) / Math.pow(2, match.playoffRound)
  const singular = name.endsWith('s') ? name.slice(0, -1) : name
  return slotsInRound > 1 ? `${singular} ${(match.playoffSlot ?? 0) + 1}` : name
}

function firstRoundSize(po: Match[]): number {
  const firstRound = po.filter((m) => m.playoffRound === 1)
  return firstRound.length * 2
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
