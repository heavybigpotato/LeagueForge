import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { AuditEntry, League, Match, Team, User } from '../core/types'
import { createLeague, postAnnouncement, setReferee, updateLeague, type CreateLeagueInput, type UpdateLeagueInput } from '../core/league'
import { approvePlayer, createTeam, enterLeague, leaveLeague, requestJoin } from '../core/team'
import { PLATFORM_MIN_PLAYERS } from '../core/types'
import { generateRoundRobin } from '../core/schedule'
import { addEvidence, checkIn, confirmScore, disputeScore, rescheduleMatch, resolveDispute, rsvp, submitScore } from '../core/match'
import { advanceCup, drawCup, isValidCupSize } from '../core/knockout'
import { currentSeasonMatches, endSeason } from '../core/seasons'
import { auditEntry } from '../core/audit'
import { checkPassword, createAccount, newVerification, verifyEmail, verifyPhone, type PendingVerification } from '../core/account'
import { clearState, emptyAppState, loadState, saveState } from './persistence'
import { buildGuidedDemo, hasDemoData, removeDemoData } from './demo'
import { now as clockNow } from '../adapters/clock'
import type { EvidenceKind } from '../core/types'

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

let notifSeq = 1

/** The app ships empty — no pre-loaded users, leagues, or results. */
export const emptyState = emptyAppState

/**
 * If the persisted payload could not be understood, keep the raw bytes so
 * the Data Center can offer export-before-reset instead of silently losing
 * the user's data.
 */
export let corruptedBackupRaw: string | null = null

function loadInitialState(): AppState {
  const result = loadState()
  corruptedBackupRaw = result.corruptedRaw
  return result.state ?? emptyAppState()
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set':
      saveState(action.state)
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
  signUp(input: { username: string; email: string; phone: string; password: string }): User | undefined
  verifyEmail(code: string): boolean
  verifyPhone(code: string): boolean
  signOut(): void
  /** Password-checked sign-in; also how identities are switched. */
  signIn(userId: string, password: string, opts?: { quiet?: boolean }): boolean
  /** Regenerate the local demo verification codes for the signed-in account. */
  resendCodes(): void
  /** Explicit guided demo: generates labeled demo data through real commands. */
  startGuidedDemo(): void
  removeDemoData(): void
  /** Replace local state with a validated backup (replace mode). */
  applyImportedState(state: AppState): void
  eraseDevice(): void
  updateLeague(leagueId: string, input: UpdateLeagueInput): boolean
  postAnnouncement(leagueId: string, text: string): void
  setReferee(leagueId: string, userId: string, assign: boolean): void
  rescheduleMatch(matchId: string, changes: { scheduledAt?: string; venue?: string }): boolean
  endSeason(leagueId: string): void
  dismiss(id: number): void
  createLeague(input: CreateLeagueInput): League | undefined
  createTeam(input: { name: string; logo: string; primaryColor: string; secondaryColor: string; bio: string }): Team | undefined
  /** Captain enters their official team into a league (before it kicks off). */
  enterLeague(teamId: string, leagueId: string): boolean
  /** Captain enters their team into a league using the league's join code. */
  enterLeagueByCode(teamId: string, code: string): boolean
  /** Captain (or commissioner) withdraws a team — between seasons only. */
  leaveLeague(teamId: string): void
  /** Commissioner deletes the league; its teams live on as free agents. */
  deleteLeague(leagueId: string): boolean
  joinByCode(code: string): Team | undefined
  approvePlayer(teamId: string, playerId: string): void
  /** Commissioner kicks off the season: generates fixtures and closes entry. */
  launchSeason(leagueId: string): void
  submitScore(matchId: string, homeScore: number, awayScore: number): void
  confirmScore(matchId: string): void
  disputeScore(matchId: string, reason: string): void
  resolveDispute(matchId: string, homeScore: number, awayScore: number): void
  addEvidence(matchId: string, kind: EvidenceKind, note: string, dataUrl?: string): void
  checkIn(matchId: string, teamId: string): void
  rsvp(matchId: string, teamId: string, status: 'in' | 'out'): void
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

    // True once the commissioner has kicked off the current season — i.e. the
    // season has fixtures. Registration closes at that point.
    const seasonLaunched = (league: League) => currentSeasonMatches(league, state.matches).length > 0

    /**
     * After a cup tie becomes official, move the bracket along: create the
     * next round's ties once a pairing is decided, and crown the winner when
     * the final is verified. No-op for league (round-robin) competitions.
     */
    const withCupProgress = (next: AppState, leagueId: string): { state: AppState; message?: string } => {
      const league = next.leagues.find((l) => l.id === leagueId)
      if (!league || league.scheduleFormat !== 'knockout') return { state: next }
      const adv = advanceCup(league, next.matches, currentUser.id)
      let matches = next.matches
      let auditLog = next.auditLog
      let message: string | undefined
      if (adv.matches.length > 0) {
        matches = [...matches, ...adv.matches]
        auditLog = [...auditLog, ...adv.audit]
        message = 'The next cup round is set.'
      }
      // Crown at most once per season (crownings never exceed seasons ended + 1).
      const crownings = auditLog.filter((a) => a.leagueId === leagueId && a.action === 'playoffs.champion').length
      const seasonsEnded = auditLog.filter((a) => a.leagueId === leagueId && a.action === 'season.ended').length
      if (adv.championTeamId && crownings <= seasonsEnded) {
        const champ = next.teams.find((t) => t.id === adv.championTeamId)
        auditLog = [...auditLog, auditEntry(leagueId, currentUser.id, 'playoffs.champion', `🏆 "${champ?.name}" win the ${league.name} cup!`)]
        message = `🏆 ${champ?.name} win the cup!`
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
          const user = verifyEmail(currentUser, verification, code, clockNow())
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
          const user = verifyPhone(currentUser, verification, code, clockNow())
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

      resendCodes: () => {
        if (!currentUser) return
        commit(
          { ...state, verifications: { ...state.verifications, [currentUser.id]: newVerification(clockNow()) } },
          'New demo verification codes generated locally.',
          'info',
        )
      },

      startGuidedDemo: () => {
        try {
          if (hasDemoData(state)) throw new Error('Guided demo data already exists — remove it from the Data Center first.')
          const demo = buildGuidedDemo(state.users, clockNow())
          commit(
            {
              ...state,
              users: [...state.users, ...demo.users],
              leagues: [...state.leagues, demo.league],
              teams: [...state.teams, ...demo.teams],
              matches: [...state.matches, ...demo.matches],
              auditLog: [...state.auditLog, ...demo.audit],
              primaryAccountIds: [...state.primaryAccountIds, demo.commissionerId],
              currentUserId: demo.commissionerId,
            },
            'Guided demo ready — everything is labeled demo data and removable from the Data Center.',
          )
        } catch (e) {
          fail(e)
        }
      },

      removeDemoData: () => {
        commit(removeDemoData(state), 'All guided-demo data removed. Your own data is untouched.', 'info')
      },

      applyImportedState: (imported) => {
        commit({ ...imported, notifications: [] }, 'Backup imported — local state replaced.', 'info')
      },
      signIn: (userId, password, opts) => {
        try {
          const user = state.users.find((u) => u.id === userId)
          if (!user) throw new Error('Account not found.')
          if (!checkPassword(user, password)) throw new Error('Wrong password for @' + user.username + '.')
          commit({ ...state, currentUserId: userId })
          return true
        } catch (e) {
          if (!opts?.quiet) fail(e)
          return false
        }
      },

      updateLeague: (leagueId, input) => {
        try {
          const league = leagueOf(leagueId)
          const { league: next, audit } = updateLeague(league, currentUser.id, input)
          commit(
            { ...state, leagues: state.leagues.map((l) => (l.id === next.id ? next : l)), auditLog: [...state.auditLog, ...audit] },
            'League settings saved.',
          )
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      postAnnouncement: (leagueId, text) => {
        try {
          const league = leagueOf(leagueId)
          const { league: next, audit } = postAnnouncement(league, currentUser, text)
          commit(
            { ...state, leagues: state.leagues.map((l) => (l.id === next.id ? next : l)), auditLog: [...state.auditLog, ...audit] },
            'Announcement posted to the league.',
          )
        } catch (e) {
          fail(e)
        }
      },

      setReferee: (leagueId, userId, assign) => {
        try {
          const league = leagueOf(leagueId)
          const referee = state.users.find((u) => u.id === userId)
          if (!referee) throw new Error('Account not found.')
          const { league: next, audit } = setReferee(league, currentUser.id, referee, assign)
          commit(
            { ...state, leagues: state.leagues.map((l) => (l.id === next.id ? next : l)), auditLog: [...state.auditLog, ...audit] },
            assign ? '@' + referee.username + ' can now verify results and resolve disputes.' : 'Referee removed.',
          )
        } catch (e) {
          fail(e)
        }
      },

      rescheduleMatch: (matchId, changes) => {
        try {
          const { match, league } = matchCtx(matchId)
          const event = rescheduleMatch(league, match, currentUser.id, changes)
          commit(replaceMatch(event.match, event.audit), 'Fixture rescheduled — both teams can see the change.')
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      endSeason: (leagueId) => {
        try {
          const league = leagueOf(leagueId)
          const ended = endSeason(league, state.teams, state.matches, currentUser.id)
          commit(
            {
              ...state,
              leagues: state.leagues.map((l) => (l.id === ended.league.id ? ended.league : l)),
              teams: state.teams.map((t) => ended.teams.find((x) => x.id === t.id) ?? t),
              auditLog: [...state.auditLog, ...ended.audit],
            },
            'Season ' + league.currentSeason + ' archived to league history. Season ' + ended.league.currentSeason + ' is live — rosters unlocked.',
          )
        } catch (e) {
          fail(e)
        }
      },

      eraseDevice: () => {
        clearState()
        commit(emptyAppState(), 'All data on this device has been erased.', 'info')
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

      createTeam: (input) => {
        try {
          const { team, audit } = createTeam(currentUser, input, state.teams)
          commit(
            { ...state, teams: [...state.teams, team], auditLog: [...state.auditLog, ...audit] },
            `"${team.name}" is yours. Share code ${team.inviteCode} — at ${PLATFORM_MIN_PLAYERS} verified players you go official.`,
          )
          return team
        } catch (e) {
          return fail(e)
        }
      },

      enterLeague: (teamId, leagueId) => {
        try {
          const team = state.teams.find((t) => t.id === teamId)
          if (!team) throw new Error('Team not found.')
          const league = leagueOf(leagueId)
          const { team: next, audit } = enterLeague(league, team, currentUser.id, state.teams, seasonLaunched(league))
          commit(
            { ...state, teams: state.teams.map((t) => (t.id === next.id ? next : t)), auditLog: [...state.auditLog, ...audit] },
            `"${team.name}" entered ${league.name}. See you on the schedule.`,
          )
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      enterLeagueByCode: (teamId, code) => {
        try {
          const team = state.teams.find((t) => t.id === teamId)
          if (!team) throw new Error('Team not found.')
          const clean = code.trim().toUpperCase()
          const league = state.leagues.find((l) => l.joinCode.toUpperCase() === clean)
          if (!league) throw new Error('No league found for that code.')
          const { team: next, audit } = enterLeague(league, team, currentUser.id, state.teams, seasonLaunched(league))
          commit(
            { ...state, teams: state.teams.map((t) => (t.id === next.id ? next : t)), auditLog: [...state.auditLog, ...audit] },
            `"${team.name}" entered ${league.name}. See you on the schedule.`,
          )
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      leaveLeague: (teamId) => {
        try {
          const team = state.teams.find((t) => t.id === teamId)
          if (!team) throw new Error('Team not found.')
          if (!team.leagueId) throw new Error('This team is not in a league.')
          const league = leagueOf(team.leagueId)
          const { team: next, audit } = leaveLeague(league, team, currentUser.id, state.matches)
          commit(
            { ...state, teams: state.teams.map((t) => (t.id === next.id ? next : t)), auditLog: [...state.auditLog, ...audit] },
            `"${team.name}" left ${league.name} — free to join another league.`,
            'info',
          )
        } catch (e) {
          fail(e)
        }
      },

      deleteLeague: (leagueId) => {
        try {
          const league = leagueOf(leagueId)
          if (currentUser.id !== league.commissionerId) throw new Error('Only the commissioner can delete the league.')
          commit(
            {
              ...state,
              leagues: state.leagues.filter((l) => l.id !== leagueId),
              // Teams survive their league: they keep name, roster, and status.
              teams: state.teams.map((t) => (t.leagueId === leagueId ? { ...t, leagueId: null, rosterLocked: false } : t)),
              matches: state.matches.filter((m) => m.leagueId !== leagueId),
              auditLog: state.auditLog.filter((a) => a.leagueId !== leagueId),
            },
            `"${league.name}" deleted. Its teams live on as free agents.`,
            'info',
          )
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      joinByCode: (code) => {
        try {
          const team = state.teams.find((t) => t.inviteCode.toUpperCase() === code.trim().toUpperCase())
          if (!team) throw new Error('No team found for this invite code.')
          const league = team.leagueId ? leagueOf(team.leagueId) : null
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
          const league = team.leagueId ? leagueOf(team.leagueId) : null
          const player = state.users.find((u) => u.id === playerId)
          if (!player) throw new Error('Player not found.')
          const event = approvePlayer(league, team, currentUser.id, player)
          const required = league?.minPlayersPerTeam ?? PLATFORM_MIN_PLAYERS
          commit(
            { ...state, teams: state.teams.map((t) => (t.id === event.team.id ? event.team : t)), auditLog: [...state.auditLog, ...event.audit] },
            event.activated
              ? league
                ? `🎉 "${team.name}" is now officially registered in ${league.name}.`
                : `🎉 "${team.name}" is official — ${event.team.memberIds.length} verified players. Time to find a league.`
              : `@${player.username} approved (${event.team.memberIds.length}/${required}).`,
          )
        } catch (e) {
          fail(e)
        }
      },

      launchSeason: (leagueId) => {
        try {
          const league = leagueOf(leagueId)
          if (currentUser.id !== league.commissionerId) throw new Error('Only the commissioner can launch the season.')
          const registered = state.teams.filter((t) => t.leagueId === leagueId)
          const ready = registered.filter((t) => t.status === 'official')
          const recruiting = registered.filter((t) => t.status !== 'official')
          const minTeams = Math.max(2, league.minTeams)
          const isCup = league.scheduleFormat === 'knockout'
          const alreadyLaunched = currentSeasonMatches(league, state.matches).length > 0

          if (ready.length < minTeams) {
            throw new Error(`You need at least ${minTeams} ready teams to kick off — ${ready.length} so far.`)
          }
          if (recruiting.length > 0) {
            throw new Error(`${recruiting.length} team${recruiting.length === 1 ? '' : 's'} still recruiting. Everyone needs ${league.minPlayersPerTeam} players — or remove them first.`)
          }

          let newMatches
          let audit
          let message
          if (isCup) {
            if (alreadyLaunched) throw new Error('The cup has already been drawn.')
            if (!isValidCupSize(ready.length)) throw new Error(`A cup needs 2, 4, 8, or 16 teams — you have ${ready.length}. Add or remove teams.`)
            const drawn = drawCup(league, ready, currentUser.id)
            newMatches = drawn.matches
            audit = drawn.audit
            message = `The cup is drawn! ${ready.length} teams — win or go home.`
          } else {
            // First round starts on the season date, or a few days out if that's
            // already passed — so there's always a real fixture to count down to.
            const soon = clockNow() + 3 * 86400000
            const startDate = new Date(Math.max(new Date(league.seasonStart).getTime() || soon, soon))
            newMatches = generateRoundRobin(league, ready, { startDate })
            audit = [auditEntry(leagueId, currentUser.id, 'schedule.generated', `Season ${league.currentSeason} kicked off — ${newMatches.length} fixtures for ${ready.length} teams.`)]
            message = alreadyLaunched
              ? `Fixtures redrawn — ${newMatches.length} to play.`
              : `Season ${league.currentSeason} is live! ${newMatches.length} fixtures for ${ready.length} teams.`
          }

          // Replace this season's unplayed fixtures; keep verified results.
          const withoutOld = state.matches.filter(
            (m) => !(m.leagueId === leagueId && m.status === 'scheduled' && (m.season ?? 1) === league.currentSeason),
          )
          // Kickoff locks the rosters (unless the league allows transfers).
          const teams = league.allowTransfers
            ? state.teams
            : state.teams.map((t) => (t.leagueId === leagueId && t.status === 'official' ? { ...t, rosterLocked: true } : t))

          commit(
            { ...state, teams, matches: [...withoutOld, ...newMatches], auditLog: [...state.auditLog, ...audit] },
            message,
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
          const progressed = withCupProgress(replaceMatch(event.match, event.audit), league.id)
          commit(
            progressed.state,
            progressed.message ??
              (match.stage === 'playoff'
                ? 'Result confirmed — the cup tie is official.'
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
          const progressed = withCupProgress(replaceMatch(event.match, event.audit), league.id)
          commit(progressed.state, progressed.message ?? 'Dispute resolved — the result is official.')
        } catch (e) {
          fail(e)
        }
      },

      addEvidence: (matchId, kind, note, dataUrl) => {
        try {
          const { match, league } = matchCtx(matchId)
          const event = addEvidence(league, match, currentUser, kind, note, dataUrl)
          commit(replaceMatch(event.match, event.audit), dataUrl ? 'Photo added to the match record.' : 'Note added to the match record.')
        } catch (e) {
          fail(e)
        }
      },

      checkIn: (matchId, teamId) => {
        try {
          const { match, league } = matchCtx(matchId)
          const event = checkIn(league, match, currentUser, teamId, true)
          commit(replaceMatch(event.match, event.audit), 'Checked in — attendance recorded locally on this device.')
        } catch (e) {
          fail(e)
        }
      },

      rsvp: (matchId, teamId, status) => {
        try {
          const { match, league } = matchCtx(matchId)
          const team = state.teams.find((t) => t.id === teamId)
          if (!team) throw new Error('Team not found.')
          const event = rsvp(league, match, currentUser, team, status)
          commit(replaceMatch(event.match, event.audit), status === 'in' ? "You're in — your captain can see the headcount." : 'Marked as out for this fixture.')
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
