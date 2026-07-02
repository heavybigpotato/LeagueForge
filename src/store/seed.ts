import type { AuditEntry, Match, Team, User } from '../core/types'
import { createLeague } from '../core/league'
import { approvePlayer, createPendingTeam, requestJoin } from '../core/team'
import { generateRoundRobin } from '../core/schedule'
import { addEvidence, checkIn, confirmScore, disputeScore, submitScore } from '../core/match'
import { newId } from '../core/ids'
import type { AppState } from './store'

const FIRST = ['Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Dakota', 'Quinn', 'Rowan', 'Avery', 'Reese', 'Emerson', 'Finley', 'Hayden', 'Kai', 'Luca', 'Mateo', 'Noah', 'Omar', 'Priya', 'Sofia', 'Tara', 'Uma', 'Victor', 'Wren', 'Yara', 'Zane', 'Iris', 'Jonas', 'Kira', 'Leo', 'Mila', 'Nina', 'Oscar', 'Pablo', 'Rosa', 'Sven', 'Talia', 'Ugo', 'Vera', 'Willa', 'Ximena', 'Yusuf', 'Zoe', 'Ada', 'Bruno', 'Clara', 'Dario', 'Elena', 'Felix']

let seq = 0
function makeUser(base: number): User {
  seq += 1
  const name = FIRST[(base + seq) % FIRST.length]
  const username = `${name.toLowerCase()}${(seq % 97) + 1}`
  return {
    id: newId('user'),
    username,
    email: `${username}@example.com`,
    phone: `+1512555${String(1000 + seq).slice(-4)}`,
    emailVerified: true,
    phoneVerified: true,
    idVerified: seq % 3 === 0,
    deviceFingerprint: `fp_${seq}`,
    reputation: 80 + (seq % 21),
    createdAt: Date.now() - seq * 86400000,
  }
}

/**
 * Builds a realistic demo league so the app feels alive on first launch:
 * three official teams (each went through the full pending → official flow),
 * one team still pending at 9/11, verified results, one score awaiting
 * confirmation, and one dispute with evidence.
 */
export function seedDemoData(): AppState {
  seq = 0
  const users: User[] = []
  const teams: Team[] = []
  let audit: AuditEntry[] = []
  let t = Date.now() - 21 * 86400000 // league founded three weeks ago
  const tick = (mins: number) => (t += mins * 60000)

  const commissioner = makeUser(0)
  commissioner.username = 'alexrivera'
  users.push(commissioner)

  const { league, audit: la } = createLeague(
    commissioner,
    {
      name: 'Downtown Football League',
      sport: 'football',
      logo: '⚽',
      banner: 'linear-gradient(135deg,#134e5e,#71b280)',
      description: 'The city’s premier 11-a-side amateur competition. Verified rosters, verified results.',
      country: 'USA',
      city: 'Austin',
      seasonStart: '2026-06-14',
      seasonEnd: '2026-11-22',
      maxTeams: 10,
      minTeams: 4,
      minPlayersPerTeam: 11,
      maxPlayersPerTeam: 22,
      scheduleFormat: 'double-round-robin',
      playoffFormat: 'single-elimination',
      scoring: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
      tieBreakers: ['goal-difference', 'goals-for', 'head-to-head'],
      privacy: 'public',
      allowTransfers: false,
    },
    tick(0),
  )
  audit = [...audit, ...la]

  const buildTeam = (name: string, logo: string, primary: string, secondary: string, bio: string, playerCount: number) => {
    const captain = makeUser(teams.length * 7)
    users.push(captain)
    const created = createPendingTeam(league, captain, { name, logo, primaryColor: primary, secondaryColor: secondary, bio }, teams, tick(45))
    let team = created.team
    audit = [...audit, ...created.audit]
    for (let i = 1; i < playerCount; i++) {
      const p = makeUser(teams.length * 7 + i)
      users.push(p)
      const joined = requestJoin(league, team, p, [...teams, team], tick(30))
      team = joined.team
      audit = [...audit, ...joined.audit]
      const approved = approvePlayer(league, team, captain.id, p, tick(10))
      team = approved.team
      audit = [...audit, ...approved.audit]
    }
    teams.push(team)
    return { team, captain }
  }

  const thunder = buildTeam('Thunder FC', '⚡', '#f2c14e', '#1b2333', 'Founded 2021. Fast wings, faster counterattacks.', 11)
  const river = buildTeam('River Hawks', '🦅', '#2563eb', '#e0e7ff', 'East-side club with a legendary back line.', 11)
  const iron = buildTeam('Iron Wolves', '🐺', '#7c8594', '#e2e6ec', 'Defense wins championships.', 11)
  const harbor = buildTeam('Harbor Kings', '⚓', '#38bdf8', '#0c223a', 'Dockside legends since day one.', 11)
  // Still pending at 9/11, with one join request waiting for the captain.
  const nomads = buildTeam('Northside Nomads', '🧭', '#059669', '#d1fae5', 'New crew, hungry for a first season.', 9)
  const applicant = makeUser(40)
  users.push(applicant)
  {
    const joined = requestJoin(league, nomads.team, applicant, teams, tick(20))
    teams[teams.indexOf(nomads.team)] = joined.team
    nomads.team = joined.team
    audit = [...audit, ...joined.audit]
  }

  const fixtures = generateRoundRobin(league, teams, { double: true, startDate: new Date('2026-06-20T18:00:00Z') })
  const matches: Match[] = [...fixtures]
  audit = [
    ...audit,
    Object.freeze({
      id: newId('audit'),
      leagueId: league.id,
      at: tick(15),
      actorId: commissioner.id,
      action: 'schedule.generated' as const,
      detail: `Round-robin schedule generated: ${fixtures.length} fixtures for ${teams.filter((x) => x.status === 'official').length} official teams.`,
    }),
  ]

  const teamOf = (id: string) => [thunder, river, iron, harbor].find((x) => x.team.id === id)!
  const setMatch = (m: Match) => {
    matches[matches.findIndex((x) => x.id === m.id)] = m
  }

  // Match 1: fully verified result (both captains confirmed).
  {
    let m = matches[0]
    const home = teamOf(m.homeTeamId)
    const away = teamOf(m.awayTeamId)
    for (const side of [home, away]) {
      const e = checkIn(league, m, side.captain, side.team.id, true, tick(8))
      m = e.match
      audit = [...audit, ...e.audit]
    }
    const sub = submitScore(league, m, home.team, home.captain, 3, 1, tick(110))
    m = sub.match
    audit = [...audit, ...sub.audit]
    const conf = confirmScore(league, m, away.team, away.captain, tick(6))
    m = conf.match
    audit = [...audit, ...conf.audit]
    setMatch(m)
  }

  // Match 2: score submitted, awaiting the opposing captain's confirmation.
  {
    let m = matches[1]
    const home = teamOf(m.homeTeamId)
    const sub = submitScore(league, m, home.team, home.captain, 2, 2, tick(200))
    m = sub.match
    audit = [...audit, ...sub.audit]
    setMatch(m)
  }

  // Match 3: disputed, evidence uploaded, waiting on the commissioner.
  {
    let m = matches[2]
    const home = teamOf(m.homeTeamId)
    const away = teamOf(m.awayTeamId)
    const sub = submitScore(league, m, home.team, home.captain, 4, 0, tick(300))
    m = sub.match
    audit = [...audit, ...sub.audit]
    const disp = disputeScore(league, m, away.team, away.captain, 'Final score was 2-1, not 4-0.', tick(9))
    m = disp.match
    audit = [...audit, ...disp.audit]
    const ev = addEvidence(league, m, away.captain, 'photo', 'Photo of the scoreboard at full time.', tick(5))
    m = ev.match
    audit = [...audit, ...ev.audit]
    setMatch(m)
  }

  return {
    users,
    currentUserId: commissioner.id,
    leagues: [league],
    teams,
    matches,
    auditLog: audit,
    notifications: [],
  }
}
