import type { AppState } from './store'
import type { AuditEntry, League, Match, Team, User } from '../core/types'
import { createAccount, verifyEmail, verifyPhone } from '../core/account'
import { createLeague } from '../core/league'
import { approvePlayer, createTeam, enterLeague, requestJoin } from '../core/team'
import { generateRoundRobin } from '../core/schedule'
import { addEvidence, confirmScore, disputeScore, submitScore } from '../core/match'
import { DEMO_PASSWORD } from '../core/config'

/**
 * Guided demo. Nothing here ships in default state: this runs ONLY when the
 * user explicitly taps "Try guided demo". Every entity is created through
 * the same domain commands real flows use (accounts are created and verified
 * with real codes, teams walk the full pending → official path, results go
 * through two-captain verification) and every account/league is flagged
 * isDemo so the whole thing can be removed in one tap without touching any
 * real user-created data.
 */

const DEMO_TEAMS = [
  { name: 'Demo Thunder', primary: '#f2c14e', secondary: '#1b2333' },
  { name: 'Demo Hawks', primary: '#2563eb', secondary: '#e0e7ff' },
  { name: 'Demo Wolves', primary: '#7c8594', secondary: '#e2e6ec' },
  { name: 'Demo Kings', primary: '#38bdf8', secondary: '#0c223a' },
]

export interface DemoData {
  users: User[]
  league: League
  teams: Team[]
  matches: Match[]
  audit: AuditEntry[]
  /** The account the user is signed into for the tour. */
  commissionerId: string
}

export function buildGuidedDemo(existingUsers: User[], now: number = Date.now()): DemoData {
  let t = now - 14 * 86400000
  const tick = (mins: number) => (t += mins * 60000)
  const users: User[] = []
  let audit: AuditEntry[] = []
  let seq = 0

  /** Create + verify an account exactly like onboarding does. */
  const makeAccount = (username: string): User => {
    seq += 1
    const taken = [...existingUsers, ...users]
    const created = createAccount(
      { username, email: `${username}@demo.local`, phone: `+1000555${String(1000 + seq).slice(-4)}`, password: DEMO_PASSWORD },
      taken,
      tick(1),
    )
    let user = verifyEmail(created.user, created.verification, created.verification.emailCode, t)
    user = verifyPhone(user, created.verification, created.verification.phoneCode, t)
    user = { ...user, isDemo: true }
    users.push(user)
    return user
  }

  const uniqueName = (base: string): string => {
    const taken = new Set([...existingUsers, ...users].map((u) => u.username.toLowerCase()))
    let candidate = base
    let n = 1
    while (taken.has(candidate.toLowerCase())) candidate = `${base}${++n}`
    return candidate
  }

  const commissioner = makeAccount(uniqueName('demo_commissioner'))

  const iso = (d: number) => new Date(d).toISOString().slice(0, 10)
  const { league: created, audit: la } = createLeague(
    commissioner,
    {
      name: 'Guided Demo League',
      sport: 'football',
      logo: '',
      banner: '',
      description: 'A guided tour of LeagueForge. Everything here is labeled demo data and can be removed in one tap from the Data Center.',
      country: '—',
      city: 'Demo City',
      homeVenue: 'Demo Grounds',
      seasonStart: iso(t),
      seasonEnd: iso(t + 120 * 86400000),
      maxTeams: 8,
      minTeams: 2,
      minPlayersPerTeam: 11,
      maxPlayersPerTeam: 22,
      scheduleFormat: 'double-round-robin',
      playoffFormat: 'single-elimination',
      scoring: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
      tieBreakers: ['goal-difference', 'goals-for', 'head-to-head'],
      privacy: 'private',
      allowTransfers: false,
    },
    tick(5),
  )
  const league: League = { ...created, isDemo: true }
  audit = [...audit, ...la]

  const teams: Team[] = []
  const captains: User[] = []
  for (const spec of DEMO_TEAMS) {
    const captain = makeAccount(uniqueName(`demo_captain${captains.length + 1}`))
    captains.push(captain)
    // The real journey: found a free team, recruit to the platform minimum,
    // go official, then enter the league as a complete side.
    const createdTeam = createTeam(
      captain,
      { name: spec.name, logo: '', primaryColor: spec.primary, secondaryColor: spec.secondary, bio: 'Guided demo team.' },
      teams,
      tick(20),
    )
    let team = createdTeam.team
    for (let i = 1; i < league.minPlayersPerTeam; i++) {
      const player = makeAccount(uniqueName(`demo_player${seq}`))
      const joined = requestJoin(null, team, player, [...teams, team], tick(9))
      team = joined.team
      const approved = approvePlayer(null, team, captain.id, player, tick(4))
      team = approved.team
    }
    const entered = enterLeague(league, team, captain.id, teams, tick(3))
    team = entered.team
    audit = [...audit, ...entered.audit]
    teams.push(team)
  }

  const matches: Match[] = generateRoundRobin(league, teams, { double: true, startDate: new Date(t + 2 * 86400000) })
  const teamOf = (id: string) => {
    const idx = teams.findIndex((x) => x.id === id)
    return { team: teams[idx], captain: captains[idx] }
  }
  const put = (m: Match) => {
    matches[matches.findIndex((x) => x.id === m.id)] = m
  }

  // A verified result — submitted and confirmed by the two demo captains.
  {
    let m = matches[0]
    const home = teamOf(m.homeTeamId)
    const away = teamOf(m.awayTeamId)
    const sub = submitScore(league, m, home.team, home.captain, 2, 1, tick(60))
    m = sub.match
    audit = [...audit, ...sub.audit]
    const conf = confirmScore(league, m, away.team, away.captain, tick(8))
    m = conf.match
    audit = [...audit, ...conf.audit]
    put(m)
  }
  // A score waiting on the opposing captain — so verification is visible.
  {
    let m = matches[1]
    const home = teamOf(m.homeTeamId)
    const sub = submitScore(league, m, home.team, home.captain, 1, 1, tick(30))
    m = sub.match
    audit = [...audit, ...sub.audit]
    put(m)
  }
  // An open dispute with an evidence note — so resolution is demonstrable.
  {
    let m = matches[2]
    const home = teamOf(m.homeTeamId)
    const away = teamOf(m.awayTeamId)
    const sub = submitScore(league, m, home.team, home.captain, 3, 0, tick(25))
    m = sub.match
    audit = [...audit, ...sub.audit]
    const disp = disputeScore(league, m, away.team, away.captain, 'Demo dispute — the score was 1-1.', tick(6))
    m = disp.match
    audit = [...audit, ...disp.audit]
    const ev = addEvidence(league, m, away.captain, 'photo', 'Demo evidence note (saved locally).', tick(3))
    m = ev.match
    audit = [...audit, ...ev.audit]
    put(m)
  }

  return { users, league, teams, matches, audit, commissionerId: commissioner.id }
}

export function hasDemoData(state: Pick<AppState, 'leagues' | 'users'>): boolean {
  return state.leagues.some((l) => l.isDemo) || state.users.some((u) => u.isDemo)
}

/**
 * Remove ONLY demo-flagged content: demo accounts, the demo league, its
 * teams, matches, audit entries, and pending verifications. Real
 * user-created data is untouched.
 */
export function removeDemoData(state: AppState): AppState {
  const demoLeagueIds = new Set(state.leagues.filter((l) => l.isDemo).map((l) => l.id))
  const demoUserIds = new Set(state.users.filter((u) => u.isDemo).map((u) => u.id))
  const verifications = { ...state.verifications }
  for (const id of demoUserIds) delete verifications[id]
  return {
    ...state,
    users: state.users.filter((u) => !u.isDemo),
    leagues: state.leagues.filter((l) => !l.isDemo),
    teams: state.teams.filter((t) => t.leagueId === null || !demoLeagueIds.has(t.leagueId)),
    matches: state.matches.filter((m) => !demoLeagueIds.has(m.leagueId)),
    auditLog: state.auditLog.filter((a) => !demoLeagueIds.has(a.leagueId)),
    primaryAccountIds: state.primaryAccountIds.filter((id) => !demoUserIds.has(id)),
    verifications,
    currentUserId: state.currentUserId && demoUserIds.has(state.currentUserId) ? null : state.currentUserId,
  }
}
