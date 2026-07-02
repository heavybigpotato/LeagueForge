import type { AuditEntry, League, Match, Team, User } from '../core/types'
import { createLeague } from '../core/league'
import { approvePlayer, createPendingTeam, requestJoin } from '../core/team'
import { generateRoundRobin } from '../core/schedule'
import { addEvidence, checkIn, confirmScore, disputeScore, submitScore } from '../core/match'
import { newId } from '../core/ids'

/**
 * Opt-in practice league. Nothing here ships pre-loaded: the app starts
 * completely empty and this generator only runs when a signed-in user
 * explicitly asks for a sandbox to explore. It builds a full season around
 * THEM as commissioner — official teams that each went through the real
 * pending → official flow, verified results, a score awaiting confirmation,
 * an open dispute, and a team still stuck at 9/11 — so every feature can be
 * tried without recruiting 44 friends first. Practice accounts are ordinary
 * local accounts and can be switched into from the Profile tab.
 */

const FIRST = ['Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Dakota', 'Quinn', 'Rowan', 'Avery', 'Reese', 'Emerson', 'Finley', 'Hayden', 'Kai', 'Luca', 'Mateo', 'Noah', 'Omar', 'Priya', 'Sofia', 'Tara', 'Uma', 'Victor', 'Wren', 'Yara', 'Zane', 'Iris', 'Jonas', 'Kira', 'Leo', 'Mila', 'Nina', 'Oscar', 'Pablo', 'Rosa', 'Sven', 'Talia', 'Ugo', 'Vera', 'Willa', 'Ximena', 'Yusuf', 'Zoe', 'Ada', 'Bruno', 'Clara', 'Dario', 'Elena', 'Felix', 'Gia']

export interface PracticeLeagueData {
  league: League
  users: User[]
  teams: Team[]
  matches: Match[]
  audit: AuditEntry[]
}

export function buildPracticeLeague(commissioner: User, existingUsers: User[]): PracticeLeagueData {
  let seq = 0
  const usernames = new Set(existingUsers.map((u) => u.username.toLowerCase()))
  const makeUser = (): User => {
    seq += 1
    let username = ''
    do {
      username = `${FIRST[seq % FIRST.length].toLowerCase()}${seq + Math.floor(Math.random() * 90)}`
    } while (usernames.has(username.toLowerCase()))
    usernames.add(username.toLowerCase())
    return {
      id: newId('user'),
      username,
      email: `${username}@practice.local`,
      phone: `+1512555${String(1000 + seq).slice(-4)}`,
      emailVerified: true,
      phoneVerified: true,
      idVerified: seq % 3 === 0,
      deviceFingerprint: `fp_practice_${seq}`,
      reputation: 80 + (seq % 21),
      createdAt: Date.now() - seq * 86400000,
    }
  }

  const users: User[] = []
  const teams: Team[] = []
  let audit: AuditEntry[] = []
  let t = Date.now() - 21 * 86400000 // founded three weeks ago
  const tick = (mins: number) => (t += mins * 60000)
  const seasonStart = new Date(t)
  const seasonEnd = new Date(t + 150 * 86400000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const { league, audit: la } = createLeague(
    commissioner,
    {
      name: 'Practice League',
      sport: 'football',
      logo: '⚽',
      banner: 'linear-gradient(135deg,#134e5e,#71b280)',
      description: 'A sandbox season generated for you to explore LeagueForge. You are the commissioner — everything here works exactly like a real league.',
      country: '—',
      city: 'Practice City',
      homeVenue: 'Practice Grounds',
      seasonStart: iso(seasonStart),
      seasonEnd: iso(seasonEnd),
      maxTeams: 10,
      minTeams: 4,
      minPlayersPerTeam: 11,
      maxPlayersPerTeam: 22,
      scheduleFormat: 'double-round-robin',
      playoffFormat: 'single-elimination',
      scoring: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
      tieBreakers: ['goal-difference', 'goals-for', 'head-to-head'],
      privacy: 'private',
      allowTransfers: false,
    },
    tick(0),
  )
  audit = [...audit, ...la]

  const buildTeam = (name: string, primary: string, secondary: string, bio: string, playerCount: number) => {
    const captain = makeUser()
    users.push(captain)
    const created = createPendingTeam(league, captain, { name, logo: '', primaryColor: primary, secondaryColor: secondary, bio }, teams, tick(45))
    let team = created.team
    audit = [...audit, ...created.audit]
    for (let i = 1; i < playerCount; i++) {
      const p = makeUser()
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

  const thunder = buildTeam('Thunder FC', '#f2c14e', '#1b2333', 'Fast wings, faster counterattacks.', 11)
  const river = buildTeam('River Hawks', '#2563eb', '#e0e7ff', 'A legendary back line.', 11)
  const iron = buildTeam('Iron Wolves', '#7c8594', '#e2e6ec', 'Defense wins championships.', 11)
  const harbor = buildTeam('Harbor Kings', '#38bdf8', '#0c223a', 'Dockside legends.', 11)
  // Still pending at 9/11, with one join request waiting for the captain.
  const nomads = buildTeam('Northside Nomads', '#059669', '#d1fae5', 'New crew, hungry for a first season.', 9)
  const applicant = makeUser()
  users.push(applicant)
  {
    const joined = requestJoin(league, nomads.team, applicant, teams, tick(20))
    teams[teams.indexOf(nomads.team)] = joined.team
    nomads.team = joined.team
    audit = [...audit, ...joined.audit]
  }

  const fixtures = generateRoundRobin(league, teams, { double: true, startDate: new Date(t + 3 * 86400000) })
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

  // A fully verified result (both captains confirmed, with check-ins).
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

  // A score awaiting the opposing captain's confirmation.
  {
    let m = matches[1]
    const home = teamOf(m.homeTeamId)
    const sub = submitScore(league, m, home.team, home.captain, 2, 2, tick(200))
    m = sub.match
    audit = [...audit, ...sub.audit]
    setMatch(m)
  }

  // A disputed result with evidence, waiting on the commissioner (you).
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

  return { league, users, teams, matches, audit }
}
