import type { ScheduleFormat, Sport } from './types'

/**
 * Central configuration for the whole platform. Nothing here is app DATA —
 * these are rules, limits, registries, and keys. All league/team/match/user
 * content is created by users at runtime.
 */

/** Bump when the persisted state shape changes; add a migration alongside. */
export const SCHEMA_VERSION = 11

/** Single source of truth for local persistence. */
export const STORAGE_KEY = 'leagueforge-state'
/** Older keys we know how to migrate from, newest first. */
export const LEGACY_STORAGE_KEYS = ['leagueforge-state-v6']

export const INVITE_CODE = {
  length: 8,
  /** No 0/O or 1/I lookalikes. */
  alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const

export const PASSWORD_MIN_LENGTH = 8

/**
 * LeagueForge Pro — the in-app purchase. One lifetime unlock, sold through a
 * hosted checkout (Gumroad / Lemon Squeezy / Stripe Payment Link) and
 * delivered as a license key the buyer types into the app.
 *
 * With an empty checkoutUrl every purchase surface disappears — no teaser,
 * no dead button. To go live: create the product on your payment provider,
 * paste its checkout link here, change keySecret, and mint keys with
 * `npm run pro:key`. Payout details (bank/IBAN) live in the provider's
 * dashboard, never in code. Full walkthrough: docs/MONETIZATION.md.
 */
export const PRO = {
  /** Hosted checkout URL, e.g. 'https://yourname.gumroad.com/l/leagueforge-pro'. Empty hides Pro everywhere. */
  checkoutUrl: '',
  /** CHANGE THIS before selling — license keys are minted and checked with it. */
  keySecret: 'leagueforge-dev-secret-change-me',
  price: '4.99',
  currency: '€',
} as const

/** Accent theme packs — the cosmetic side of the Pro unlock. */
export const ACCENTS = [
  { id: 'volt', label: 'Volt', pro: false },
  { id: 'ember', label: 'Ember', pro: true },
  { id: 'ocean', label: 'Ocean', pro: true },
  { id: 'rose', label: 'Rose', pro: true },
  { id: 'gold', label: 'Gold', pro: true },
] as const

export type AccentId = (typeof ACCENTS)[number]['id']

/** Platform-wide floor for roster size; leagues may raise it, never lower. */
export const PLATFORM_MIN_PLAYERS = 11

export const LIMITS = {
  minTeams: 2,
  maxTeams: 64,
  maxRoster: 60,
  maxBracket: 16,
  announcementMaxLength: 500,
} as const

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

/** The two ways to run a competition. */
export const FORMATS: FormatInfo[] = [
  { id: 'round-robin', label: 'League', implemented: true, description: 'Everyone plays everyone once; the table decides the champion.' },
  { id: 'knockout', label: 'Knockout cup', implemented: true, description: 'Single-elimination bracket; win or go home.' },
]

/** Route paths, centralized so navigation never uses stray strings. */
export const ROUTES = {
  home: '/',
  createLeague: '/create-league',
  league: (id = ':leagueId') => `/league/${id}`,
  leagueSettings: (id = ':leagueId') => `/league/${id}/settings`,
  leagueActivity: (id = ':leagueId') => `/league/${id}/activity`,
  createTeam: '/create-team',
  discover: '/discover',
  team: (id = ':teamId') => `/team/${id}`,
  match: (id = ':matchId') => `/match/${id}`,
  matchLive: (id = ':matchId') => `/match/${id}/live`,
  join: '/join',
  joinCode: (code = ':code') => `/join/${code}`,
  profile: '/profile',
  dataCenter: '/data',
  privacy: '/privacy',
  terms: '/terms',
} as const
