import type { ScheduleFormat, Sport } from './types'

/**
 * Central configuration for the whole platform. Nothing here is app DATA —
 * these are rules, limits, registries, and keys. All league/team/match/user
 * content is created by users at runtime (or by the explicit guided demo).
 */

/** Bump when the persisted state shape changes; add a migration alongside. */
export const SCHEMA_VERSION = 7

/** Single source of truth for local persistence. */
export const STORAGE_KEY = 'leagueforge-state'
/** Older keys we know how to migrate from, newest first. */
export const LEGACY_STORAGE_KEYS = ['leagueforge-state-v6']

export const INVITE_CODE = {
  length: 8,
  /** No 0/O or 1/I lookalikes. */
  alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const

export const VERIFICATION = {
  codeDigits: 6,
  /** Demo codes are generated locally and expire like real ones would. */
  ttlMs: 15 * 60 * 1000,
} as const

export const PASSWORD_MIN_LENGTH = 8

/** Platform-wide floor for roster size; leagues may raise it, never lower. */
export const PLATFORM_MIN_PLAYERS = 11

export const LIMITS = {
  minTeams: 2,
  maxTeams: 64,
  maxRoster: 60,
  maxBracket: 16,
  announcementMaxLength: 500,
} as const

/** Password used by guided-demo accounts so they can be switched into. */
export const DEMO_PASSWORD = 'leagueforge-demo'

export interface SportInfo {
  id: Sport
  label: string
  /** What a unit of score is called in this sport. */
  scoreUnit: string
  allowsDraws: boolean
}

export const SPORTS: SportInfo[] = [
  { id: 'football', label: 'Football (soccer)', scoreUnit: 'goals', allowsDraws: true },
  { id: 'basketball', label: 'Basketball', scoreUnit: 'points', allowsDraws: false },
  { id: 'volleyball', label: 'Volleyball', scoreUnit: 'sets', allowsDraws: false },
  { id: 'cricket', label: 'Cricket', scoreUnit: 'runs', allowsDraws: true },
  { id: 'baseball', label: 'Baseball', scoreUnit: 'runs', allowsDraws: false },
  { id: 'hockey', label: 'Hockey', scoreUnit: 'goals', allowsDraws: true },
  { id: 'rugby', label: 'Rugby', scoreUnit: 'points', allowsDraws: true },
  { id: 'tennis', label: 'Tennis', scoreUnit: 'sets', allowsDraws: false },
  { id: 'pickleball', label: 'Pickleball', scoreUnit: 'games', allowsDraws: false },
  { id: 'esports', label: 'Esports', scoreUnit: 'maps', allowsDraws: false },
  { id: 'chess', label: 'Chess', scoreUnit: 'points', allowsDraws: true },
  { id: 'custom', label: 'Custom sport', scoreUnit: 'points', allowsDraws: true },
]

export interface FormatInfo {
  id: ScheduleFormat
  label: string
  implemented: boolean
  description: string
}

/** League format registry. Unimplemented formats are visible but unselectable. */
export const FORMATS: FormatInfo[] = [
  { id: 'round-robin', label: 'Round robin', implemented: true, description: 'Everyone plays everyone once; playoffs optional.' },
  { id: 'double-round-robin', label: 'Double round robin', implemented: true, description: 'Home and away against every team.' },
  { id: 'knockout', label: 'Knockout cup', implemented: true, description: 'The whole season is a single-elimination bracket.' },
  { id: 'groups', label: 'Groups + knockout', implemented: false, description: 'Coming soon.' },
  { id: 'swiss', label: 'Swiss system', implemented: false, description: 'Coming soon.' },
  { id: 'ladder', label: 'Ladder', implemented: false, description: 'Coming soon.' },
]

/** Route paths, centralized so navigation never uses stray strings. */
export const ROUTES = {
  home: '/',
  createLeague: '/create-league',
  league: (id = ':leagueId') => `/league/${id}`,
  leagueSettings: (id = ':leagueId') => `/league/${id}/settings`,
  createTeam: (id = ':leagueId') => `/league/${id}/create-team`,
  team: (id = ':teamId') => `/team/${id}`,
  match: (id = ':matchId') => `/match/${id}`,
  matchLive: (id = ':matchId') => `/match/${id}/live`,
  join: '/join',
  joinCode: (code = ':code') => `/join/${code}`,
  profile: '/profile',
  dataCenter: '/data',
} as const
