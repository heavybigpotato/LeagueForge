import { describe, expect, it } from 'vitest'
import type { League, Match, Team, User } from './types'
import { PLATFORM_MIN_PLAYERS } from './types'
import { createLeague } from './league'
import { approvePlayer, createTeam, enterLeague, leaveLeague, removePlayer, requestJoin, resolveMinPlayers } from './team'
import { advanceCup, cupStarted, drawCup } from './knockout'
import { generateRoundRobin } from './schedule'
import { checkIn, confirmScore, disputeScore, resolveDispute, rsvp, rsvpCount, submitScore } from './match'
import { powerRankings } from './powerRankings'
import { computeStandings, formGuide } from './standings'
import { newInviteCode, inviteLink } from './ids'
import { auditEntry } from './audit'
import { evaluateSeasonAchievements } from './achievements'
import { computeTeamStats } from './teamStats'
import { clubProfile, trophyCount } from './clubStats'
import { leagueSeasonStats } from './leagueStats'
import { postAnnouncement, setReferee, updateLeague } from './league'
import { rescheduleMatch } from './match'
import { currentSeasonMatches, endSeason } from './seasons'
import { checkPassword, createAccount, phoneError } from './account'
import { generateProKey, normalizeProKey, proChecksum, verifyProKey } from './pro'

let userSeq = 0
function makeUser(overrides: Partial<User> = {}): User {
  userSeq += 1
  return {
    id: `user_${userSeq}`,
    username: `player${userSeq}`,
    email: `p${userSeq}@example.com`,
    phone: `+1555000${userSeq.toString().padStart(4, '0')}`,
    passwordHash: 'test',
    passwordSalt: 'test',
    deviceFingerprint: `fp_${userSeq}`,
    reputation: 100,
    createdAt: 0,
    ...overrides,
  }
}

function makeLeague(commissioner: User, overrides: Partial<Parameters<typeof createLeague>[1]> = {}): League {
  return createLeague(commissioner, {
    name: 'Sunday Premier League',
    sport: 'football',
    logo: '⚽',
    banner: '',
    description: 'Test league',
    country: 'US',
    city: 'Austin',
    seasonStart: '2026-08-01',
    seasonEnd: '2026-12-01',
    maxTeams: 12,
    minTeams: 4,
    minPlayersPerTeam: 11,
    maxPlayersPerTeam: 25,
    scheduleFormat: 'round-robin',
    scoring: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
    tieBreakers: ['goal-difference', 'goals-for', 'head-to-head'],
    privacy: 'public',
    allowTransfers: false,
    ...overrides,
  }).league
}

/** Build a free official team: standalone creation, recruit to the minimum. */
function buildFreeTeam(name: string, existing: Team[] = [], min = PLATFORM_MIN_PLAYERS): { team: Team; captain: User } {
  const captain = makeUser()
  let { team } = createTeam(captain, { name, logo: '🛡️', primaryColor: '#111', secondaryColor: '#eee', bio: '' }, existing)
  while (team.memberIds.length < min) {
    const p = makeUser()
    team = requestJoin(null, team, p, [...existing, team]).team
    team = approvePlayer(null, team, captain.id, p).team
  }
  expect(team.status).toBe('official')
  return { team, captain }
}

/** Full journey: found the team, go official, enter the league. */
function buildOfficialTeam(league: League, name: string, existing: Team[] = []): { team: Team; captain: User } {
  const free = buildFreeTeam(name, existing, league.minPlayersPerTeam)
  const team = enterLeague(league, free.team, free.captain.id, existing).team
  return { team, captain: free.captain }
}

describe('invite codes', () => {
  it('generates 8-character unambiguous codes and links', () => {
    const code = newInviteCode()
    expect(code).toHaveLength(8)
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
    expect(inviteLink('ABC12345')).toBe('leagueforge.app/join/ABC12345')
  })
})

describe('LeagueForge Pro license keys', () => {
  const secret = 'unit-test-secret'

  it('generated keys verify under the same secret, in any formatting', () => {
    const key = generateProKey(secret)
    expect(key).toMatch(/^LFPRO-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
    expect(verifyProKey(key, secret)).toBe(true)
    expect(verifyProKey(key.toLowerCase(), secret)).toBe(true)
    expect(verifyProKey(` ${key.replace(/-/g, ' ')} `, secret)).toBe(true)
  })

  it('rejects tampered keys, wrong secrets, and garbage', () => {
    const key = generateProKey(secret)
    expect(verifyProKey(key, 'another-secret')).toBe(false)
    // flip one payload character to a different valid alphabet character
    const body = normalizeProKey(key).slice('LFPRO'.length)
    const flipped = body[0] === 'A' ? 'B' + body.slice(1) : 'A' + body.slice(1)
    expect(verifyProKey(`LFPRO${flipped}`, secret)).toBe(false)
    expect(verifyProKey('', secret)).toBe(false)
    expect(verifyProKey('LFPRO-SHORT', secret)).toBe(false)
    expect(verifyProKey('TOTALLY-NOT-A-KEY-AT-ALL', secret)).toBe(false)
  })

  it('checksums are deterministic and secret-dependent', () => {
    expect(proChecksum('ABCDEFGHJK', secret)).toBe(proChecksum('ABCDEFGHJK', secret))
    expect(proChecksum('ABCDEFGHJK', secret)).not.toBe(proChecksum('ABCDEFGHJK', 'other'))
    expect(proChecksum('ABCDEFGHJK', secret)).not.toBe(proChecksum('KJHGFEDCBA', secret))
  })
})

describe('accounts', () => {
  it('creates a ready-to-play account with no simulated verification step', () => {
    const user = createAccount({ username: 'alex_r', email: 'alex@example.com', phone: '+15550001111', password: 'stadium-lights-9' }, [])
    expect(user.username).toBe('alex_r')
    expect(user.email).toBe('alex@example.com')
    expect(user.reputation).toBe(100)
    // no verification codes, flags, or pending states exist anywhere
    expect(Object.keys(user)).not.toContain('emailVerified')
  })

  it('rejects invalid or duplicate identities', () => {
    const user = createAccount({ username: 'taken', email: 'taken@example.com', phone: '+15550001111', password: 'stadium-lights-9' }, [])
    expect(() => createAccount({ username: 'x', email: 'a@b.co', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/At least 3/)
    expect(() => createAccount({ username: 'TAKEN', email: 'a@b.co', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/taken/)
    expect(() => createAccount({ username: 'newuser', email: 'not-an-email', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/email/)
    expect(() => createAccount({ username: 'newuser', email: 'taken@example.com', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/already uses this email/)
    expect(() => createAccount({ username: 'newuser', email: 'a@b.co', phone: '12', password: 'stadium-lights-9' }, [user])).toThrow(/phone number/)
  })

  it('phone is optional: empty passes, junk fails', () => {
    expect(phoneError('')).toBeNull()
    expect(phoneError('   ')).toBeNull()
    expect(phoneError('12')).toMatch(/phone number/)
    const user = createAccount({ username: 'nophone', email: 'np@example.com', phone: '', password: 'stadium-lights-9' }, [])
    expect(user.phone).toBe('')
  })

  it('passwords: minimum length enforced, salted hash verifies, wrong password rejected', () => {
    expect(() =>
      createAccount({ username: 'shortpw', email: 's@example.com', phone: '+15550003333', password: 'short' }, []),
    ).toThrow(/At least 8/)
    const user = createAccount({ username: 'lockedin', email: 'l@example.com', phone: '+15550003334', password: 'stadium-lights-9' }, [])
    expect(user.passwordHash).not.toContain('stadium')
    expect(checkPassword(user, 'stadium-lights-9')).toBe(true)
    expect(checkPassword(user, 'stadium-lights-8')).toBe(false)
    // same password, different account → different hash (unique salts)
    const other = createAccount({ username: 'lockedin2', email: 'l2@example.com', phone: '+15550003335', password: 'stadium-lights-9' }, [user])
    expect(other.passwordHash).not.toBe(user.passwordHash)
  })
})

describe('league creation', () => {
  it('never allows the roster minimum below the platform floor of 11', () => {
    expect(resolveMinPlayers(5)).toBe(PLATFORM_MIN_PLAYERS)
    expect(resolveMinPlayers(15)).toBe(15)
    const league = makeLeague(makeUser(), { minPlayersPerTeam: 3 })
    expect(league.minPlayersPerTeam).toBe(PLATFORM_MIN_PLAYERS)
  })

  it('rejects invalid seasons and team bounds', () => {
    const c = makeUser()
    expect(() => makeLeague(c, { seasonStart: '2026-08-01', seasonEnd: '2026-07-01' })).toThrow(/Season end/)
    expect(() => makeLeague(c, { minTeams: 1 })).toThrow(/at least 2 teams/)
    expect(() => makeLeague(c, { maxPlayersPerTeam: 5 })).toThrow(/Maximum players/)
  })
})

describe('team lifecycle: standalone creation → official → league entry', () => {
  it('anyone can found a team — no league required', () => {
    const captain = makeUser()
    const { team } = createTeam(captain, { name: 'Thunder FC', logo: '⚡', primaryColor: '#000', secondaryColor: '#fff', bio: '' }, [])
    expect(team.status).toBe('pending')
    expect(team.leagueId).toBeNull()
    expect(team.memberIds).toEqual([captain.id])
    expect(team.inviteCode).toHaveLength(8)
    // a team outside a league never appears in standings
    expect(computeStandings(makeLeague(makeUser()), [team], [])).toHaveLength(0)
  })

  it('goes official at 11 players; a free team keeps its roster unlocked', () => {
    const captain = makeUser()
    let { team } = createTeam(captain, { name: 'Thunder FC', logo: '⚡', primaryColor: '#000', secondaryColor: '#fff', bio: '' }, [])

    // captain + 9 approved teammates = 10 players → still pending
    for (let i = 0; i < 9; i++) {
      const p = makeUser()
      team = requestJoin(null, team, p, [team]).team
      team = approvePlayer(null, team, captain.id, p).team
    }
    expect(team.memberIds).toHaveLength(10)
    expect(team.status).toBe('pending')

    // player #11 joins and is approved → automatic activation
    const eleventh = makeUser()
    team = requestJoin(null, team, eleventh, [team]).team
    const event = approvePlayer(null, team, captain.id, eleventh)
    expect(event.activated).toBe(true)
    expect(event.team.status).toBe('official')
    expect(event.team.activatedAt).toBeDefined()
    expect(event.team.leagueId).toBeNull()
    expect(event.team.rosterLocked).toBe(false) // no league, no lock
  })

  it('joining puts players in the captain approval queue, and only the captain approves', () => {
    const captain = makeUser()
    let { team } = createTeam(captain, { name: 'Z', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, [])
    const p = makeUser()
    team = requestJoin(null, team, p, [team]).team
    expect(team.pendingMemberIds).toContain(p.id)
    expect(team.memberIds).not.toContain(p.id)
    expect(() => approvePlayer(null, team, p.id, p)).toThrow(/Only the team captain/)
  })

  it('a team can register while still recruiting; registration never locks the roster', () => {
    const league = makeLeague(makeUser()) // no transfers
    // A brand-new, still-recruiting team can register right away.
    const half = createTeam(makeUser(), { name: 'Half Built', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, []).team
    const registered = enterLeague(league, half, half.captainId, [])
    expect(registered.team.leagueId).toBe(league.id)
    expect(registered.team.status).toBe('pending')
    expect(registered.team.rosterLocked).toBe(false) // locks only at kickoff

    // non-captains still can't register the team
    const { team, captain } = buildFreeTeam('Entrants FC')
    expect(() => enterLeague(league, team, makeUser().id, [registered.team])).toThrow(/captain/)

    const entered = enterLeague(league, team, captain.id, [registered.team]).team
    expect(entered.leagueId).toBe(league.id)
    expect(entered.rosterLocked).toBe(false)
    // no double-entry, and not while already in another league
    expect(() => enterLeague(league, entered, captain.id, [entered])).toThrow(/already registered/)
    const otherLeague = makeLeague(makeUser())
    expect(() => enterLeague(otherLeague, entered, captain.id, [entered])).toThrow(/another league/)
  })

  it('registration enforces capacity and one team per player', () => {
    const league = makeLeague(makeUser(), { minTeams: 2, maxTeams: 2 })
    const teams: Team[] = []
    for (const name of ['Cap A', 'Cap B']) teams.push(buildOfficialTeam(league, name, teams).team)

    // full league turns the next team away
    const third = buildFreeTeam('Cap C', teams)
    expect(() => enterLeague(league, third.team, third.captain.id, teams)).toThrow(/full/)

    // a player on a league team blocks their other team from registering
    const spare = makeLeague(makeUser(), { maxTeams: 8 })
    const inLeague = buildOfficialTeam(spare, 'First Club', [])
    let poached = buildFreeTeam('Second Club', [inLeague.team]).team
    const sharedPlayer = { ...makeUser(), id: inLeague.team.memberIds[1] }
    poached = requestJoin(null, poached, sharedPlayer, [inLeague.team, poached]).team
    poached = approvePlayer(null, poached, poached.captainId, sharedPlayer).team
    expect(() => enterLeague(spare, poached, poached.captainId, [inLeague.team])).toThrow(/already on/)
  })

  it('teams leave between seasons and survive their league', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['Stay FC', 'Go United']) teams.push(buildOfficialTeam(league, name, teams).team)
    const [, goUnited] = teams

    // with fixtures in the current season, leaving is blocked
    const fixtures = generateRoundRobin(league, teams)
    expect(() => leaveLeague(league, goUnited, goUnited.captainId, fixtures)).toThrow(/between seasons/)

    // with no fixtures, the captain can withdraw; the team stays whole and unlocked
    const left = leaveLeague(league, goUnited, goUnited.captainId, []).team
    expect(left.leagueId).toBeNull()
    expect(left.status).toBe('official')
    expect(left.rosterLocked).toBe(false)
    expect(left.memberIds).toEqual(goUnited.memberIds)
    // and it can enter a different league afterwards
    const nextLeague = makeLeague(makeUser())
    expect(enterLeague(nextLeague, left, left.captainId, []).team.leagueId).toBe(nextLeague.id)
  })

  it('enforces the roster maximum and prevents official teams dropping below the minimum', () => {
    const league = makeLeague(makeUser(), { maxPlayersPerTeam: 11 })
    const { team, captain } = buildOfficialTeam(league, 'Full Squad')
    // roster is at max (11) — no more joins
    expect(() => requestJoin(league, team, makeUser(), [team])).toThrow(/locked|full/)
    // removing anyone would drop an official team below the minimum
    const removable = team.memberIds.find((id) => id !== captain.id) as string
    expect(() => removePlayer(league, team, captain.id, removable)).toThrow(/at least 11/)
  })
})

describe('scheduling', () => {
  it('only schedules official teams, round robin covers every pairing once', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C', 'D']) teams.push(buildOfficialTeam(league, name, teams).team)
    const pending = createTeam(makeUser(), { name: 'Pending', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, teams).team

    const fixtures = generateRoundRobin(league, [...teams, pending])
    expect(fixtures).toHaveLength(6) // C(4,2)
    expect(fixtures.every((m) => m.homeTeamId !== pending.id && m.awayTeamId !== pending.id)).toBe(true)
    const pairs = new Set(fixtures.map((m) => [m.homeTeamId, m.awayTeamId].sort().join('|')))
    expect(pairs.size).toBe(6)
  })

  it('double round robin generates home and away legs', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C']) teams.push(buildOfficialTeam(league, name, teams).team)
    const fixtures = generateRoundRobin(league, teams, { double: true })
    expect(fixtures).toHaveLength(6) // 3 pairings × 2 legs
  })
})

describe('match verification', () => {
  function setup() {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const home = buildOfficialTeam(league, 'Home United')
    const away = buildOfficialTeam(league, 'Away City', [home.team])
    const [match] = generateRoundRobin(league, [home.team, away.team])
    return { commissioner, league, home, away, match }
  }

  it('score submission requires the competing captain and does not touch standings', () => {
    const { league, home, away, match } = setup()
    const notCaptain = makeUser()
    expect(() => submitScore(league, match, home.team, notCaptain, 2, 1)).toThrow(/captain/)
    expect(() => submitScore(league, match, home.team, home.captain, -1, 0)).toThrow(/non-negative/)

    const { match: pending } = submitScore(league, match, home.team, home.captain, 2, 1)
    expect(pending.status).toBe('awaiting-confirmation')
    const table = computeStandings(league, [home.team, away.team], [pending])
    expect(table.every((r) => r.played === 0)).toBe(true)
  })

  it('both captains confirming makes the result official and updates standings', () => {
    const { league, home, away, match } = setup()
    const { match: pending } = submitScore(league, match, home.team, home.captain, 3, 1)
    // submitter cannot confirm their own score
    expect(() => confirmScore(league, pending, home.team, home.captain)).toThrow(/own score/)

    const { match: official } = confirmScore(league, pending, away.team, away.captain)
    expect(official.status).toBe('official')
    expect(official.result).toMatchObject({ homeScore: 3, awayScore: 1, verifiedBy: 'captains' })

    const table = computeStandings(league, [home.team, away.team], [official])
    expect(table[0].teamId).toBe(home.team.id)
    expect(table[0].points).toBe(3)
    expect(table[0].goalDifference).toBe(2)
    expect(table[1].points).toBe(0)
  })

  it('disputes freeze standings until the commissioner resolves with evidence', () => {
    const { commissioner, league, home, away, match } = setup()
    const { match: pending } = submitScore(league, match, home.team, home.captain, 5, 0)
    const { match: disputed } = disputeScore(league, pending, away.team, away.captain, 'Score was 2-2')
    expect(disputed.status).toBe('disputed')
    expect(computeStandings(league, [home.team, away.team], [disputed]).every((r) => r.played === 0)).toBe(true)

    // random players cannot resolve
    expect(() => resolveDispute(league, disputed, makeUser(), 2, 2)).toThrow(/commissioner or an assigned referee/)

    const { match: resolved, audit } = resolveDispute(league, disputed, commissioner, 2, 2)
    expect(resolved.status).toBe('official')
    expect(resolved.result?.verifiedBy).toBe('commissioner')
    expect(audit[0].action).toBe('match.resolved')

    const table = computeStandings(league, [home.team, away.team], [resolved])
    expect(table.every((r) => r.draws === 1 && r.points === 1)).toBe(true)
  })

  it('assigned referees can resolve disputes', () => {
    const { league, home, away, match } = setup()
    const referee = makeUser()
    const withRef: League = { ...league, refereeIds: [referee.id] }
    const { match: pending } = submitScore(withRef, match, home.team, home.captain, 1, 0)
    const { match: disputed } = disputeScore(withRef, pending, away.team, away.captain, 'wrong')
    const { match: resolved } = resolveDispute(withRef, disputed, referee, 1, 1)
    expect(resolved.result?.verifiedBy).toBe('referee')
  })

  it('RSVPs: rostered players only, changeable, closed once the match is played', () => {
    const { league, home, away, match } = setup()
    const player = makeUser()
    expect(() => rsvp(league, match, player, home.team, 'in')).toThrow(/rostered/)

    const memberId = home.team.memberIds[1]
    const member: User = { ...makeUser(), id: memberId }
    let m = rsvp(league, match, member, home.team, 'in').match
    expect(rsvpCount(m, home.team.id)).toEqual({ in: 1, out: 0 })
    // changing your answer replaces it, never duplicates
    m = rsvp(league, m, member, home.team, 'out').match
    expect(rsvpCount(m, home.team.id)).toEqual({ in: 0, out: 1 })
    expect(rsvpCount(m, away.team.id)).toEqual({ in: 0, out: 0 })

    const played = submitScore(league, m, home.team, home.captain, 1, 0).match
    expect(() => rsvp(league, played, member, home.team, 'in')).toThrow(/before the match/)
  })

  it('records QR check-ins once per player', () => {
    const { league, home, match } = setup()
    const { match: checked } = checkIn(league, match, home.captain, home.team.id, true)
    expect(checked.checkIns).toHaveLength(1)
    expect(() => checkIn(league, checked, home.captain, home.team.id, true)).toThrow(/Already checked in/)
  })
})

describe('audit log', () => {
  it('entries are frozen — immutable and append-only', () => {
    const entry = auditEntry('league_1', 'user_1', 'match.score-submitted', 'test')
    expect(Object.isFrozen(entry)).toBe(true)
    expect(() => {
      ;(entry as { detail: string }).detail = 'tampered'
    }).toThrow()
  })

  it('every league action leaves an audit trail; free-team building stays off the league record', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner, { allowTransfers: true })
    const { team, captain } = buildFreeTeam('Trail FC')

    // building a free team is not league activity — nothing to audit yet
    const freeJoin = requestJoin(null, team, makeUser(), [team])
    expect(freeJoin.audit).toEqual([])

    const entered = enterLeague(league, team, captain.id, [])
    expect(entered.audit.map((a) => a.action)).toEqual(['team.entered-league'])

    const p = makeUser()
    const joined = requestJoin(league, entered.team, p, [entered.team])
    expect(joined.audit.map((a) => a.action)).toEqual(['team.player-joined'])

    const left = leaveLeague(league, entered.team, captain.id, [])
    expect(left.audit.map((a) => a.action)).toEqual(['team.left-league'])
  })
})

describe('season launch and league join codes', () => {
  it('mints a distinct join code for every league', () => {
    const a = makeLeague(makeUser())
    const b = makeLeague(makeUser())
    expect(a.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
    expect(a.joinCode).not.toBe(b.joinCode)
  })

  it('registration closes once the commissioner has launched the season', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['A', 'B']) teams.push(buildOfficialTeam(league, name, teams).team)

    // A latecomer can enter while the season is unlaunched...
    const late = buildFreeTeam('Latecomer', teams)
    expect(enterLeague(league, late.team, late.captain.id, teams, false).team.leagueId).toBe(league.id)

    // ...but not once fixtures have been drawn (season launched).
    expect(() => enterLeague(league, late.team, late.captain.id, teams, true)).toThrow(/already kicked off/)
  })

  it('league play allows draws (no playoff restriction)', () => {
    const league = makeLeague(makeUser())
    const home = buildOfficialTeam(league, 'Home', [])
    const away = buildOfficialTeam(league, 'Away', [home.team])
    const [match] = generateRoundRobin(league, [home.team, away.team])
    const { match: pending } = submitScore(league, match, home.team, home.captain, 1, 1)
    expect(pending.status).toBe('awaiting-confirmation')
    const { match: official } = confirmScore(league, pending, away.team, away.captain)
    expect(official.result).toMatchObject({ homeScore: 1, awayScore: 1 })
  })
})

describe('knockout cups', () => {
  function officialize(m: Match, h: number, a: number): Match {
    return { ...m, status: 'official', result: { homeScore: h, awayScore: a, verifiedAt: 1, verifiedBy: 'captains' } }
  }

  it('a cup needs a power-of-two field and seeds a clean bracket', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner, { scheduleFormat: 'knockout' })
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C']) teams.push(buildOfficialTeam(league, name, teams).team)
    expect(() => drawCup(league, teams, commissioner.id)).toThrow(/2, 4, 8, or 16/)
    expect(() => drawCup(league, teams.slice(0, 2), makeUser().id)).toThrow(/commissioner/)

    const four = [...teams, buildOfficialTeam(league, 'D', teams).team]
    const { matches: round1, audit } = drawCup(league, four, commissioner.id)
    expect(round1).toHaveLength(2)
    expect(round1.every((m) => m.stage === 'playoff' && m.playoffRound === 1 && m.season === 1)).toBe(true)
    expect(cupStarted(league.id, round1)).toBe(true)
    expect(audit[0].action).toBe('playoffs.started')
  })

  it('a cup tie cannot end level', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner, { scheduleFormat: 'knockout' })
    const teams: Team[] = []
    for (const name of ['A', 'B']) teams.push(buildOfficialTeam(league, name, teams).team)
    const { matches } = drawCup(league, teams, commissioner.id)
    const home = teams.find((t) => t.id === matches[0].homeTeamId)!
    const cap = makeUser({ id: home.captainId })
    expect(() => submitScore(league, matches[0], home, cap, 1, 1)).toThrow(/cannot end level/)
  })

  it('winners advance and the final decides the champion', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner, { scheduleFormat: 'knockout' })
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C', 'D']) teams.push(buildOfficialTeam(league, name, teams).team)
    const { matches: semis } = drawCup(league, teams, commissioner.id)
    let all = [...semis]

    expect(advanceCup(league, all, commissioner.id).matches).toHaveLength(0)
    all = all.map((m) => officialize(m, m.playoffSlot === 0 ? 2 : 0, m.playoffSlot === 0 ? 1 : 2))
    const adv = advanceCup(league, all, commissioner.id)
    expect(adv.matches).toHaveLength(1)
    const final = adv.matches[0]
    expect(final.playoffRound).toBe(2)
    expect(adv.championTeamId).toBeUndefined()

    all = [...all, officialize(final, 3, 0)]
    const done = advanceCup(league, all, commissioner.id)
    expect(done.matches).toHaveLength(0)
    expect(done.championTeamId).toBe(final.homeTeamId)

    // ending a cup season crowns the bracket winner
    const ended = endSeason(league, teams, all, commissioner.id)
    expect(ended.league.seasons[0].championTeamId).toBe(final.homeTeamId)
  })

  it('a cup season cannot be ended before the final is decided', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner, { scheduleFormat: 'knockout' })
    const teams: Team[] = []
    for (const name of ['A', 'B']) teams.push(buildOfficialTeam(league, name, teams).team)
    const { matches } = drawCup(league, teams, commissioner.id)
    expect(() => endSeason(league, teams, matches, commissioner.id)).toThrow(/Finish the cup/)
  })
})

describe('team-level statistics', () => {
  it('computes record, splits, streaks, clean sheets and biggest win from verified results only', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C'] as const) teams.push(buildOfficialTeam(league, name, teams).team)
    const [a, b, c] = teams
    const fixtures = generateRoundRobin(league, teams, { double: true })
    const between = (h: Team, w: Team) =>
      fixtures.filter((m) => (m.homeTeamId === h.id && m.awayTeamId === w.id) || (m.homeTeamId === w.id && m.awayTeamId === h.id))

    const officialize = (m: Match, homeScore: number, awayScore: number): Match => ({
      ...m,
      status: 'official',
      result: { homeScore, awayScore, verifiedAt: 1, verifiedBy: 'captains' },
    })
    const asA = (m: Match, aGoals: number, oppGoals: number) =>
      officialize(m, m.homeTeamId === a.id ? aGoals : oppGoals, m.homeTeamId === a.id ? oppGoals : aGoals)

    const [ab1, ab2] = between(a, b)
    const [ac1] = between(a, c)
    const results = [asA(ab1, 4, 0), asA(ab2, 2, 1), asA(ac1, 1, 1)]
    // sort by date to compute expectations regardless of fixture ordering
    const ordered = results.slice().sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt))
    const outcomes = ordered.map((m) => {
      const isHome = m.homeTeamId === a.id
      const s = isHome ? m.result!.homeScore : m.result!.awayScore
      const cc = isHome ? m.result!.awayScore : m.result!.homeScore
      return s > cc ? 'W' : s === cc ? 'D' : 'L'
    })

    const unverified: Match = { ...between(a, c)[1], status: 'awaiting-confirmation' }
    const stats = computeTeamStats(a.id, [...results, unverified])
    expect(stats.played).toBe(3)
    expect(stats.wins).toBe(2)
    expect(stats.draws).toBe(1)
    expect(stats.goalsFor).toBe(7)
    expect(stats.goalsAgainst).toBe(2)
    expect(stats.cleanSheets).toBe(1)
    expect(stats.biggestWin).toMatchObject({ opponentTeamId: b.id, scored: 4, conceded: 0 })
    expect(stats.home.wins + stats.away.wins).toBe(2)
    const lastOutcome = outcomes[outcomes.length - 1]
    expect(stats.currentStreak?.type).toBe(lastOutcome)
    expect(stats.longestWinStreak).toBeGreaterThanOrEqual(1)
  })
})

describe('seasons', () => {
  function officialize(m: Match, h: number, a: number): Match {
    return { ...m, status: 'official', result: { homeScore: h, awayScore: a, verifiedAt: 1, verifiedBy: 'captains' } }
  }

  it('crowns the table leader, archives the table, unlocks rosters, and isolates the next season', () => {
    const commissioner = makeUser()
    let league = makeLeague(commissioner)
    let teams: Team[] = []
    for (const name of ['One', 'Two', 'Three', 'Four']) teams.push(buildOfficialTeam(league, name, teams).team)
    const rank = (id: string) => teams.findIndex((t) => t.id === id)
    const season1 = generateRoundRobin(league, teams).map((m) => {
      const homeBetter = rank(m.homeTeamId) < rank(m.awayTeamId)
      return officialize(m, homeBetter ? 2 : 0, homeBetter ? 0 : 2)
    })
    // One > Two > Three > Four, so team One tops the table and is champion.
    const champId = teams[0].id

    // random members cannot end the season
    expect(() => endSeason(league, teams, season1, teams[0].id)).toThrow(/commissioner/)

    const ended = endSeason(league, teams, season1, commissioner.id)
    league = ended.league
    teams = ended.teams
    expect(league.currentSeason).toBe(2)
    expect(league.seasons).toHaveLength(1)
    expect(league.seasons[0].championTeamId).toBe(champId)
    expect(league.seasons[0].tableLeaderTeamId).toBe(champId)
    expect(league.seasons[0].table[0].points).toBe(9)
    expect(teams.every((t) => !t.rosterLocked)).toBe(true)
    expect(ended.audit[0].action).toBe('season.ended')

    // season 2 starts clean: standings empty, ready to launch again
    expect(computeStandings(league, teams, season1).every((r) => r.played === 0)).toBe(true)
    const season2 = generateRoundRobin(league, teams)
    expect(season2.every((m) => m.season === 2)).toBe(true)
    const withNew = [...season1, officialize(season2[0], 1, 0)]
    const table2 = computeStandings(league, teams, withNew)
    expect(table2.reduce((s, r) => s + r.played, 0)).toBe(2) // only the season-2 result
    expect(currentSeasonMatches(league, withNew)).toHaveLength(1)
  })

  it('refuses to archive an empty season', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const teams: Team[] = []
    for (const name of ['A', 'B']) teams.push(buildOfficialTeam(league, name, teams).team)
    expect(() => endSeason(league, teams, [], commissioner.id)).toThrow(/Nothing to archive/)
  })
})

describe('league administration', () => {
  it('settings edits are commissioner-only and keep structural rules safe', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    expect(() => updateLeague(league, makeUser().id, { description: 'x' })).toThrow(/commissioner/)
    expect(updateLeague(league, commissioner.id, { minPlayersPerTeam: 5 }).league.minPlayersPerTeam).toBe(PLATFORM_MIN_PLAYERS)
    expect(() => updateLeague(league, commissioner.id, { maxPlayersPerTeam: 3 })).toThrow(/Maximum players/)
    expect(() => updateLeague(league, commissioner.id, { scoring: { pointsForWin: 1, pointsForDraw: 1, pointsForLoss: 0 } })).toThrow(/worth more/)
    const updated = updateLeague(league, commissioner.id, {
      description: 'New rules',
      homeVenue: 'North Field',
      scoring: { pointsForWin: 2, pointsForDraw: 1, pointsForLoss: 0 },
      allowTransfers: true,
    })
    expect(updated.league.homeVenue).toBe('North Field')
    expect(updated.league.scoring.pointsForWin).toBe(2)
    expect(updated.audit[0].action).toBe('league.updated')
  })

  it('announcements and referees are commissioner-only and audit-logged', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const rando = makeUser()
    expect(() => postAnnouncement(league, rando, 'hi')).toThrow(/commissioner/)
    expect(() => postAnnouncement(league, commissioner, '   ')).toThrow(/empty/)
    const posted = postAnnouncement(league, commissioner, 'Season kicks off Saturday!')
    expect(posted.league.announcements).toHaveLength(1)
    expect(posted.audit[0].action).toBe('league.announcement')

    const ref = makeUser()
    expect(() => setReferee(league, rando.id, ref, true)).toThrow(/commissioner/)
    const assigned = setReferee(league, commissioner.id, ref, true)
    expect(assigned.league.refereeIds).toContain(ref.id)
    // assigning twice never duplicates
    expect(setReferee(assigned.league, commissioner.id, ref, true).league.refereeIds).toHaveLength(1)
    expect(setReferee(assigned.league, commissioner.id, ref, false).league.refereeIds).toHaveLength(0)
  })

  it('reschedules only unplayed fixtures, commissioner-only', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const teams: Team[] = []
    for (const name of ['R1', 'R2']) teams.push(buildOfficialTeam(league, name, teams).team)
    const [m] = generateRoundRobin(league, teams)
    expect(() => rescheduleMatch(league, m, teams[0].id, { venue: 'Elsewhere' })).toThrow(/commissioner/)
    expect(() => rescheduleMatch(league, m, commissioner.id, { scheduledAt: 'garbage' })).toThrow(/valid date/)
    const moved = rescheduleMatch(league, m, commissioner.id, { scheduledAt: '2026-09-01T18:00:00.000Z', venue: 'North Field' })
    expect(moved.match.venue).toBe('North Field')
    expect(moved.audit[0].action).toBe('match.rescheduled')
    const played: Match = { ...m, status: 'official', result: { homeScore: 1, awayScore: 0, verifiedAt: 1, verifiedBy: 'captains' } }
    expect(() => rescheduleMatch(league, played, commissioner.id, { venue: 'X' })).toThrow(/unplayed/)
  })
})

describe('standings tie-breakers and achievements', () => {
  it('breaks point ties by goal difference then goals for', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['Alpha', 'Beta', 'Gamma']) teams.push(buildOfficialTeam(league, name, teams).team)
    const [alpha, beta, gamma] = teams
    const fixtures = generateRoundRobin(league, teams)
    const find = (h: Team, a: Team) =>
      fixtures.find((m) => (m.homeTeamId === h.id && m.awayTeamId === a.id) || (m.homeTeamId === a.id && m.awayTeamId === h.id))!

    const officialize = (m: Match, homeScore: number, awayScore: number): Match => ({
      ...m,
      status: 'official',
      result: { homeScore, awayScore, verifiedAt: 1, verifiedBy: 'captains' },
    })
    // Alpha beats Gamma big; Beta beats Gamma small; Alpha–Beta draw → tie on points between Alpha & Beta
    const m1 = find(alpha, gamma)
    const m2 = find(beta, gamma)
    const m3 = find(alpha, beta)
    const results = [
      officialize(m1, m1.homeTeamId === alpha.id ? 4 : 0, m1.homeTeamId === alpha.id ? 0 : 4),
      officialize(m2, m2.homeTeamId === beta.id ? 1 : 0, m2.homeTeamId === beta.id ? 0 : 1),
      officialize(m3, 1, 1),
    ]
    const table = computeStandings(league, teams, results)
    expect(table[0].teamId).toBe(alpha.id)
    expect(table[0].points).toBe(table[1].points)
    expect(table[1].teamId).toBe(beta.id)
  })

  it('form guide reflects only verified results, oldest to newest', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C']) teams.push(buildOfficialTeam(league, name, teams).team)
    const [a] = teams
    const fixtures = generateRoundRobin(league, teams, { double: true })
    const mine = fixtures.filter((m) => m.homeTeamId === a.id || m.awayTeamId === a.id)
    const results: Match[] = mine.slice(0, 3).map((m, i): Match => {
      const aHome = m.homeTeamId === a.id
      const aScore = i === 0 ? 2 : i === 1 ? 1 : 0 // W, D, L for team A
      const oppScore = i === 0 ? 0 : i === 1 ? 1 : 3
      return {
        ...m,
        status: 'official',
        result: { homeScore: aHome ? aScore : oppScore, awayScore: aHome ? oppScore : aScore, verifiedAt: 1, verifiedBy: 'captains' },
      }
    })
    // an unverified submission must not appear in form
    const pending: Match = { ...mine[3], status: 'awaiting-confirmation' }
    const sorted = results.slice().sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt))
    const expected = sorted.map((m) => {
      const aHome = m.homeTeamId === a.id
      const s = aHome ? m.result!.homeScore : m.result!.awayScore
      const c = aHome ? m.result!.awayScore : m.result!.homeScore
      return s > c ? 'W' : s === c ? 'D' : 'L'
    })
    expect(formGuide(a.id, [...results, pending])).toEqual(expected)
  })

  it('power rankings order by quality, ignore playoffs, and report movement', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['Strong', 'Mid', 'Weak'] as const) teams.push(buildOfficialTeam(league, name, teams).team)
    const [strong, , weak] = teams
    const fixtures = generateRoundRobin(league, teams)
    const officialize = (m: Match, h: number, a: number): Match => ({
      ...m,
      status: 'official',
      result: { homeScore: h, awayScore: a, verifiedAt: 1, verifiedBy: 'captains' },
    })
    const rank = (id: string) => teams.findIndex((t) => t.id === id)
    const results = fixtures.map((m) => {
      const homeBetter = rank(m.homeTeamId) < rank(m.awayTeamId)
      return officialize(m, homeBetter ? 2 : 0, homeBetter ? 0 : 2)
    })

    const pr = powerRankings(league, teams, results)
    expect(pr).toHaveLength(3)
    expect(pr[0].teamId).toBe(strong.id)
    expect(pr[2].teamId).toBe(weak.id)
    expect(pr[0].rating).toBeGreaterThan(pr[2].rating)
    expect(pr.every((r) => r.rating >= 0 && r.rating <= 100)).toBe(true)

    // playoff results never affect the power rankings
    const playoffUpset: Match = {
      ...officialize(fixtures[0], 0, 9),
      id: 'po1',
      stage: 'playoff',
      playoffRound: 1,
      playoffSlot: 0,
      homeTeamId: strong.id,
      awayTeamId: weak.id,
    }
    expect(powerRankings(league, teams, [...results, playoffUpset])).toEqual(pr)

    // movement: sums to zero and reacts to the latest round
    expect(pr.reduce((s, r) => s + r.movement, 0)).toBe(0)
  })

  it('awards Champion and Perfect Season from verified results', () => {
    const league = makeLeague(makeUser())
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C', 'D']) teams.push(buildOfficialTeam(league, name, teams).team)
    const winner = teams[0]
    const fixtures = generateRoundRobin(league, teams).map((m): Match => {
      const winnerHome = m.homeTeamId === winner.id
      const winnerInvolved = winnerHome || m.awayTeamId === winner.id
      const homeScore = winnerInvolved ? (winnerHome ? 2 : 0) : 1
      const awayScore = winnerInvolved ? (winnerHome ? 0 : 2) : 1
      return { ...m, status: 'official', result: { homeScore, awayScore, verifiedAt: 1, verifiedBy: 'captains' } }
    })
    const awards = evaluateSeasonAchievements(league, teams, fixtures)
    expect(awards.find((a) => a.key === 'champion')?.teamId).toBe(winner.id)
    expect(awards.find((a) => a.key === 'perfect-season')?.teamId).toBe(winner.id)
  })
})

describe('club stats and league season stats', () => {
  function officialize(m: Match, h: number, a: number): Match {
    return { ...m, status: 'official', result: { homeScore: h, awayScore: a, verifiedAt: 1, verifiedBy: 'captains' } }
  }

  it('club profile aggregates the all-time record and the trophy cabinet', () => {
    const commissioner = makeUser()
    let league = makeLeague(commissioner)
    let teams: Team[] = []
    for (const name of ['One', 'Two', 'Three', 'Four']) teams.push(buildOfficialTeam(league, name, teams).team)
    const rank = (id: string) => teams.findIndex((t) => t.id === id)
    const season1 = generateRoundRobin(league, teams).map((m) => {
      const homeBetter = rank(m.homeTeamId) < rank(m.awayTeamId)
      return officialize(m, homeBetter ? 3 : 0, homeBetter ? 0 : 3)
    })
    const champ = teams[0]

    // before the season is archived, no titles yet — but the record exists
    const mid = clubProfile(champ.id, [league], season1)
    expect(mid.titles).toHaveLength(0)
    expect(mid.allTime.wins).toBeGreaterThan(0)

    const ended = endSeason(league, teams, season1, commissioner.id)
    league = ended.league
    teams = ended.teams

    const profile = clubProfile(champ.id, [league], season1)
    expect(profile.titles).toHaveLength(1)
    expect(profile.titles[0].kind).toBe('league')
    expect(profile.titles[0].season).toBe(1)
    expect(profile.appearances).toBe(1)
    expect(trophyCount(profile.titles)).toEqual({ total: 1, leagues: 1, cups: 0 })
    // all-time record survives the archive and matches the raw team stats
    expect(profile.allTime).toEqual(computeTeamStats(champ.id, season1))
  })

  it('a cup win counts as a cup trophy', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner, { scheduleFormat: 'knockout' })
    const teams: Team[] = []
    for (const name of ['A', 'B']) teams.push(buildOfficialTeam(league, name, teams).team)
    const { matches } = drawCup(league, teams, commissioner.id)
    const decided = [officialize(matches[0], 2, 1)]
    const ended = endSeason(league, teams, decided, commissioner.id)
    const winnerId = matches[0].homeTeamId
    const profile = clubProfile(winnerId, [ended.league], decided)
    expect(trophyCount(profile.titles)).toEqual({ total: 1, leagues: 0, cups: 1 })
  })

  it('league season stats report goals, result split, and leaders', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const teams: Team[] = []
    for (const name of ['A', 'B', 'C']) teams.push(buildOfficialTeam(league, name, teams).team)
    const [a, b, c] = teams
    const fixtures = generateRoundRobin(league, teams)
    const find = (h: Team, w: Team) =>
      fixtures.find((m) => (m.homeTeamId === h.id && m.awayTeamId === w.id) || (m.homeTeamId === w.id && m.awayTeamId === h.id))!
    const asHome = (m: Match, homeId: string, hs: number, as: number) =>
      m.homeTeamId === homeId ? officialize(m, hs, as) : officialize(m, as, hs)
    // A 5-0 B, A 2-1 C, B 1-1 C
    const results = [asHome(find(a, b), a.id, 5, 0), asHome(find(a, c), a.id, 2, 1), asHome(find(b, c), b.id, 1, 1)]

    const stats = leagueSeasonStats(league, teams, results)
    expect(stats.played).toBe(3)
    expect(stats.goals).toBe(5 + 2 + 1 + 1 + 1)
    expect(stats.results.draws).toBe(1)
    expect(stats.results.homeWins + stats.results.awayWins).toBe(2)
    expect(stats.topAttack?.teamId).toBe(a.id) // A scored the most (7)
    expect(stats.topAttack?.value).toBe(7)
    expect(stats.biggestWin?.margin).toBe(5)
    expect(stats.highestScoring?.total).toBe(5)
    expect(stats.avgGoals).toBeCloseTo(10 / 3, 1)
  })
})
