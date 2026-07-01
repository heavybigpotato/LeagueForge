import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { AuditEntry, League, Match, Team, User } from '../core/types'
import { createLeague, type CreateLeagueInput } from '../core/league'
import { approvePlayer, createPendingTeam, officialTeams, requestJoin } from '../core/team'
import { generateRoundRobin } from '../core/schedule'
import { addEvidence, checkIn, confirmScore, disputeScore, resolveDispute, submitScore } from '../core/match'
import type { EvidenceKind } from '../core/types'
import { seedDemoData } from './seed'

export interface Notification {
  id: number
  text: string
  kind: 'success' | 'info' | 'error'
}

export interface AppState {
  users: User[]
  currentUserId: string
  leagues: League[]
  teams: Team[]
  matches: Match[]
  auditLog: AuditEntry[]
  notifications: Notification[]
}

type Action =
  | { type: 'set'; state: AppState }
  | { type: 'notify'; text: string; kind: Notification['kind'] }
  | { type: 'dismiss'; id: number }

const STORAGE_KEY = 'leagueforge-state-v1'
let notifSeq = 1

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...(JSON.parse(raw) as AppState), notifications: [] }
  } catch {
    /* corrupted state falls through to a fresh seed */
  }
  return seedDemoData()
}

function persist(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, notifications: [] }))
  } catch {
    /* storage may be unavailable; the app still works in-memory */
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set':
      persist(action.state)
      return action.state
    case 'notify':
      return {
        ...state,
        notifications: [...state.notifications, { id: notifSeq++, text: action.text, kind: action.kind }],
      }
    case 'dismiss':
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) }
  }
}

export interface StoreApi {
  state: AppState
  currentUser: User
  switchUser(userId: string): void
  resetDemo(): void
  dismiss(id: number): void
  createLeague(input: CreateLeagueInput): League | undefined
  createTeam(leagueId: string, input: { name: string; logo: string; primaryColor: string; secondaryColor: string; bio: string }): Team | undefined
  joinByCode(code: string): Team | undefined
  approvePlayer(teamId: string, playerId: string): void
  generateSchedule(leagueId: string): void
  submitScore(matchId: string, homeScore: number, awayScore: number): void
  confirmScore(matchId: string): void
  disputeScore(matchId: string, reason: string): void
  resolveDispute(matchId: string, homeScore: number, awayScore: number): void
  addEvidence(matchId: string, kind: EvidenceKind, note: string): void
  checkIn(matchId: string, teamId: string): void
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  const api = useMemo<StoreApi>(() => {
    const currentUser = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]

    const commit = (next: AppState, message?: string, kind: Notification['kind'] = 'success') => {
      dispatch({ type: 'set', state: next })
      if (message) dispatch({ type: 'notify', text: message, kind })
    }
    const fail = (e: unknown) => {
      dispatch({ type: 'notify', text: e instanceof Error ? e.message : String(e), kind: 'error' })
      return undefined
    }
    const leagueOf = (leagueId: string) => {
      const league = state.leagues.find((l) => l.id === leagueId)
      if (!league) throw new Error('League not found.')
      return league
    }
    const matchCtx = (matchId: string) => {
      const match = state.matches.find((m) => m.id === matchId)
      if (!match) throw new Error('Match not found.')
      return { match, league: leagueOf(match.leagueId) }
    }
    const replaceMatch = (match: Match, audit: AuditEntry[]): AppState => ({
      ...state,
      matches: state.matches.map((m) => (m.id === match.id ? match : m)),
      auditLog: [...state.auditLog, ...audit],
    })

    return {
      state,
      currentUser,
      switchUser: (userId) => commit({ ...state, currentUserId: userId }),
      resetDemo: () => {
        localStorage.removeItem(STORAGE_KEY)
        commit(seedDemoData(), 'Demo data reset.', 'info')
      },
      dismiss: (id) => dispatch({ type: 'dismiss', id }),

      createLeague: (input) => {
        try {
          const { league, audit } = createLeague(currentUser, input)
          commit(
            { ...state, leagues: [...state.leagues, league], auditLog: [...state.auditLog, ...audit] },
            `League "${league.name}" created. You are the commissioner.`,
          )
          return league
        } catch (e) {
          return fail(e)
        }
      },

      createTeam: (leagueId, input) => {
        try {
          const league = leagueOf(leagueId)
          const { team, audit } = createPendingTeam(league, currentUser, input, state.teams)
          commit(
            { ...state, teams: [...state.teams, team], auditLog: [...state.auditLog, ...audit] },
            `Pending team "${team.name}" created. Share invite code ${team.inviteCode} — you need ${league.minPlayersPerTeam} players to activate.`,
          )
          return team
        } catch (e) {
          return fail(e)
        }
      },

      joinByCode: (code) => {
        try {
          const team = state.teams.find((t) => t.inviteCode.toUpperCase() === code.trim().toUpperCase())
          if (!team) throw new Error('No team found for this invite code.')
          const league = leagueOf(team.leagueId)
          const { team: next, audit } = requestJoin(league, team, currentUser, state.teams)
          commit(
            { ...state, teams: state.teams.map((t) => (t.id === next.id ? next : t)), auditLog: [...state.auditLog, ...audit] },
            `Join request sent to "${team.name}". The captain will review your request.`,
          )
          return next
        } catch (e) {
          return fail(e)
        }
      },

      approvePlayer: (teamId, playerId) => {
        try {
          const team = state.teams.find((t) => t.id === teamId)
          if (!team) throw new Error('Team not found.')
          const league = leagueOf(team.leagueId)
          const player = state.users.find((u) => u.id === playerId)
          if (!player) throw new Error('Player not found.')
          const event = approvePlayer(league, team, currentUser.id, player)
          commit(
            { ...state, teams: state.teams.map((t) => (t.id === event.team.id ? event.team : t)), auditLog: [...state.auditLog, ...event.audit] },
            event.activated
              ? `🎉 Congratulations! "${team.name}" is now officially registered in ${league.name}. The commissioner has been notified.`
              : `@${player.username} approved (${event.team.memberIds.length}/${league.minPlayersPerTeam}).`,
          )
        } catch (e) {
          fail(e)
        }
      },

      generateSchedule: (leagueId) => {
        try {
          const league = leagueOf(leagueId)
          if (currentUser.id !== league.commissionerId) throw new Error('Only the commissioner can generate the schedule.')
          const eligible = officialTeams(state.teams, leagueId)
          if (eligible.length < 2) throw new Error('At least 2 official teams are required to generate fixtures.')
          const fixtures = generateRoundRobin(league, eligible, { double: league.scheduleFormat === 'double-round-robin' })
          const withoutOld = state.matches.filter((m) => !(m.leagueId === leagueId && m.status === 'scheduled'))
          commit(
            { ...state, matches: [...withoutOld, ...fixtures] },
            `Schedule generated: ${fixtures.length} fixtures for ${eligible.length} official teams.`,
          )
        } catch (e) {
          fail(e)
        }
      },

      submitScore: (matchId, homeScore, awayScore) => {
        try {
          const { match, league } = matchCtx(matchId)
          const team = state.teams.find(
            (t) => (t.id === match.homeTeamId || t.id === match.awayTeamId) && t.captainId === currentUser.id,
          )
          if (!team) throw new Error('Only a competing captain can submit a score.')
          const event = submitScore(league, match, team, currentUser, homeScore, awayScore)
          commit(replaceMatch(event.match, event.audit), 'Score submitted. The opposing captain has been notified to confirm or dispute.')
        } catch (e) {
          fail(e)
        }
      },

      confirmScore: (matchId) => {
        try {
          const { match, league } = matchCtx(matchId)
          const team = opposingTeamFor(state, match, currentUser.id)
          const event = confirmScore(league, match, team, currentUser)
          commit(replaceMatch(event.match, event.audit), 'Result confirmed — the match is official and standings have updated.')
        } catch (e) {
          fail(e)
        }
      },

      disputeScore: (matchId, reason) => {
        try {
          const { match, league } = matchCtx(matchId)
          const team = opposingTeamFor(state, match, currentUser.id)
          const event = disputeScore(league, match, team, currentUser, reason)
          commit(replaceMatch(event.match, event.audit), 'Dispute filed. Standings are frozen and the commissioner has been notified.', 'info')
        } catch (e) {
          fail(e)
        }
      },

      resolveDispute: (matchId, homeScore, awayScore) => {
        try {
          const { match, league } = matchCtx(matchId)
          const event = resolveDispute(league, match, currentUser, homeScore, awayScore)
          commit(replaceMatch(event.match, event.audit), 'Dispute resolved — the result is official.')
        } catch (e) {
          fail(e)
        }
      },

      addEvidence: (matchId, kind, note) => {
        try {
          const { match, league } = matchCtx(matchId)
          const event = addEvidence(league, match, currentUser, kind, note)
          commit(replaceMatch(event.match, event.audit), 'Evidence added to the match record.')
        } catch (e) {
          fail(e)
        }
      },

      checkIn: (matchId, teamId) => {
        try {
          const { match, league } = matchCtx(matchId)
          const event = checkIn(league, match, currentUser, teamId, true)
          commit(replaceMatch(event.match, event.audit), 'Checked in — attendance recorded with GPS validation.')
        } catch (e) {
          fail(e)
        }
      },
    }
  }, [state])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

function opposingTeamFor(state: AppState, match: Match, userId: string): Team {
  const submittedBy = match.submission?.submittedByTeamId
  const team = state.teams.find(
    (t) => (t.id === match.homeTeamId || t.id === match.awayTeamId) && t.id !== submittedBy && t.captainId === userId,
  )
  if (!team) throw new Error('Only the opposing captain can respond to this score.')
  return team
}

export function useStore(): StoreApi {
  const api = useContext(StoreContext)
  if (!api) throw new Error('useStore must be used within StoreProvider')
  return api
}
