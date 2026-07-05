import type { AuditEntry, League, LeaguePrivacy, ScheduleFormat, ScoringRules, Sport, TieBreaker, User } from './types'
import { auditEntry } from './audit'
import { newId, newInviteCode } from './ids'
import { resolveMinPlayers } from './team'
export type { ScoringRules }

export interface CreateLeagueInput {
  name: string
  sport: Sport
  logo: string
  banner: string
  description: string
  country: string
  city: string
  homeVenue?: string
  seasonStart: string
  seasonEnd: string
  maxTeams: number
  minTeams: number
  minPlayersPerTeam: number
  maxPlayersPerTeam: number
  scheduleFormat: ScheduleFormat
  scoring: ScoringRules
  tieBreakers: TieBreaker[]
  privacy: LeaguePrivacy
  allowTransfers: boolean
}

export function createLeague(
  commissioner: User,
  input: CreateLeagueInput,
  now: number = Date.now(),
): { league: League; audit: AuditEntry[] } {
  const name = input.name.trim()
  if (!name) throw new Error('League name is required.')
  if (new Date(input.seasonEnd) <= new Date(input.seasonStart)) {
    throw new Error('Season end must be after season start.')
  }
  if (input.minTeams < 2) throw new Error('A league needs at least 2 teams.')
  if (input.maxTeams < input.minTeams) throw new Error('Maximum teams cannot be below minimum teams.')

  // The roster minimum can be raised above the platform floor, never lowered.
  const minPlayers = resolveMinPlayers(input.minPlayersPerTeam)
  if (input.maxPlayersPerTeam < minPlayers) {
    throw new Error(`Maximum players per team cannot be below the minimum (${minPlayers}).`)
  }

  const league: League = {
    id: newId('league'),
    name,
    sport: input.sport,
    logo: input.logo,
    banner: input.banner,
    description: input.description,
    country: input.country,
    city: input.city,
    homeVenue: input.homeVenue?.trim() || `${input.city || 'Local'} Arena`,
    seasonStart: input.seasonStart,
    seasonEnd: input.seasonEnd,
    maxTeams: input.maxTeams,
    minTeams: input.minTeams,
    minPlayersPerTeam: minPlayers,
    maxPlayersPerTeam: input.maxPlayersPerTeam,
    scheduleFormat: input.scheduleFormat,
    scoring: input.scoring,
    tieBreakers: input.tieBreakers,
    privacy: input.privacy,
    joinCode: newInviteCode(),
    commissionerId: commissioner.id,
    refereeIds: [],
    allowTransfers: input.allowTransfers,
    currentSeason: 1,
    seasons: [],
    announcements: [],
    createdAt: now,
  }
  return {
    league,
    audit: [auditEntry(league.id, commissioner.id, 'league.created', `League "${league.name}" created by commissioner @${commissioner.username}.`, now)],
  }
}

export interface UpdateLeagueInput {
  description?: string
  homeVenue?: string
  privacy?: LeaguePrivacy
  allowTransfers?: boolean
  scoring?: ScoringRules
  /** Can be raised, never lowered below the platform floor or current value's floor. */
  minPlayersPerTeam?: number
  maxPlayersPerTeam?: number
}

/** Commissioner-only settings edit. Structural rules stay guarded. */
export function updateLeague(
  league: League,
  actorId: string,
  input: UpdateLeagueInput,
  now: number = Date.now(),
): { league: League; audit: AuditEntry[] } {
  if (actorId !== league.commissionerId) throw new Error('Only the commissioner can edit league settings.')
  const minPlayers = input.minPlayersPerTeam !== undefined ? resolveMinPlayers(input.minPlayersPerTeam) : league.minPlayersPerTeam
  const maxPlayers = input.maxPlayersPerTeam ?? league.maxPlayersPerTeam
  if (maxPlayers < minPlayers) throw new Error(`Maximum players per team cannot be below the minimum (${minPlayers}).`)
  if (input.scoring) {
    const { pointsForWin, pointsForDraw, pointsForLoss } = input.scoring
    if (![pointsForWin, pointsForDraw, pointsForLoss].every((p) => Number.isInteger(p) && p >= 0)) {
      throw new Error('Scoring points must be non-negative whole numbers.')
    }
    if (pointsForWin <= pointsForDraw) throw new Error('A win must be worth more than a draw.')
  }
  const next: League = {
    ...league,
    description: input.description ?? league.description,
    homeVenue: input.homeVenue?.trim() || league.homeVenue,
    privacy: input.privacy ?? league.privacy,
    allowTransfers: input.allowTransfers ?? league.allowTransfers,
    scoring: input.scoring ?? league.scoring,
    minPlayersPerTeam: minPlayers,
    maxPlayersPerTeam: maxPlayers,
  }
  return {
    league: next,
    audit: [auditEntry(league.id, actorId, 'league.updated', 'League settings updated by the commissioner.', now)],
  }
}

/** Commissioner posts a bulletin the whole league can see. */
export function postAnnouncement(
  league: League,
  author: User,
  text: string,
  now: number = Date.now(),
): { league: League; audit: AuditEntry[] } {
  if (author.id !== league.commissionerId) throw new Error('Only the commissioner can post announcements.')
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Announcement cannot be empty.')
  const announcement = { id: newId('ann'), authorId: author.id, at: now, text: trimmed }
  return {
    league: { ...league, announcements: [...league.announcements, announcement] },
    audit: [auditEntry(league.id, author.id, 'league.announcement', `Commissioner announcement: ${trimmed.slice(0, 120)}`, now)],
  }
}

/** Commissioner assigns (or removes) an account as league referee. */
export function setReferee(
  league: League,
  actorId: string,
  referee: User,
  assign: boolean,
  now: number = Date.now(),
): { league: League; audit: AuditEntry[] } {
  if (actorId !== league.commissionerId) throw new Error('Only the commissioner can assign referees.')
  const refereeIds = assign
    ? [...new Set([...league.refereeIds, referee.id])]
    : league.refereeIds.filter((id) => id !== referee.id)
  return {
    league: { ...league, refereeIds },
    audit: [
      auditEntry(league.id, actorId, 'league.referee-assigned', `@${referee.username} ${assign ? 'assigned as' : 'removed as'} league referee.`, now),
    ],
  }
}
