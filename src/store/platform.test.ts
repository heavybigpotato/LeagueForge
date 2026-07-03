import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../core/config'
import { checkInvariants } from '../core/invariants'
import { createAccount, newVerification, verifyEmail } from '../core/account'
import { computeStandings } from '../core/standings'
import { emptyAppState, migrate, validateStateShape, saveState, loadState, clearState } from './persistence'
import { exportBackup, validateBackup } from './backup'
import { buildGuidedDemo, hasDemoData, removeDemoData } from './demo'
import type { AppState } from './store'
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

describe('guided demo is explicit, labeled, and isolated', () => {
  it('appears only when built, flags every entity, and passes invariants', () => {
    const demo = buildGuidedDemo([], 1_700_000_000_000)
    expect(demo.users.length).toBeGreaterThan(40)
    expect(demo.users.every((u) => u.isDemo)).toBe(true)
    expect(demo.league.isDemo).toBe(true)
    expect(demo.teams.every((t) => t.leagueId === demo.league.id)).toBe(true)
    // demo went through the real pending → official flow
    expect(demo.teams.every((t) => t.status === 'official')).toBe(true)
    const state: AppState = {
      ...emptyAppState(),
      users: demo.users,
      leagues: [demo.league],
      teams: demo.teams,
      matches: demo.matches,
      auditLog: demo.audit,
    }
    expect(checkInvariants(state)).toHaveLength(0)
    expect(hasDemoData(state)).toBe(true)
  })

  it('removal deletes only demo-flagged content, never user data', () => {
    // a real user with a real league
    const real = createAccount({ username: 'realuser', email: 'r@example.com', phone: '+15550001111', password: 'stadium-lights-9' }, [])
    const demo = buildGuidedDemo([real.user], 1_700_000_000_000)
    const state: AppState = {
      ...emptyAppState(),
      users: [real.user, ...demo.users],
      leagues: [demo.league],
      teams: demo.teams,
      matches: demo.matches,
      auditLog: demo.audit,
      primaryAccountIds: [real.user.id, demo.commissionerId],
      currentUserId: demo.commissionerId,
    }
    const cleaned = removeDemoData(state)
    expect(cleaned.users.map((u) => u.username)).toEqual(['realuser'])
    expect(cleaned.leagues).toHaveLength(0)
    expect(cleaned.teams).toHaveLength(0)
    expect(cleaned.matches).toHaveLength(0)
    expect(cleaned.auditLog).toHaveLength(0)
    expect(cleaned.primaryAccountIds).toEqual([real.user.id])
    expect(cleaned.currentUserId).toBeNull() // signed-in demo account is gone
    expect(hasDemoData(cleaned)).toBe(false)
  })

  it('demo usernames never collide with existing accounts', () => {
    const taken = createAccount({ username: 'demo_commissioner', email: 'd@example.com', phone: '+15550002222', password: 'stadium-lights-9' }, [])
    const demo = buildGuidedDemo([taken.user], 1_700_000_000_000)
    const names = new Set([taken.user.username, ...demo.users.map((u) => u.username)])
    expect(names.size).toBe(1 + demo.users.length)
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
    const demo = buildGuidedDemo([], 1_700_000_000_000)
    const state: AppState = {
      ...emptyAppState(),
      users: demo.users,
      leagues: [demo.league],
      teams: demo.teams,
      matches: demo.matches,
      auditLog: demo.audit,
    }
    const json = exportBackup(state, 999)
    const preview = validateBackup(json)
    expect(preview.ok).toBe(true)
    expect(preview.schemaVersion).toBe(SCHEMA_VERSION)
    expect(preview.exportedAt).toBe(999)
    expect(preview.counts?.leagues).toBe(1)
    expect(preview.counts?.teams).toBe(demo.teams.length)
    expect(preview.counts?.users).toBe(demo.users.length)
    expect(preview.violations).toHaveLength(0)
    expect(preview.state?.matches).toHaveLength(demo.matches.length)
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
    const demo = buildGuidedDemo([], 1_700_000_000_000)
    const state: AppState = {
      ...emptyAppState(),
      users: demo.users,
      leagues: [demo.league],
      teams: demo.teams,
      // orphaned match: drop the teams' league linkage by removing a team
      matches: demo.matches,
      auditLog: demo.audit,
    }
    state.teams = state.teams.slice(1)
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
