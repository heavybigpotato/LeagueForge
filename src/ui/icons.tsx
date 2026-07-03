import type { Team } from '../core/types'

/**
 * Hand-tuned 24×24 stroke icon set (Lucide-style geometry) so the app ships
 * zero icon dependencies and never falls back to emoji.
 */
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z',
  trophy: 'M8 21h8m-4-4v4m-6-17h12v5a6 6 0 0 1-12 0V4Zm12 2h2a2 2 0 0 1-2 4h-.5M6 6H4a2 2 0 0 0 2 4h.5',
  ticket: 'M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7Zm10-1v2m0 4v2m0 4v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 12 0M16 3.5a4 4 0 0 1 0 7.4M21 20a6 6 0 0 0-4-5.5',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3-3v4m8-4v4M4 10h16',
  shield: 'M12 2 20 5v6c0 5.5-3.3 9.6-8 11-4.7-1.4-8-5.5-8-11V5l8-3Z',
  shieldCheck: 'M12 2 20 5v6c0 5.5-3.3 9.6-8 11-4.7-1.4-8-5.5-8-11V5l8-3Zm-3.5 9.5 2.5 2.5 4.5-4.5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 3 22 20H2L12 3Zm0 7v4m0 3v.5',
  plus: 'M12 5v14M5 12h14',
  chevronRight: 'm9 5 7 7-7 7',
  arrowLeft: 'M19 12H5m6-7-7 7 7 7',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 3h3m3 0v3m-6 0h3m3-6h-6v3',
  mapPin: 'M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.5 2',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  whistle: 'M14 9h7v4a7 7 0 1 1-7-7v3ZM9.5 13.5v.5M14 4V2m4 4 1.5-1.5',
  scroll: 'M7 3h11a2 2 0 0 1 2 2v2h-4M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2H9M7 3v14m4-10h5m-5 4h5',
  sparkle: 'M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5 12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  gauge: 'M12 20a8 8 0 1 1 8-8m-8 8a8 8 0 0 1-8-8m8 8v-2m6.4-11.4L14 11a2 2 0 1 1-2.8 2.8',
  send: 'M21 3 10 14m11-11-7 18-4-7-7-4 18-7Z',
  eye: 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  flame: 'M12 22c4 0 7-2.7 7-6.6 0-3.2-2-5.5-3.6-7.4-.8-1-2-2.3-2.4-4-2 1.5-3 3.5-3 5.5-1-.7-1.6-1.7-1.8-3C6 8.5 5 10.9 5 13.4 5 19.3 8 22 12 22Zm0 0c-1.7 0-3-1.4-3-3.2 0-1.5 1-2.5 1.8-3.6.5-.6 1-1.3 1.2-2.2 1.4 1.2 3 3 3 5.8 0 1.8-1.3 3.2-3 3.2Z',
}

export function Icon({ name, size = 18, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.shield} />
    </svg>
  )
}

/**
 * Generated crest: every team gets a real badge built from its colors and
 * monogram — no emoji, no uploads required. Two crest shapes keyed off the
 * team id keep a league from looking uniform.
 */
export function Crest({ team, size = 44 }: { team: Team; size?: number }) {
  const initials = monogram(team.name)
  const uid = `crest-${team.id}`
  const round = hashCode(team.id) % 2 === 0
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={team.primaryColor} />
          <stop offset="100%" stopColor={shade(team.primaryColor, -0.45)} />
        </linearGradient>
      </defs>
      {round ? (
        <>
          <circle cx="24" cy="24" r="21" fill={`url(#${uid})`} stroke={team.secondaryColor} strokeOpacity="0.9" strokeWidth="2.5" />
          <circle cx="24" cy="24" r="15.5" fill="none" stroke={team.secondaryColor} strokeOpacity="0.35" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <path d="M24 2.5 42 9v12.5C42 33 34.8 41.7 24 45.5 13.2 41.7 6 33 6 21.5V9l18-6.5Z" fill={`url(#${uid})`} stroke={team.secondaryColor} strokeOpacity="0.9" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 8 36 12.4v9.4c0 7.8-4.8 13.8-12 16.8-7.2-3-12-9-12-16.8v-9.4L24 8Z" fill="none" stroke={team.secondaryColor} strokeOpacity="0.28" strokeWidth="1.4" strokeLinejoin="round" />
        </>
      )}
      <text
        x="24"
        y={round ? 30 : 29}
        textAnchor="middle"
        fontFamily="'Outfit Variable', system-ui, sans-serif"
        fontWeight="800"
        fontSize={initials.length > 1 ? 15 : 18}
        letterSpacing="0.5"
        fill={bestText(team.primaryColor)}
      >
        {initials}
      </text>
    </svg>
  )
}

/** Pennant-style league badge generated from the league's colors. */
export function LeagueBadge({ name, size = 44, tint = '#c9f542' }: { name: string; size?: number; tint?: string }) {
  const uid = `lg-${name.replace(/\W/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tint} />
          <stop offset="100%" stopColor={shade(tint, -0.55)} />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="12" fill={`url(#${uid})`} />
      <path d="M16 14h16v14l-8 6-8-6V14Z" fill="none" stroke={bestText(tint)} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M20 20.5l3 3 5.5-5.5" fill="none" stroke={bestText(tint)} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Brand mark: forge-struck pennant. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="brandmk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d8fb54" />
          <stop offset="100%" stopColor="#8fc025" />
        </linearGradient>
      </defs>
      <path d="M6 3h20a1.5 1.5 0 0 1 1.5 1.5V19L16 29.5 4.5 19V4.5A1.5 1.5 0 0 1 6 3Z" fill="url(#brandmk)" />
      <path d="M17.8 8 12 17h3.4l-1.2 7L20 15h-3.4l1.2-7Z" fill="#0c0e08" />
    </svg>
  )
}

export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Lighten (amt > 0) or darken (amt < 0) a hex color. */
export function shade(hex: string, amt: number): string {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return hex
  const ch = (v: number) => {
    const t = amt < 0 ? 0 : 255
    const p = Math.abs(amt)
    return Math.round((t - v) * p + v)
  }
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** Black or white text, whichever reads better on the given color. */
export function bestText(hex: string): string {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return '#fff'
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 145 ? '#101208' : '#ffffff'
}

/** Deterministic pleasant gradient pair for user avatars. */
export function avatarColors(username: string): [string, string] {
  const palette: [string, string][] = [
    ['#f97316', '#c2410c'],
    ['#38bdf8', '#0369a1'],
    ['#a78bfa', '#6d28d9'],
    ['#34d399', '#047857'],
    ['#fbbf24', '#b45309'],
    ['#fb7185', '#be123c'],
    ['#22d3ee', '#0e7490'],
    ['#c9f542', '#65a30d'],
  ]
  return palette[hashCode(username) % palette.length]
}
