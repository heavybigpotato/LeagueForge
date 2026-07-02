import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { AuditEntry, League, Match, Team, User } from '../core/types'
import { createLeague, type CreateLeagueInput } from '../core/league'
import { approvePlayer, createPendingTeam, officialTeams, requestJoin } from '../core/team'
import { generateRoundRobin } from '../core/schedule'
import { addEvidence, checkIn, confirmScore, disputeScore, resolveDispute, submitScore } from '../core/match'
import { advancePlayoffs, startPlayoffs } from '../core/playoffs'
import { auditEntry } from '../core/audit'
import { createAccount, verifyEmail, verifyPhone, type PendingVerification } from '../core/account'
import type { EvidenceKind } from '../core/types'
import { buildPracticeLeague } from './practice'

export interface Notification {
  id: number
  text: string
  kind: 'success' | 'info' | 'error'
}

export interface AppState {
  users: User[]
  /** Null until someone signs in — the app then shows onboarding. */
  currentUserId: string | null
  /** Accounts created through onboarding on this device (shown in the switcher). */
  primaryAccountIds: string[]
  /** Outstanding verification codes, keyed by user id. */
  verifications: Record<string, PendingVerification>
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

const STORAGE_KEY = 'leagueforge-state-v4'
let notifSeq = 1

/** The app ships empty — no pre-loaded users, leagues, or results. */
export function emptyState(): AppState {
  return {
    users: [],
    currentUserId: null,
    primaryAccountIds: [],
    verifications: {},
    leagues: [],
    teams: [],
    matches: [],
    auditLog: [],
    notifications: [],
  }
}

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...emptyState(), ...(JSON.parse(raw) as AppState), notifications: [] }
  } catch {
    /* corrupted state falls through to a fresh start */
  }
  return emptyState()
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
      // keep only the latest few — every rendered toast dismisses itself
      return {
        ...state,
        notifications: [...state.notifications, { id: notifSeq++, text: action.text, kind: action.kind }].slice(-3),
      }
    case 'dismiss':
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) }
  }
}

export interface StoreApi {
  state: AppState
  /**
   * The signed-in account. Screens behind the onboarding gate can rely on
   * this; it is null only while onboarding is shown.
   */
  currentUser: User
  signedIn: boolean
  signUp(input: { username: string; email: string; phone: string }): User | undefined
  verifyEmail(code: string): boolean
  verifyPhone(code: string): boolean
  signOut(): void
  switchUser(userId: string): void
  createPracticeLeague(): void
  eraseDevice(): void
  dismiss(id: number): void
  createLeague(input: CreateLeagueInput): League | undefined
  createTeam(leagueId: string, input: { name: string; logo: string; primaryColor: string; secondaryColor: string; bio: string }): Team | undefined
  joinByCode(code: string): Team | undefined
  approvePlayer(teamId: string, playerId: string): void
  generateSchedule(leagueId: string): void
  startPlayoffs(leagueId: string): void
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
    const currentUser = (state.users.find((u) => u.id === state.currentUserId) ?? null) as User

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

    /**
     * After a result becomes official, move the bracket along: create any
     * next-round ties whose pairings are now decided, and crown the champion
     * once the final is verified.
     */
    const withPlayoffProgress = (next: AppState, leagueId: string): { state: AppState; message?: string } => {
      const league = next.leagues.find((l) => l.id === leagueId)
      if (!league) return { state: next }
      const adv = advancePlayoffs(league, next.matches, currentUser.id)
      let matches = next.matches
      let auditLog = next.auditLog
      let message: string | undefined
      if (adv.matches.length > 0) {
        matches = [...matches, ...adv.matches]
        auditLog = [...auditLog, ...adv.audit]
        message = 'Bracket updated — the next playoff round is set.'
      }
      const alreadyCrowned = auditLog.some((a) => a.leagueId === leagueId && a.action === 'playoffs.champion')
      if (adv.championTeamId && !alreadyCrowned) {
        const champ = next.teams.find((t) => t.id === adv.championTeamId)
        auditLog = [
          ...auditLog,
          auditEntry(leagueId, currentUser.id, 'playoffs.champion', `🏆 "${champ?.name}" won the final and are the ${league.name} champions.`),
        ]
        message = `🏆 ${champ?.name} are the champions of ${league.name}!`
      }
      return { state: { ...next, matches, auditLog }, message }
    }

    return {
      state,
      currentUser,
      signedIn: currentUser !== null,

      signUp: (input) => {
        try {
          const { user, verification } = createAccount(input, state.users)
          commit(
            {
              ...state,
              users: [...state.users, user],
              currentUserId: user.id,
              primaryAccountIds: [...state.primaryAccountIds, user.id],
              verifications: { ...state.verifications, [user.id]: verification },
            },
            `Welcome, @${user.username}! Verify your email and phone to compete.`,
          )
          return user
        } catch (e) {
          return fail(e) as undefined
        }
      },

      verifyEmail: (code) => {
        try {
          const verification = state.verifications[currentUser.id]
          if (!verification) throw new Error('No verification is pending for this account.')
          const user = verifyEmail(currentUser, verification, code)
          commit({ ...state, users: state.users.map((u) => (u.id === user.id ? user : u)) }, 'Email verified ✓')
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      verifyPhone: (code) => {
        try {
          const verification = state.verifications[currentUser.id]
          if (!verification) throw new Error('No verification is pending for this account.')
          const user = verifyPhone(currentUser, verification, code)
          const verifications = { ...state.verifications }
          if (user.emailVerified) delete verifications[user.id]
          commit(
            { ...state, users: state.users.map((u) => (u.id === user.id ? user : u)), verifications },
            'Phone verified ✓ — your account is ready.',
          )
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      signOut: () => commit({ ...state, currentUserId: null }),
      switchUser: (userId) => {
        const user = state.users.find((u) => u.id === userId)
        if (user) commit({ ...state, currentUserId: userId })
      },

      createPracticeLeague: () => {
        try {
          if (state.leagues.some((l) => l.commissionerId === currentUser.id && l.name === 'Practice League')) {
            throw new Error('You already have a practice league.')
          }
          const data = buildPracticeLeague(currentUser, state.users)
          commit(
            {
              ...state,
              users: [...state.users, ...data.users],
              leagues: [...state.leagues, data.league],
              teams: [...state.teams, ...data.teams],
              matches: [...state.matches, ...data.matches],
              auditLog: [...state.auditLog, ...data.audit],
            },
            'Practice league ready — you are the commissioner. Explore standings, disputes, and playoffs freely.',
          )
        } catch (e) {
          fail(e)
        }
      },

      eraseDevice: () => {
        localStorage.removeItem(STORAGE_KEY)
        commit(emptyState(), 'All data on this device has been erased.', 'info')
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
          const withoutOld = state.matches.filter(
            (m) => !(m.leagueId === leagueId && m.status === 'scheduled' && m.stage !== 'playoff'),
          )
          commit(
            { ...state, matches: [...withoutOld, ...fixtures] },
            `Schedule generated: ${fixtures.length} fixtures for ${eligible.length} official teams.`,
          )
        } catch (e) {
          fail(e)
        }
      },

      startPlayoffs: (leagueId) => {
        try {
          const league = leagueOf(leagueId)
          const started = startPlayoffs(league, state.teams, state.matches, currentUser.id)
          commit(
            { ...state, matches: [...state.matches, ...started.matches], auditLog: [...state.auditLog, ...started.audit] },
            `Playoffs are live — ${started.matches.length * 2} teams seeded into the bracket from the standings.`,
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
          const progressed = withPlayoffProgress(replaceMatch(event.match, event.audit), league.id)
          commit(
            progressed.state,
            progressed.message ??
              (match.stage === 'playoff'
                ? 'Result confirmed — the playoff result is official.'
                : 'Result confirmed — the match is official and standings have updated.'),
          )
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
          const progressed = withPlayoffProgress(replaceMatch(event.match, event.audit), league.id)
          commit(progressed.state, progressed.message ?? 'Dispute resolved — the result is official.')
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
