/**
 * LeagueForge core domain types.
 *
 * Everything in the platform revolves around four guarantees:
 *  - every player has a verified identity
 *  - every team is earned (pending → official)
 *  - every result is verified (both captains or a referee)
 *  - every action is recorded in an immutable audit log
 */

export type Id = string

// ---------------------------------------------------------------- Users

export interface User {
  id: Id
  username: string
  email: string
  phone: string
  emailVerified: boolean
  phoneVerified: boolean
  idVerified: boolean
  deviceFingerprint: string
  reputation: number
  createdAt: number
}

/** A user is eligible to join rosters only once email + phone are verified. */
export function isVerifiedUser(u: User): boolean {
  return u.emailVerified && u.phoneVerified
}

// ---------------------------------------------------------------- Leagues

export type LeaguePrivacy = 'public' | 'private' | 'invite-only'

export type PlayoffFormat =
  | 'none'
  | 'single-elimination'
  | 'double-elimination'
  | 'best-of-series'

export type ScheduleFormat =
  | 'round-robin'
  | 'double-round-robin'
  | 'knockout'
  | 'swiss'
  | 'ladder'
  | 'groups'

export type Sport =
  | 'football'
  | 'basketball'
  | 'volleyball'
  | 'cricket'
  | 'baseball'
  | 'hockey'
  | 'rugby'
  | 'tennis'
  | 'pickleball'
  | 'esports'
  | 'chess'
  | 'custom'

export interface ScoringRules {
  pointsForWin: number
  pointsForDraw: number
  pointsForLoss: number
}

export type TieBreaker =
  | 'goal-difference'
  | 'goals-for'
  | 'head-to-head'
  | 'win-percentage'

/** Platform-wide floor for roster size. League minimums may be raised, never lowered. */
export const PLATFORM_MIN_PLAYERS = 11

export interface League {
  id: Id
  name: string
  sport: Sport
  logo: string // emoji or asset ref
  banner: string
  description: string
  country: string
  city: string
  seasonStart: string // ISO date
  seasonEnd: string
  maxTeams: number
  minTeams: number
  /** Never below PLATFORM_MIN_PLAYERS. */
  minPlayersPerTeam: number
  maxPlayersPerTeam: number
  scheduleFormat: ScheduleFormat
  playoffFormat: PlayoffFormat
  scoring: ScoringRules
  tieBreakers: TieBreaker[]
  privacy: LeaguePrivacy
  commissionerId: Id
  refereeIds: Id[]
  allowTransfers: boolean
  createdAt: number
}

// ---------------------------------------------------------------- Teams

export type TeamStatus = 'pending' | 'official'

export interface Team {
  id: Id
  leagueId: Id
  name: string
  logo: string
  primaryColor: string
  secondaryColor: string
  bio: string
  captainId: Id
  status: TeamStatus
  /** Approved roster members (includes the captain). */
  memberIds: Id[]
  /** Players who joined via invite and await captain approval. */
  pendingMemberIds: Id[]
  inviteCode: string
  /** Set when the team reached the roster minimum and became official. */
  activatedAt?: number
  rosterLocked: boolean
  createdAt: number
}

// ---------------------------------------------------------------- Matches

export type MatchStatus =
  | 'scheduled'
  | 'awaiting-confirmation'
  | 'disputed'
  | 'official'

export interface ScoreSubmission {
  homeScore: number
  awayScore: number
  submittedByTeamId: Id
  submittedByUserId: Id
  at: number
}

export type EvidenceKind =
  | 'photo'
  | 'video'
  | 'score-sheet'
  | 'gps-attendance'
  | 'qr-check-in'
  | 'referee-report'
  | 'witness'

export interface Evidence {
  id: Id
  kind: EvidenceKind
  uploadedBy: Id
  note: string
  at: number
}

export interface CheckIn {
  userId: Id
  teamId: Id
  at: number
  gpsValidated: boolean
}

export interface Match {
  id: Id
  leagueId: Id
  round: number
  homeTeamId: Id
  awayTeamId: Id
  scheduledAt: string // ISO datetime
  venue: string
  status: MatchStatus
  submission?: ScoreSubmission
  /** Present only when status === 'official'. */
  result?: { homeScore: number; awayScore: number; verifiedAt: number; verifiedBy: 'captains' | 'referee' | 'commissioner' }
  disputeReason?: string
  evidence: Evidence[]
  checkIns: CheckIn[]
}

// ---------------------------------------------------------------- Audit log

export type AuditAction =
  | 'league.created'
  | 'team.created'
  | 'team.player-joined'
  | 'team.player-approved'
  | 'team.player-removed'
  | 'team.activated'
  | 'schedule.generated'
  | 'match.score-submitted'
  | 'match.score-confirmed'
  | 'match.disputed'
  | 'match.evidence-added'
  | 'match.check-in'
  | 'match.resolved'

export interface AuditEntry {
  readonly id: Id
  readonly leagueId: Id
  readonly at: number
  readonly actorId: Id
  readonly action: AuditAction
  readonly detail: string
}

// ---------------------------------------------------------------- Standings

export interface StandingRow {
  teamId: Id
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  winPct: number
}
