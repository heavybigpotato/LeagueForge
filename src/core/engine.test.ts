import { describe, expect, it } from 'vitest'
import type { League, Match, Team, User } from './types'
import { PLATFORM_MIN_PLAYERS } from './types'
import { createLeague } from './league'
import { approvePlayer, createPendingTeam, removePlayer, requestJoin, resolveMinPlayers } from './team'
import { generateRoundRobin } from './schedule'
import { checkIn, confirmScore, disputeScore, resolveDispute, rsvp, rsvpCount, submitScore } from './match'
import { powerRankings } from './powerRankings'
import { computeStandings, formGuide } from './standings'
import { newInviteCode, inviteLink } from './ids'
import { auditEntry } from './audit'
import { evaluateSeasonAchievements } from './achievements'
import { advancePlayoffs, bracket, bracketSize, playoffsStarted, startPlayoffs, winnerOf } from './playoffs'
import { computeTeamStats } from './teamStats'
import { postAnnouncement, setReferee, updateLeague } from './league'
import { rescheduleMatch } from './match'
import { currentSeasonMatches, endSeason } from './seasons'
import { checkPassword, createAccount, newVerificationCode, verifyEmail, verifyPhone } from './account'

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
    emailVerified: true,
    phoneVerified: true,
    idVerified: false,
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
    playoffFormat: 'single-elimination',
    scoring: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
    tieBreakers: ['goal-difference', 'goals-for', 'head-to-head'],
    privacy: 'public',
    allowTransfers: false,
    ...overrides,
  }).league
}

/** Build an official team by walking the full pending → official flow. */
function buildOfficialTeam(league: League, name: string, existing: Team[] = []): { team: Team; captain: User } {
  const captain = makeUser()
  let { team } = createPendingTeam(league, captain, { name, logo: '🛡️', primaryColor: '#111', secondaryColor: '#eee', bio: '' }, existing)
  while (team.memberIds.length < league.minPlayersPerTeam) {
    const p = makeUser()
    team = requestJoin(league, team, p, [...existing, team]).team
    team = approvePlayer(league, team, captain.id, p).team
  }
  expect(team.status).toBe('official')
  return { team, captain }
}

describe('invite codes', () => {
  it('generates 8-character unambiguous codes and links', () => {
    const code = newInviteCode()
    expect(code).toHaveLength(8)
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
    expect(inviteLink('ABC12345')).toBe('leagueforge.app/join/ABC12345')
  })
})

describe('accounts and verification', () => {
  it('creates unverified accounts with 6-digit codes for email and phone', () => {
    const { user, verification } = createAccount({ username: 'alex_r', email: 'alex@example.com', phone: '+15550001111', password: 'stadium-lights-9' }, [])
    expect(user.emailVerified).toBe(false)
    expect(user.phoneVerified).toBe(false)
    expect(verification.emailCode).toMatch(/^\d{6}$/)
    expect(verification.phoneCode).toMatch(/^\d{6}$/)
    expect(newVerificationCode()).toMatch(/^\d{6}$/)
  })

  it('rejects invalid or duplicate identities', () => {
    const { user } = createAccount({ username: 'taken', email: 'taken@example.com', phone: '+15550001111', password: 'stadium-lights-9' }, [])
    expect(() => createAccount({ username: 'x', email: 'a@b.co', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/At least 3/)
    expect(() => createAccount({ username: 'TAKEN', email: 'a@b.co', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/taken/)
    expect(() => createAccount({ username: 'newuser', email: 'not-an-email', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/email/)
    expect(() => createAccount({ username: 'newuser', email: 'taken@example.com', phone: '+15550001112', password: 'stadium-lights-9' }, [user])).toThrow(/already uses this email/)
    expect(() => createAccount({ username: 'newuser', email: 'a@b.co', phone: '12', password: 'stadium-lights-9' }, [user])).toThrow(/phone number/)
  })

  it('passwords: minimum length enforced, salted hash verifies, wrong password rejected', () => {
    expect(() =>
      createAccount({ username: 'shortpw', email: 's@example.com', phone: '+15550003333', password: 'short' }, []),
    ).toThrow(/At least 8/)
    const { user } = createAccount({ username: 'lockedin', email: 'l@example.com', phone: '+15550003334', password: 'stadium-lights-9' }, [])
    expect(user.passwordHash).not.toContain('stadium')
    expect(checkPassword(user, 'stadium-lights-9')).toBe(true)
    expect(checkPassword(user, 'stadium-lights-8')).toBe(false)
    // same password, different account → different hash (unique salts)
    const { user: other } = createAccount({ username: 'lockedin2', email: 'l2@example.com', phone: '+15550003335', password: 'stadium-lights-9' }, [user])
    expect(other.passwordHash).not.toBe(user.passwordHash)
  })

  it('verification requires the exact codes, in either order', () => {
    const { user, verification } = createAccount({ username: 'casey_v', email: 'c@example.com', phone: '+15550002222', password: 'stadium-lights-9' }, [])
    expect(() => verifyEmail(user, verification, '000000')).toThrow(/not correct/)
    const emailDone = verifyEmail(user, verification, verification.emailCode)
    expect(emailDone.emailVerified).toBe(true)
    expect(() => verifyPhone(emailDone, verification, 'nope')).toThrow(/not correct/)
    const done = verifyPhone(emailDone, verification, verification.phoneCode)
    expect(done.phoneVerified).toBe(true)
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

describe('pending team → official team activation', () => {
  it('creates the team as pending, not part of the league', () => {
    const league = makeLeague(makeUser())
    const captain = makeUser()
    const { team } = createPendingTeam(league, captain, { name: 'Thunder FC', logo: '⚡', primaryColor: '#000', secondaryColor: '#fff', bio: '' }, [])
    expect(team.status).toBe('pending')
    expect(team.memberIds).toEqual([captain.id])
    expect(team.inviteCode).toHaveLength(8)
    // pending team never appears in standings
    expect(computeStandings(league, [team], [])).toHaveLength(0)
  })

  it('requires verified email and phone to create or join a team', () => {
    const league = makeLeague(makeUser())
    const unverified = makeUser({ phoneVerified: false })
    expect(() =>
      createPendingTeam(league, unverified, { name: 'X', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, []),
    ).toThrow(/verified/)

    const captain = makeUser()
    const { team } = createPendingTeam(league, captain, { name: 'Y', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, [])
    expect(() => requestJoin(league, team, makeUser({ emailVerified: false }), [team])).toThrow(/verify/)
  })

  it('activates automatically when player #11 is approved, and locks the roster', () => {
    const league = makeLeague(makeUser()) // no transfers
    const captain = makeUser()
    let { team } = createPendingTeam(league, captain, { name: 'Thunder FC', logo: '⚡', primaryColor: '#000', secondaryColor: '#fff', bio: '' }, [])

    // captain + 9 approved teammates = 10 players → still pending
    for (let i = 0; i < 9; i++) {
      const p = makeUser()
      team = requestJoin(league, team, p, [team]).team
      team = approvePlayer(league, team, captain.id, p).team
    }
    expect(team.memberIds).toHaveLength(10)
    expect(team.status).toBe('pending')

    // player #11 joins and is approved → automatic activation
    const eleventh = makeUser()
    team = requestJoin(league, team, eleventh, [team]).team
    const event = approvePlayer(league, team, captain.id, eleventh)
    expect(event.activated).toBe(true)
    expect(event.team.status).toBe('official')
    expect(event.team.activatedAt).toBeDefined()
    expect(event.team.rosterLocked).toBe(true) // league does not allow transfers
    expect(event.audit.some((a) => a.action === 'team.activated')).toBe(true)
  })

  it('joining puts players in the captain approval queue, and only the captain approves', () => {
    const league = makeLeague(makeUser())
    const captain = makeUser()
    let { team } = createPendingTeam(league, captain, { name: 'Z', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, [])
    const p = makeUser()
    team = requestJoin(league, team, p, [team]).team
    expect(team.pendingMemberIds).toContain(p.id)
    expect(team.memberIds).not.toContain(p.id)
    expect(() => approvePlayer(league, team, p.id, p)).toThrow(/Only the team captain/)
  })

  it('blocks one account from joining two teams in the same league', () => {
    const league = makeLeague(makeUser())
    const capA = makeUser()
    const capB = makeUser()
    const a = createPendingTeam(league, capA, { name: 'A', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, []).team
    const b = createPendingTeam(league, capB, { name: 'B', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, [a]).team
    const p = makeUser()
    const a2 = requestJoin(league, a, p, [a, b]).team
    expect(() => requestJoin(league, b, p, [a2, b])).toThrow(/already on a team/)
    // a captain cannot create a second team in the league either
    expect(() => createPendingTeam(league, capA, { name: 'C', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, [a2, b])).toThrow(/already on a team/)
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
    const pending = createPendingTeam(league, makeUser(), { name: 'Pending', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, teams).team

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

  it('every step of the trust flow leaves an audit trail', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const captain = makeUser()
    const created = createPendingTeam(league, captain, { name: 'Trail FC', logo: '', primaryColor: '', secondaryColor: '', bio: '' }, [])
    expect(created.audit.map((a) => a.action)).toEqual(['team.created'])
    const p = makeUser()
    const joined = requestJoin(league, created.team, p, [created.team])
    expect(joined.audit.map((a) => a.action)).toEqual(['team.player-joined'])
    const approved = approvePlayer(league, joined.team, captain.id, p)
    expect(approved.audit.map((a) => a.action)).toEqual(['team.player-approved'])
  })
})

describe('playoffs', () => {
  function officialize(m: Match, homeScore: number, awayScore: number): Match {
    return { ...m, status: 'official', result: { homeScore, awayScore, verifiedAt: 1, verifiedBy: 'captains' } }
  }

  function leagueWithFourTeams() {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const teams: Team[] = []
    for (const name of ['One', 'Two', 'Three', 'Four']) teams.push(buildOfficialTeam(league, name, teams).team)
    // regular season: One > Two > Three > Four on points
    const fixtures = generateRoundRobin(league, teams)
    const rank = (id: string) => teams.findIndex((t) => t.id === id)
    const season = fixtures.map((m) => {
      const homeBetter = rank(m.homeTeamId) < rank(m.awayTeamId)
      return officialize(m, homeBetter ? 2 : 0, homeBetter ? 0 : 2)
    })
    return { commissioner, league, teams, season }
  }

  it('bracket size is the largest power of two that fits', () => {
    expect(bracketSize(2)).toBe(2)
    expect(bracketSize(3)).toBe(2)
    expect(bracketSize(4)).toBe(4)
    expect(bracketSize(7)).toBe(4)
    expect(bracketSize(9)).toBe(8)
  })

  it('only the commissioner can start playoffs, seeded 1v4 / 2v3, once', () => {
    const { commissioner, league, teams, season } = leagueWithFourTeams()
    expect(() => startPlayoffs(league, teams, season, teams[0].id)).toThrow(/commissioner/)

    const started = startPlayoffs(league, teams, season, commissioner.id)
    expect(started.matches).toHaveLength(2)
    expect(started.matches.every((m) => m.stage === 'playoff' && m.playoffRound === 1)).toBe(true)
    const semi1 = started.matches.find((m) => m.playoffSlot === 0)!
    const semi2 = started.matches.find((m) => m.playoffSlot === 1)!
    expect([semi1.homeTeamId, semi1.awayTeamId]).toEqual([teams[0].id, teams[3].id]) // 1 v 4
    expect([semi2.homeTeamId, semi2.awayTeamId]).toEqual([teams[1].id, teams[2].id]) // 2 v 3
    expect(started.audit[0].action).toBe('playoffs.started')

    expect(() => startPlayoffs(league, teams, [...season, ...started.matches], commissioner.id)).toThrow(/already started/)
  })

  it('playoff matches never count toward standings and cannot end in a draw', () => {
    const { commissioner, league, teams, season } = leagueWithFourTeams()
    const { matches: semis } = startPlayoffs(league, teams, season, commissioner.id)
    const before = computeStandings(league, teams, season)
    const after = computeStandings(league, teams, [...season, officialize(semis[0], 3, 0)])
    expect(after).toEqual(before)

    const captain = state(teams[0])
    expect(() => submitScore(league, semis[0], teams[0], captain, 1, 1)).toThrow(/cannot end in a draw/)

    function state(team: Team): User {
      return makeUser({ id: team.captainId, username: 'cap' })
    }
  })

  it('winners auto-advance to the final and a champion is crowned', () => {
    const { commissioner, league, teams, season } = leagueWithFourTeams()
    const { matches: semis } = startPlayoffs(league, teams, season, commissioner.id)
    let all = [...season, ...semis]

    // nothing advances while the semis are undecided
    expect(advancePlayoffs(league, all, commissioner.id).matches).toHaveLength(0)

    const semi1 = semis.find((m) => m.playoffSlot === 0)!
    const semi2 = semis.find((m) => m.playoffSlot === 1)!
    all = all.map((m) => (m.id === semi1.id ? officialize(m, 2, 1) : m.id === semi2.id ? officialize(m, 0, 1) : m))

    const adv = advancePlayoffs(league, all, commissioner.id)
    expect(adv.matches).toHaveLength(1)
    const final = adv.matches[0]
    expect(final.playoffRound).toBe(2)
    expect(final.homeTeamId).toBe(teams[0].id) // semi 1 winner (seed 1)
    expect(final.awayTeamId).toBe(teams[2].id) // semi 2 winner (seed 3 upset)
    expect(adv.championTeamId).toBeUndefined()

    all = [...all, officialize(final, 1, 3)]
    const done = advancePlayoffs(league, all, commissioner.id)
    expect(done.matches).toHaveLength(0)
    expect(done.championTeamId).toBe(teams[2].id)

    const b = bracket(league.id, all)!
    expect(b.roundNames).toEqual(['Semifinals', 'Final'])
    expect(b.rounds[0]).toHaveLength(2)
    expect(b.rounds[1]).toHaveLength(1)
    expect(b.championTeamId).toBe(teams[2].id)
    expect(winnerOf(all.find((m) => m.id === final.id))).toBe(teams[2].id)
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

  it('archives the table and champion, unlocks rosters, and isolates the next season', () => {
    const commissioner = makeUser()
    let league = makeLeague(commissioner)
    let teams: Team[] = []
    for (const name of ['One', 'Two', 'Three', 'Four']) teams.push(buildOfficialTeam(league, name, teams).team)
    const rank = (id: string) => teams.findIndex((t) => t.id === id)
    const season1 = generateRoundRobin(league, teams).map((m) => {
      const homeBetter = rank(m.homeTeamId) < rank(m.awayTeamId)
      return officialize(m, homeBetter ? 2 : 0, homeBetter ? 0 : 2)
    })

    // playoffs decided: seed 3 wins its semi away, then upsets seed 1 in the final
    const { matches: semis } = startPlayoffs(league, teams, season1, commissioner.id)
    let all = [...season1, ...semis.map((m) => officialize(m, m.playoffSlot === 0 ? 2 : 0, m.playoffSlot === 0 ? 0 : 2))]
    const adv = advancePlayoffs(league, all, commissioner.id)
    all = [...all, officialize(adv.matches[0], 0, 1)]
    const champId = advancePlayoffs(league, all, commissioner.id).championTeamId!
    expect(champId).toBe(teams[2].id)

    // random members cannot end the season
    expect(() => endSeason(league, teams, all, teams[0].id)).toThrow(/commissioner/)

    const ended = endSeason(league, teams, all, commissioner.id)
    league = ended.league
    teams = ended.teams
    expect(league.currentSeason).toBe(2)
    expect(league.seasons).toHaveLength(1)
    expect(league.seasons[0].championTeamId).toBe(champId)
    expect(league.seasons[0].tableLeaderTeamId).toBe(teams[0].id)
    expect(league.seasons[0].table[0].points).toBe(9)
    expect(teams.every((t) => !t.rosterLocked)).toBe(true)
    expect(ended.audit[0].action).toBe('season.ended')

    // season 2 starts clean: standings empty, playoffs can run again
    expect(computeStandings(league, teams, all).every((r) => r.played === 0)).toBe(true)
    expect(playoffsStarted(league.id, all, league.currentSeason)).toBe(false)
    const season2 = generateRoundRobin(league, teams)
    expect(season2.every((m) => m.season === 2)).toBe(true)
    const withNew = [...all, officialize(season2[0], 1, 0)]
    const table2 = computeStandings(league, teams, withNew)
    expect(table2.reduce((s, r) => s + r.played, 0)).toBe(2) // only the season-2 result
    expect(currentSeasonMatches(league, withNew)).toHaveLength(season2.length ? 1 : 0)

    // history still reads season 1's bracket
    expect(bracket(league.id, all, 1)?.championTeamId).toBe(champId)
  })

  it('refuses to archive an empty season', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner)
    const teams: Team[] = []
    for (const name of ['A', 'B']) teams.push(buildOfficialTeam(league, name, teams).team)
    expect(() => endSeason(league, teams, [], commissioner.id)).toThrow(/Nothing to archive/)
  })
})

describe('knockout cup format', () => {
  it('the whole season can be a bracket: seeded, no draws, champion crowned', () => {
    const commissioner = makeUser()
    const league = makeLeague(commissioner, { scheduleFormat: 'knockout' })
    const teams: Team[] = []
    for (const name of ['C1', 'C2', 'C3', 'C4']) teams.push(buildOfficialTeam(league, name, teams).team)

    // drawing the cup = starting the bracket with no regular season
    const { matches: round1 } = startPlayoffs(league, teams, [], commissioner.id)
    expect(round1).toHaveLength(2)
    expect(round1.every((m) => m.stage === 'playoff' && m.season === 1)).toBe(true)

    const decided = round1.map((m) => ({ ...m, status: 'official' as const, result: { homeScore: 1, awayScore: 0, verifiedAt: 1, verifiedBy: 'captains' as const } }))
    const adv = advancePlayoffs(league, decided, commissioner.id)
    expect(adv.matches).toHaveLength(1)
    const final = { ...adv.matches[0], status: 'official' as const, result: { homeScore: 2, awayScore: 1, verifiedAt: 1, verifiedBy: 'captains' as const } }
    expect(advancePlayoffs(league, [...decided, final], commissioner.id).championTeamId).toBe(final.homeTeamId)
    // and the standings stay untouched — a cup has no table
    expect(computeStandings(league, teams, [...decided, final]).every((r) => r.played === 0)).toBe(true)
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

    const unverifiedRef = makeUser({ phoneVerified: false })
    expect(() => setReferee(league, commissioner.id, unverifiedRef, true)).toThrow(/verified/)
    const ref = makeUser()
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
