import type { AuditEntry, League, LeaguePrivacy, PlayoffFormat, ScheduleFormat, ScoringRules, Sport, TieBreaker, User } from './types'
import { auditEntry } from './audit'
import { newId } from './ids'
import { resolveMinPlayers } from './team'

export interface CreateLeagueInput {
  name: string
  sport: Sport
  logo: string
  banner: string
  description: string
  country: string
  city: string
  seasonStart: string
  seasonEnd: string
  maxTeams: number
  minTeams: number
  minPlayersPerTeam: number
  maxPlayersPerTeam: number
  scheduleFormat: ScheduleFormat
  playoffFormat: PlayoffFormat
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
    seasonStart: input.seasonStart,
    seasonEnd: input.seasonEnd,
    maxTeams: input.maxTeams,
    minTeams: input.minTeams,
    minPlayersPerTeam: minPlayers,
    maxPlayersPerTeam: input.maxPlayersPerTeam,
    scheduleFormat: input.scheduleFormat,
    playoffFormat: input.playoffFormat,
    scoring: input.scoring,
    tieBreakers: input.tieBreakers,
    privacy: input.privacy,
    commissionerId: commissioner.id,
    refereeIds: [],
    allowTransfers: input.allowTransfers,
    createdAt: now,
  }
  return {
    league,
    audit: [auditEntry(league.id, commissioner.id, 'league.created', `League "${league.name}" created by commissioner @${commissioner.username}.`, now)],
  }
}
