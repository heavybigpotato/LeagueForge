import type { AuditEntry, League, Match, Team, User } from './types'
import { PLATFORM_MIN_PLAYERS, isVerifiedUser } from './types'
import { LIMITS } from './config'
import { auditEntry } from './audit'
import { newId, newInviteCode } from './ids'

export interface TeamEvent {
  team: Team
  audit: AuditEntry[]
  /** True when this operation crossed the roster threshold and activated the team. */
  activated: boolean
}

/**
 * Teams are first-class: anyone can found one, no league required. The team
 * lives on its own — build the roster, go official at the platform minimum,
 * then enter a league (and leave it again between seasons). Leagues come
 * and go; the team keeps its name, colors, and roster.
 */
export function createTeam(
  captain: User,
  input: { name: string; logo: string; primaryColor: string; secondaryColor: string; bio: string },
  existingTeams: Team[],
  now: number = Date.now(),
): TeamEvent {
  if (!isVerifiedUser(captain)) {
    throw new Error('Captain must have a verified email and phone number.')
  }
  const name = input.name.trim()
  if (!name) throw new Error('Team name is required.')
  if (existingTeams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A team with this name already exists.')
  }

  const team: Team = {
    id: newId('team'),
    leagueId: null,
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
  // No league yet, so nothing to audit — league logs record league activity.
  return { team, audit: [], activated: false }
}

/** Roster size floor/cap for a team, from its league or the platform defaults. */
export function rosterBounds(league: League | null): { min: number; max: number } {
  return league
    ? { min: league.minPlayersPerTeam, max: league.maxPlayersPerTeam }
    : { min: PLATFORM_MIN_PLAYERS, max: LIMITS.maxRoster }
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
  league: League | null,
  team: Team,
  player: User,
  allTeams: Team[],
  now: number = Date.now(),
): TeamEvent {
  if (!isVerifiedUser(player)) {
    throw new Error('Players must verify their email and phone number before joining a team.')
  }
  if (league) assertNotInLeague(player.id, league, allTeams)
  if (team.memberIds.includes(player.id) || team.pendingMemberIds.includes(player.id)) {
    throw new Error('You are already on this team.')
  }
  if (team.rosterLocked) throw new Error('The roster is locked for the season.')
  const { max } = rosterBounds(league)
  if (team.memberIds.length + team.pendingMemberIds.length >= max) {
    throw new Error(`The roster is full (maximum ${max} players).`)
  }
  return {
    team: { ...team, pendingMemberIds: [...team.pendingMemberIds, player.id] },
    audit: league
      ? [auditEntry(league.id, player.id, 'team.player-joined', `@${player.username} joined "${team.name}" via invite and awaits captain approval.`, now)]
      : [],
    activated: false,
  }
}

/**
 * Captain approves a pending player. When approval brings the roster to the
 * required minimum — the league's if the team plays in one, the platform
 * floor otherwise — the team automatically becomes an Official Team.
 */
export function approvePlayer(
  league: League | null,
  team: Team,
  approverId: string,
  player: User,
  now: number = Date.now(),
): TeamEvent {
  if (approverId !== team.captainId) throw new Error('Only the team captain can approve players.')
  if (!team.pendingMemberIds.includes(player.id)) throw new Error('This player has no pending request.')
  const { min, max } = rosterBounds(league)
  if (team.memberIds.length >= max) {
    throw new Error(`The roster is full (maximum ${max} players).`)
  }

  let next: Team = {
    ...team,
    memberIds: [...team.memberIds, player.id],
    pendingMemberIds: team.pendingMemberIds.filter((id) => id !== player.id),
  }
  const audit = league
    ? [auditEntry(league.id, approverId, 'team.player-approved', `@${player.username} approved onto "${team.name}" (${next.memberIds.length}/${min} required).`, now)]
    : []

  let activated = false
  if (next.status === 'pending' && next.memberIds.length >= min) {
    next = {
      ...next,
      status: 'official',
      activatedAt: now,
      // Rosters only lock as league policy; a free team keeps recruiting.
      rosterLocked: league ? !league.allowTransfers : false,
    }
    activated = true
    if (league) {
      audit.push(
        auditEntry(league.id, approverId, 'team.activated', `"${team.name}" reached ${min} verified players and is now officially registered in the league.`, now),
      )
    }
  }
  return { team: next, audit, activated }
}

/**
 * Remove a player. An official team can never drop below its minimum —
 * the platform blocks the removal instead of letting the team fall out of
 * compliance.
 */
export function removePlayer(
  league: League | null,
  team: Team,
  removerId: string,
  playerId: string,
  now: number = Date.now(),
): TeamEvent {
  const isCommissioner = league !== null && removerId === league.commissionerId
  if (removerId !== team.captainId && !isCommissioner) {
    throw new Error('Only the captain or the commissioner can remove players.')
  }
  if (playerId === team.captainId) throw new Error('The captain cannot be removed from the team.')
  if (!team.memberIds.includes(playerId)) throw new Error('This player is not on the roster.')
  const { min } = rosterBounds(league)
  if (team.status === 'official' && team.memberIds.length - 1 < min) {
    throw new Error(`Cannot remove: an official team must keep at least ${min} players.`)
  }
  return {
    team: { ...team, memberIds: team.memberIds.filter((id) => id !== playerId) },
    audit: league ? [auditEntry(league.id, removerId, 'team.player-removed', `Player removed from "${team.name}".`, now)] : [],
    activated: false,
  }
}

/**
 * The captain registers their team for a league. A team can register while
 * it's still recruiting — it just can't take the field until it's official
 * (the roster minimum) and the commissioner launches the season. Registration
 * closes once the season kicks off.
 */
export function enterLeague(
  league: League,
  team: Team,
  actorId: string,
  allTeams: Team[],
  /** True once the commissioner has launched the current season (fixtures exist). */
  seasonLaunched = false,
  now: number = Date.now(),
): { team: Team; audit: AuditEntry[] } {
  if (actorId !== team.captainId) throw new Error('Only the team captain can register the team.')
  if (team.leagueId === league.id) throw new Error(`"${team.name}" is already registered here.`)
  if (team.leagueId !== null) throw new Error(`"${team.name}" already plays in another league. Leave it first.`)
  if (seasonLaunched) {
    throw new Error(`${league.name} has already kicked off Season ${league.currentSeason}. You can register next season.`)
  }
  const current = allTeams.filter((t) => t.leagueId === league.id)
  if (current.length >= league.maxTeams) throw new Error(`${league.name} is full (${league.maxTeams} teams).`)
  if (current.some((t) => t.name.toLowerCase() === team.name.toLowerCase())) {
    throw new Error('A team with this name is already registered here.')
  }
  if (team.memberIds.length > league.maxPlayersPerTeam) {
    throw new Error(`${league.name} allows at most ${league.maxPlayersPerTeam} players — you have ${team.memberIds.length}.`)
  }
  for (const t of current) {
    if (team.memberIds.some((id) => t.memberIds.includes(id))) {
      throw new Error(`Someone on your roster is already on "${t.name}" in this league.`)
    }
  }
  // Registration never locks the roster — teams keep recruiting until kickoff.
  const need = team.status === 'official' ? '' : ` (${team.memberIds.length}/${league.minPlayersPerTeam} players — still recruiting)`
  return {
    team: { ...team, leagueId: league.id },
    audit: [
      auditEntry(league.id, actorId, 'team.entered-league', `"${team.name}" registered for ${league.name}${need}.`, now),
    ],
  }
}

/** Teams registered in a league that are ready to play (official). */
export function readyTeams(teams: Team[], leagueId: string): Team[] {
  return teams.filter((t) => t.leagueId === leagueId && t.status === 'official')
}

/** Registered teams still short of the roster minimum. */
export function recruitingTeams(teams: Team[], leagueId: string): Team[] {
  return teams.filter((t) => t.leagueId === leagueId && t.status !== 'official')
}

/**
 * Leave a league — between seasons only. A team with fixtures in the current
 * season stays until the commissioner archives it; nothing ever falls out of
 * a live schedule.
 */
export function leaveLeague(
  league: League,
  team: Team,
  actorId: string,
  matches: Match[],
  now: number = Date.now(),
): { team: Team; audit: AuditEntry[] } {
  if (actorId !== team.captainId && actorId !== league.commissionerId) {
    throw new Error('Only the team captain or the commissioner can withdraw a team.')
  }
  if (team.leagueId !== league.id) throw new Error(`"${team.name}" is not in this league.`)
  const hasFixtures = matches.some(
    (m) =>
      m.leagueId === league.id &&
      (m.season ?? 1) === league.currentSeason &&
      (m.homeTeamId === team.id || m.awayTeamId === team.id),
  )
  if (hasFixtures) {
    throw new Error(`"${team.name}" has fixtures in Season ${league.currentSeason}. Teams can leave between seasons.`)
  }
  return {
    team: { ...team, leagueId: null, rosterLocked: false },
    audit: [auditEntry(league.id, actorId, 'team.left-league', `"${team.name}" left ${league.name}.`, now)],
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
