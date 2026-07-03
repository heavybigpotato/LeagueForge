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
  /** Salted password hash — accounts are protected, switching requires sign-in. */
  passwordHash: string
  passwordSalt: string
  emailVerified: boolean
  phoneVerified: boolean
  idVerified: boolean
  deviceFingerprint: string
  reputation: number
  /** True only for accounts created by the explicit guided demo. */
  isDemo?: boolean
  createdAt: number
}

/** A user is eligible to join rosters only once email + phone are verified. */
export function isVerifiedUser(u: User): boolean {
  return u.emailVerified && u.phoneVerified
}

// ---------------------------------------------------------------- Leagues

export type LeaguePrivacy = 'public' | 'private' | 'invite-only'

export type ScheduleFormat =
  /** Everyone plays everyone once; a table decides the champion. */
  | 'round-robin'
  /** Single-elimination cup; last team standing wins. */
  | 'knockout'

/** Frozen record of a completed season. */
export interface SeasonRecord {
  season: number
  endedAt: number
  championTeamId?: Id
  /** Regular-season table leader (may differ from the playoff champion). */
  tableLeaderTeamId?: Id
  /** Final table snapshot at the moment the season closed. */
  table: StandingRow[]
}

/** Commissioner bulletin visible to the whole league. */
export interface Announcement {
  id: Id
  authorId: Id
  at: number
  text: string
}

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

/** Platform-wide floor for roster size (re-exported from central config). */
export { PLATFORM_MIN_PLAYERS } from './config'

export interface League {
  id: Id
  name: string
  sport: Sport
  logo: string // emoji or asset ref
  banner: string
  description: string
  country: string
  city: string
  /** Default venue used when generating fixtures. */
  homeVenue: string
  seasonStart: string // ISO date
  seasonEnd: string
  maxTeams: number
  minTeams: number
  /** Never below PLATFORM_MIN_PLAYERS. */
  minPlayersPerTeam: number
  maxPlayersPerTeam: number
  scheduleFormat: ScheduleFormat
  scoring: ScoringRules
  tieBreakers: TieBreaker[]
  privacy: LeaguePrivacy
  /** Short code a captain enters to bring their team into this league. */
  joinCode: string
  commissionerId: Id
  refereeIds: Id[]
  allowTransfers: boolean
  /** True only for the league created by the explicit guided demo. */
  isDemo?: boolean
  /** 1-based; every match is stamped with the season it belongs to. */
  currentSeason: number
  /** Archive of completed seasons, oldest first. */
  seasons: SeasonRecord[]
  announcements: Announcement[]
  createdAt: number
}

// ---------------------------------------------------------------- Teams

export type TeamStatus = 'pending' | 'official'

export interface Team {
  id: Id
  /** League the team currently plays in. Null: a free agent between leagues. */
  leagueId: Id | null
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
  /** Inline image (downscaled data URL) for photo/score-sheet evidence. */
  dataUrl?: string
  at: number
}

export interface CheckIn {
  userId: Id
  teamId: Id
  at: number
  gpsValidated: boolean
}

/** Availability answer for an upcoming fixture. */
export interface Rsvp {
  userId: Id
  teamId: Id
  status: 'in' | 'out'
  at: number
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
  /** Season this match belongs to (older records default to 1). */
  season?: number
  /** Absent/'regular' matches feed the standings; playoff matches feed the bracket. */
  stage?: 'regular' | 'playoff'
  /** Bracket coordinates, set only when stage === 'playoff'. */
  playoffRound?: number
  playoffSlot?: number
  submission?: ScoreSubmission
  /** Present only when status === 'official'. */
  result?: { homeScore: number; awayScore: number; verifiedAt: number; verifiedBy: 'captains' | 'referee' | 'commissioner' }
  disputeReason?: string
  evidence: Evidence[]
  checkIns: CheckIn[]
  /** Availability answers from rostered players (optional for older records). */
  rsvps?: Rsvp[]
}

// ---------------------------------------------------------------- Audit log

export type AuditAction =
  | 'league.created'
  | 'league.updated'
  | 'league.announcement'
  | 'league.referee-assigned'
  | 'season.ended'
  | 'match.rescheduled'
  | 'team.created'
  | 'team.entered-league'
  | 'team.left-league'
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
  | 'match.rsvp'
  | 'match.resolved'
  | 'playoffs.started'
  | 'playoffs.advanced'
  | 'playoffs.champion'

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
