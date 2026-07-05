import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../core/config'
import { checkInvariants } from '../core/invariants'
import { createAccount } from '../core/account'
import { createLeague } from '../core/league'
import { createTeam, enterLeague } from '../core/team'
import { computeStandings } from '../core/standings'
import { emptyAppState, migrate, validateStateShape, saveState, loadState, clearState } from './persistence'
import { exportBackup, type BackupFile } from './backup'
import type { AppState } from './store'
import type { User } from '../core/types'
import type { StorageAdapter } from '../adapters/storage'

function memoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    available: true,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => (map.set(k, v), true),
    remove: (k) => void map.delete(k),
  }
}

function makeAccount(username: string, now: number): User {
  return createAccount(
    { username, email: `${username}@example.com`, phone: `+1555${username.length}000000`, password: 'stadium-lights-9' },
    [],
    now,
  )
}

/**
 * A small, valid sample state built entirely through the real domain
 * commands — a commissioner, a league, and a few registered teams. Used to
 * exercise persistence and backup against non-empty state without any
 * hard-coded or pre-seeded data.
 */
function sampleState(now = 1_700_000_000_000): AppState {
  const commissioner = makeAccount('commish', now)
  const { league, audit } = createLeague(
    commissioner,
    {
      name: 'Sample League',
      sport: 'football',
      logo: '⚽',
      banner: '',
      description: 'Built from real domain commands.',
      country: 'US',
      city: 'Portland',
      seasonStart: new Date(now).toISOString(),
      seasonEnd: new Date(now + 90 * 86400000).toISOString(),
      maxTeams: 8,
      minTeams: 2,
      minPlayersPerTeam: 11,
      maxPlayersPerTeam: 22,
      scheduleFormat: 'round-robin',
      scoring: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
      tieBreakers: ['goal-difference', 'goals-for'],
      privacy: 'public',
      allowTransfers: true,
    },
    now,
  )

  const users: User[] = [commissioner]
  let teams = [] as ReturnType<typeof createTeam>['team'][]
  const auditLog = [...audit]

  for (const name of ['Rovers', 'United', 'City']) {
    const captain = makeAccount(`cap_${name.toLowerCase()}`, now)
    users.push(captain)
    const created = createTeam(captain, { name, logo: '🦁', primaryColor: '#111', secondaryColor: '#fff', bio: '' }, teams, now)
    const entered = enterLeague(league, created.team, captain.id, teams, false, now)
    teams = [...teams, entered.team]
    auditLog.push(...entered.audit)
  }

  return { ...emptyAppState(), users, leagues: [league], teams, auditLog }
}

describe('fresh state is truly empty', () => {
  it('contains no users, leagues, teams, matches, audit entries, or session', () => {
    const s = emptyAppState()
    expect(s.users).toHaveLength(0)
    expect(s.leagues).toHaveLength(0)
    expect(s.teams).toHaveLength(0)
    expect(s.matches).toHaveLength(0)
    expect(s.auditLog).toHaveLength(0)
    expect(s.primaryAccountIds).toHaveLength(0)
    expect(s.currentUserId).toBeNull()
  })

  it('produces no standings and passes every invariant', () => {
    const s = emptyAppState()
    expect(checkInvariants(s)).toHaveLength(0)
    // no league exists, so there is nothing to compute standings for at all
    expect(s.leagues.flatMap((l) => computeStandings(l, s.teams, s.matches))).toHaveLength(0)
  })

  it('loading from empty storage yields no state and no corruption flag', () => {
    const storage = memoryStorage()
    const result = loadState(storage)
    expect(result.state).toBeNull()
    expect(result.corruptedRaw).toBeNull()
  })
})

describe('sample state built from real domain commands is valid', () => {
  it('has a league with registered teams and passes every invariant', () => {
    const state = sampleState()
    expect(state.leagues).toHaveLength(1)
    expect(state.teams.length).toBeGreaterThan(1)
    expect(state.teams.every((t) => t.leagueId === state.leagues[0].id)).toBe(true)
    expect(checkInvariants(state)).toHaveLength(0)
  })
})

describe('persistence envelope, save/load, migrations', () => {
  it('round-trips state with schema version and strips notifications', () => {
    const storage = memoryStorage()
    const user = makeAccount('saver', 1_700_000_000_000)
    const state: AppState = { ...emptyAppState(), users: [user], notifications: [{ id: 1, text: 'x', kind: 'info' }] }
    expect(saveState(state, storage, 123)).toBe(true)
    const loaded = loadState(storage)
    expect(loaded.state?.users[0].username).toBe('saver')
    expect(loaded.state?.notifications).toHaveLength(0)
    expect(loaded.corruptedRaw).toBeNull()
  })

  it('flags corrupted payloads instead of silently resetting', () => {
    const storage = memoryStorage()
    storage.set('leagueforge-state', '{not valid json')
    const result = loadState(storage)
    expect(result.state).toBeNull()
    expect(result.corruptedRaw).toBe('{not valid json')
  })

  it('refuses payloads from a newer schema', () => {
    const storage = memoryStorage()
    storage.set('leagueforge-state', JSON.stringify({ app: 'leagueforge', schemaVersion: SCHEMA_VERSION + 1, savedAt: 1, state: emptyAppState() }))
    const result = loadState(storage)
    expect(result.state).toBeNull()
    expect(result.corruptedRaw).not.toBeNull()
  })

  it('migrates v10 state: drops verification codes and verified flags', () => {
    const migrated = migrate(
      {
        users: [{ id: 'u1', username: 'old', emailVerified: true, phoneVerified: false, idVerified: false }],
        verifications: { u1: { emailCode: '111111', phoneCode: '222222' } },
      },
      10,
    )!
    expect(migrated.verifications).toBeUndefined()
    const user = (migrated.users as Record<string, unknown>[])[0]
    expect(user.username).toBe('old')
    expect(user.emailVerified).toBeUndefined()
    expect(user.phoneVerified).toBeUndefined()
    expect(user.idVerified).toBeUndefined()
  })

  it('walks the whole migration chain from v6 without gaps', () => {
    const migrated = migrate(
      {
        users: [{ id: 'u1', username: 'veteran', emailVerified: true }],
        leagues: [{ id: 'l1', commissionerId: 'u1', scheduleFormat: 'double-round-robin' }],
        matches: [{ id: 'm1', stage: 'playoff' }, { id: 'm2' }],
        verifications: { u1: { emailCode: '111111' } },
      },
      6,
    )!
    expect(migrated.verifications).toBeUndefined()
    expect((migrated.users as Record<string, unknown>[])[0].emailVerified).toBeUndefined()
    const league = (migrated.leagues as Record<string, unknown>[])[0]
    expect(league.scheduleFormat).toBe('round-robin')
    expect(typeof league.joinCode).toBe('string')
    expect(migrated.matches as unknown[]).toHaveLength(1) // playoff match dropped at v8→v9
  })

  it('validateStateShape rejects malformed structures', () => {
    expect(validateStateShape(null)).toBe(false)
    expect(validateStateShape({ users: 'nope' })).toBe(false)
    expect(validateStateShape({ ...emptyAppState(), users: [{ id: 1 }] })).toBe(false)
    expect(validateStateShape(emptyAppState())).toBe(true)
  })

  it('clearState wipes current and legacy keys', () => {
    const storage = memoryStorage()
    saveState(emptyAppState(), storage)
    storage.set('leagueforge-state-v6', '{}')
    clearState(storage)
    expect(storage.get('leagueforge-state')).toBeNull()
    expect(storage.get('leagueforge-state-v6')).toBeNull()
  })
})

describe('backup export', () => {
  it('exports a signed, versioned, re-parseable file with everything in it', () => {
    const state = sampleState()
    const parsed = JSON.parse(exportBackup(state, 999)) as BackupFile
    expect(parsed.app).toBe('leagueforge-backup')
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.exportedAt).toBe(999)
    expect(parsed.state.users).toHaveLength(state.users.length)
    expect(parsed.state.leagues).toHaveLength(1)
    expect(parsed.state.teams).toHaveLength(state.teams.length)
    // transient toasts never leave the device in a backup
    expect('notifications' in parsed.state).toBe(false)
  })

  it('exported state passes the same invariants as the live state', () => {
    const state = sampleState()
    const parsed = JSON.parse(exportBackup(state)) as BackupFile
    expect(checkInvariants({ ...emptyAppState(), ...parsed.state, notifications: [] } as AppState)).toHaveLength(0)
  })
})
