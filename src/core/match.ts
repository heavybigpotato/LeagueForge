import type { AuditEntry, Evidence, EvidenceKind, League, Match, Team, User } from './types'
import { auditEntry } from './audit'
import { newId } from './ids'

export interface MatchEvent {
  match: Match
  audit: AuditEntry[]
}

/**
 * Match verification state machine.
 *
 *   scheduled ──submit──▶ awaiting-confirmation ──confirm──▶ official
 *                                   │
 *                                dispute
 *                                   ▼
 *                               disputed ──commissioner/referee──▶ official
 *
 * No score ever touches the standings until the match is `official`.
 */

export function submitScore(
  league: League,
  match: Match,
  team: Team,
  submitter: User,
  homeScore: number,
  awayScore: number,
  now: number = Date.now(),
): MatchEvent {
  if (match.status !== 'scheduled') throw new Error('A score has already been submitted for this match.')
  if (team.id !== match.homeTeamId && team.id !== match.awayTeamId) {
    throw new Error('Only a competing team can submit a score.')
  }
  if (submitter.id !== team.captainId) throw new Error('Only the team captain can submit scores.')
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
    throw new Error('Scores must be non-negative whole numbers.')
  }
  return {
    match: {
      ...match,
      status: 'awaiting-confirmation',
      submission: { homeScore, awayScore, submittedByTeamId: team.id, submittedByUserId: submitter.id, at: now },
    },
    audit: [
      auditEntry(league.id, submitter.id, 'match.score-submitted', `@${submitter.username} submitted ${homeScore}–${awayScore} for "${team.name}". Awaiting opponent confirmation.`, now),
    ],
  }
}

/** The opposing captain confirms — the result becomes official. */
export function confirmScore(league: League, match: Match, opposingTeam: Team, confirmer: User, now: number = Date.now()): MatchEvent {
  const sub = requireSubmission(match, 'awaiting-confirmation')
  assertOpposingCaptain(match, sub.submittedByTeamId, opposingTeam, confirmer)
  return {
    match: {
      ...match,
      status: 'official',
      result: { homeScore: sub.homeScore, awayScore: sub.awayScore, verifiedAt: now, verifiedBy: 'captains' },
    },
    audit: [
      auditEntry(league.id, confirmer.id, 'match.score-confirmed', `@${confirmer.username} confirmed the result ${sub.homeScore}–${sub.awayScore}. Match is official; standings updated.`, now),
    ],
  }
}

/** The opposing captain disputes — standings stay frozen, commissioner is notified. */
export function disputeScore(league: League, match: Match, opposingTeam: Team, disputer: User, reason: string, now: number = Date.now()): MatchEvent {
  const sub = requireSubmission(match, 'awaiting-confirmation')
  assertOpposingCaptain(match, sub.submittedByTeamId, opposingTeam, disputer)
  return {
    match: { ...match, status: 'disputed', disputeReason: reason },
    audit: [
      auditEntry(league.id, disputer.id, 'match.disputed', `@${disputer.username} disputed the submitted score (${reason || 'no reason given'}). Standings frozen; commissioner notified; evidence requested.`, now),
    ],
  }
}

/** Commissioner or an assigned referee resolves a dispute with the final score. */
export function resolveDispute(
  league: League,
  match: Match,
  resolver: User,
  homeScore: number,
  awayScore: number,
  now: number = Date.now(),
): MatchEvent {
  if (match.status !== 'disputed') throw new Error('Only disputed matches can be resolved.')
  const isReferee = league.refereeIds.includes(resolver.id)
  if (resolver.id !== league.commissionerId && !isReferee) {
    throw new Error('Only the commissioner or an assigned referee can resolve disputes.')
  }
  return {
    match: {
      ...match,
      status: 'official',
      result: { homeScore, awayScore, verifiedAt: now, verifiedBy: isReferee ? 'referee' : 'commissioner' },
    },
    audit: [
      auditEntry(league.id, resolver.id, 'match.resolved', `Dispute resolved by ${isReferee ? 'referee' : 'commissioner'} @${resolver.username}: final score ${homeScore}–${awayScore}.`, now),
    ],
  }
}

export function addEvidence(league: League, match: Match, uploader: User, kind: EvidenceKind, note: string, now: number = Date.now()): MatchEvent {
  const evidence: Evidence = { id: newId('ev'), kind, uploadedBy: uploader.id, note, at: now }
  return {
    match: { ...match, evidence: [...match.evidence, evidence] },
    audit: [auditEntry(league.id, uploader.id, 'match.evidence-added', `@${uploader.username} uploaded ${kind} evidence: ${note}`, now)],
  }
}

/** Commissioner moves a fixture to a new date and/or venue. */
export function rescheduleMatch(
  league: League,
  match: Match,
  actorId: string,
  changes: { scheduledAt?: string; venue?: string },
  now: number = Date.now(),
): MatchEvent {
  if (actorId !== league.commissionerId) throw new Error('Only the commissioner can reschedule a match.')
  if (match.status !== 'scheduled') throw new Error('Only unplayed fixtures can be rescheduled.')
  const scheduledAt = changes.scheduledAt ?? match.scheduledAt
  if (Number.isNaN(new Date(scheduledAt).getTime())) throw new Error('Enter a valid date and time.')
  const venue = changes.venue?.trim() || match.venue
  return {
    match: { ...match, scheduledAt, venue },
    audit: [
      auditEntry(
        league.id,
        actorId,
        'match.rescheduled',
        `Fixture moved to ${new Date(scheduledAt).toLocaleString()} at ${venue}.`,
        now,
      ),
    ],
  }
}

/**
 * RSVP availability for an upcoming fixture. Only rostered players on a
 * competing team can answer; answers can be changed until kickoff. Captains
 * see the headcount at a glance — no more chasing 11 people in a group chat.
 */
export function rsvp(
  league: League,
  match: Match,
  user: User,
  team: Team,
  status: 'in' | 'out',
  now: number = Date.now(),
): MatchEvent {
  if (match.status !== 'scheduled') throw new Error('RSVPs are open only before the match is played.')
  if (team.id !== match.homeTeamId && team.id !== match.awayTeamId) {
    throw new Error('Only players on a competing team can RSVP.')
  }
  if (!team.memberIds.includes(user.id)) throw new Error('Only rostered players can RSVP.')
  const others = (match.rsvps ?? []).filter((r) => r.userId !== user.id)
  return {
    match: { ...match, rsvps: [...others, { userId: user.id, teamId: team.id, status, at: now }] },
    audit: [
      auditEntry(league.id, user.id, 'match.rsvp', `@${user.username} is ${status === 'in' ? 'IN' : 'OUT'} for ${team.name}'s upcoming fixture.`, now),
    ],
  }
}

/** Headcount for one side of a fixture. */
export function rsvpCount(match: Match, teamId: string): { in: number; out: number } {
  const rs = (match.rsvps ?? []).filter((r) => r.teamId === teamId)
  return { in: rs.filter((r) => r.status === 'in').length, out: rs.filter((r) => r.status === 'out').length }
}

/** QR check-in before the match records time, attendance, team and match. */
export function checkIn(league: League, match: Match, user: User, teamId: string, gpsValidated: boolean, now: number = Date.now()): MatchEvent {
  if (match.checkIns.some((c) => c.userId === user.id)) throw new Error('Already checked in.')
  return {
    match: { ...match, checkIns: [...match.checkIns, { userId: user.id, teamId, at: now, gpsValidated }] },
    audit: [auditEntry(league.id, user.id, 'match.check-in', `@${user.username} checked in via QR${gpsValidated ? ' (GPS validated)' : ''}.`, now)],
  }
}

function requireSubmission(match: Match, expected: Match['status']) {
  if (match.status !== expected || !match.submission) {
    throw new Error('There is no score awaiting confirmation for this match.')
  }
  return match.submission
}

function assertOpposingCaptain(match: Match, submittedByTeamId: string, team: Team, user: User) {
  if (team.id === submittedByTeamId) throw new Error('The submitting team cannot confirm its own score.')
  if (team.id !== match.homeTeamId && team.id !== match.awayTeamId) throw new Error('Only the opposing team can respond.')
  if (user.id !== team.captainId) throw new Error('Only the opposing captain can respond to a submitted score.')
}
