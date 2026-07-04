import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../core/config'
import { checkInvariants } from '../core/invariants'
import { createAccount, newVerification, verifyEmail } from '../core/account'
import { createLeague } from '../core/league'
import { createTeam, enterLeague } from '../core/team'
import { computeStandings } from '../core/standings'
import { emptyAppState, migrate, validateStateShape, saveState, loadState, clearState } from './persistence'
import { exportBackup, validateBackup } from './backup'
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

function verifiedUser(username: string, now: number): User {
  const { user } = createAccount(
    { username, email: `${username}@example.com`, phone: `+1555${username.length}000000`, password: 'stadium-lights-9' },
    [],
    now,
  )
  return { ...user, emailVerified: true, phoneVerified: true }
}

/**
 * A small, valid sample state built entirely through the real domain
 * commands — a commissioner, a league, and a few registered teams. Used to
 * exercise backup export/import against non-empty state without any
 * hard-coded or pre-seeded data.
 */
function sampleState(now = 1_700_000_000_000): AppState {
  const commissioner = verifiedUser('commish', now)
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
    const captain = verifiedUser(`cap_${name.toLowerCase()}`, now)
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
    expect(Object.keys(s.verifications)).toHaveLength(0)
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
    const account = createAccount({ username: 'saver', email: 's@example.com', phone: '+15550003333', password: 'stadium-lights-9' }, [])
    const state: AppState = { ...emptyAppState(), users: [account.user], notifications: [{ id: 1, text: 'x', kind: 'info' }] }
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

  it('migrates v6 verifications by adding an expiry model', () => {
    const migrated = migrate({ verifications: { u1: { emailCode: '111111', phoneCode: '222222' } } }, 6)!
    const v = (migrated.verifications as Record<string, { expiresAt: number }>).u1
    expect(v.expiresAt).toBeGreaterThan(Date.now())
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

describe('backup export/import', () => {
  it('exports and re-validates a full round trip with counts', () => {
    const state = sampleState()
    const json = exportBackup(state, 999)
    const preview = validateBackup(json)
    expect(preview.ok).toBe(true)
    expect(preview.schemaVersion).toBe(SCHEMA_VERSION)
    expect(preview.exportedAt).toBe(999)
    expect(preview.counts?.leagues).toBe(1)
    expect(preview.counts?.teams).toBe(state.teams.length)
    expect(preview.counts?.users).toBe(state.users.length)
    expect(preview.violations).toHaveLength(0)
    expect(preview.state?.matches).toHaveLength(state.matches.length)
  })

  it('rejects malformed files with clear errors', () => {
    expect(validateBackup('not json').errors[0]).toMatch(/not valid JSON/)
    expect(validateBackup('{}').errors[0]).toMatch(/not a LeagueForge backup/)
    expect(validateBackup(JSON.stringify({ app: 'leagueforge-backup' })).errors[0]).toMatch(/schema version/)
    expect(
      validateBackup(JSON.stringify({ app: 'leagueforge-backup', schemaVersion: SCHEMA_VERSION + 5, state: {} })).errors[0],
    ).toMatch(/newer than this app/)
    expect(
      validateBackup(JSON.stringify({ app: 'leagueforge-backup', schemaVersion: SCHEMA_VERSION, state: { users: 'x' } })).errors[0],
    ).toMatch(/malformed/)
  })

  it('detects duplicate ids', () => {
    const account = createAccount({ username: 'dupe', email: 'd2@example.com', phone: '+15550004444', password: 'stadium-lights-9' }, [])
    const state: AppState = { ...emptyAppState(), users: [account.user, account.user] }
    const preview = validateBackup(exportBackup(state))
    expect(preview.ok).toBe(false)
    expect(preview.errors[0]).toMatch(/duplicate user ids/)
  })

  it('surfaces invariant violations as warnings, not silent acceptance', () => {
    const state = sampleState()
    // Break referential integrity: a league whose commissioner no longer exists.
    state.users = state.users.filter((u) => u.id !== state.leagues[0].commissionerId)
    const preview = validateBackup(exportBackup(state))
    expect(preview.ok).toBe(true)
    expect(preview.warnings.length).toBeGreaterThan(0)
  })
})

describe('verification codes expire', () => {
  it('rejects codes after the TTL and accepts regenerated ones', () => {
    const t0 = 1_700_000_000_000
    const account = createAccount(
      { username: 'expiry', email: 'e@example.com', phone: '+15550005555', password: 'stadium-lights-9' },
      [],
      t0,
    )
    const late = account.verification.expiresAt + 1
    expect(() => verifyEmail(account.user, account.verification, account.verification.emailCode, late)).toThrow(/expired/)
    const fresh = newVerification(late)
    const verified = verifyEmail(account.user, fresh, fresh.emailCode, late + 1000)
    expect(verified.emailVerified).toBe(true)
  })
})
