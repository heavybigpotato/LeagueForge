import type { AuditEntry, League, Team, User } from './types'
import { PLATFORM_MIN_PLAYERS, isVerifiedUser } from './types'
import { auditEntry } from './audit'
import { newId, newInviteCode } from './ids'

export interface TeamEvent {
  team: Team
  audit: AuditEntry[]
  /** True when this operation crossed the roster threshold and activated the team. */
  activated: boolean
}

/**
 * Create a Pending Team. The team is NOT part of the league: it cannot play
 * matches, be scheduled, or appear in standings until it reaches the league's
 * minimum roster size and becomes official.
 */
export function createPendingTeam(
  league: League,
  captain: User,
  input: { name: string; logo: string; primaryColor: string; secondaryColor: string; bio: string },
  existingTeams: Team[],
  now: number = Date.now(),
): TeamEvent {
  if (!isVerifiedUser(captain)) {
    throw new Error('Captain must have a verified email and phone number.')
  }
  assertNotInLeague(captain.id, league, existingTeams)
  const name = input.name.trim()
  if (!name) throw new Error('Team name is required.')
  if (existingTeams.some((t) => t.leagueId === league.id && t.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A team with this name already exists in the league.')
  }

  const team: Team = {
    id: newId('team'),
    leagueId: league.id,
    name,
    logo: input.logo,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    bio: input.bio,
    captainId: captain.id,
    status: 'pending',
    memberIds: [captain.id],
    pendingMemberIds: [],
    inviteCode: newInviteCode(),
    rosterLocked: false,
    createdAt: now,
  }
  return {
    team,
    audit: [
      auditEntry(league.id, captain.id, 'team.created', `Pending team "${team.name}" created by @${captain.username}.`, now),
    ],
    activated: false,
  }
}

function assertNotInLeague(userId: string, league: League, teams: Team[]) {
  const inLeague = teams.some(
    (t) =>
      t.leagueId === league.id &&
      (t.memberIds.includes(userId) || t.pendingMemberIds.includes(userId)),
  )
  if (inLeague) {
    throw new Error('This account is already on a team in this league.')
  }
}

/**
 * A player joins via invite link / code / QR. They land in the captain's
 * approval queue — joining never adds someone straight to the roster.
 */
export function requestJoin(
  league: League,
  team: Team,
  player: User,
  allTeams: Team[],
  now: number = Date.now(),
): TeamEvent {
  if (!isVerifiedUser(player)) {
    throw new Error('Players must verify their email and phone number before joining a team.')
  }
  assertNotInLeague(player.id, league, allTeams)
  if (team.rosterLocked) throw new Error('The roster is locked for the season.')
  if (team.memberIds.length + team.pendingMemberIds.length >= league.maxPlayersPerTeam) {
    throw new Error(`The roster is full (maximum ${league.maxPlayersPerTeam} players).`)
  }
  return {
    team: { ...team, pendingMemberIds: [...team.pendingMemberIds, player.id] },
    audit: [
      auditEntry(league.id, player.id, 'team.player-joined', `@${player.username} joined "${team.name}" via invite and awaits captain approval.`, now),
    ],
    activated: false,
  }
}

/**
 * Captain approves a pending player. If approval brings the roster to the
 * league minimum, the team is automatically activated: it becomes an
 * Official Team, enters the league, and its roster locks for the season
 * (unless the league allows transfers).
 */
export function approvePlayer(
  league: League,
  team: Team,
  approverId: string,
  player: User,
  now: number = Date.now(),
): TeamEvent {
  if (approverId !== team.captainId) throw new Error('Only the team captain can approve players.')
  if (!team.pendingMemberIds.includes(player.id)) throw new Error('This player has no pending request.')
  if (team.memberIds.length >= league.maxPlayersPerTeam) {
    throw new Error(`The roster is full (maximum ${league.maxPlayersPerTeam} players).`)
  }

  let next: Team = {
    ...team,
    memberIds: [...team.memberIds, player.id],
    pendingMemberIds: team.pendingMemberIds.filter((id) => id !== player.id),
  }
  const audit = [
    auditEntry(league.id, approverId, 'team.player-approved', `@${player.username} approved onto "${team.name}" (${next.memberIds.length}/${league.minPlayersPerTeam} required).`, now),
  ]

  let activated = false
  if (next.status === 'pending' && next.memberIds.length >= league.minPlayersPerTeam) {
    next = {
      ...next,
      status: 'official',
      activatedAt: now,
      rosterLocked: !league.allowTransfers,
    }
    activated = true
    audit.push(
      auditEntry(league.id, approverId, 'team.activated', `"${team.name}" reached ${league.minPlayersPerTeam} verified players and is now officially registered in the league.`, now),
    )
  }
  return { team: next, audit, activated }
}

/**
 * Remove a player. An official team can never drop below the league minimum —
 * the platform blocks the removal instead of letting the team fall out of
 * compliance mid-season.
 */
export function removePlayer(
  league: League,
  team: Team,
  removerId: string,
  playerId: string,
  now: number = Date.now(),
): TeamEvent {
  const isCommissioner = removerId === league.commissionerId
  if (removerId !== team.captainId && !isCommissioner) {
    throw new Error('Only the captain or the commissioner can remove players.')
  }
  if (playerId === team.captainId) throw new Error('The captain cannot be removed from the team.')
  if (!team.memberIds.includes(playerId)) throw new Error('This player is not on the roster.')
  if (team.status === 'official' && team.memberIds.length - 1 < league.minPlayersPerTeam) {
    throw new Error(`Cannot remove: an official team must keep at least ${league.minPlayersPerTeam} players.`)
  }
  return {
    team: { ...team, memberIds: team.memberIds.filter((id) => id !== playerId) },
    audit: [auditEntry(league.id, removerId, 'team.player-removed', `Player removed from "${team.name}".`, now)],
    activated: false,
  }
}

/**
 * League roster minimums may be raised above the platform floor (e.g. for
 * sports with larger squads) but can never go below it.
 */
export function resolveMinPlayers(requested: number): number {
  return Math.max(PLATFORM_MIN_PLAYERS, Math.floor(requested))
}

/** Teams eligible for scheduling and standings. */
export function officialTeams(teams: Team[], leagueId: string): Team[] {
  return teams.filter((t) => t.leagueId === leagueId && t.status === 'official')
}
