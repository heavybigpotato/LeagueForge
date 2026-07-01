import type { ReactNode } from 'react'
import type { Team, User } from '../core/types'
import { useStore } from '../store/store'

export function Badge({ kind, children }: { kind: 'pending' | 'official' | 'disputed' | 'awaiting' | 'neutral'; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function TeamLogo({ team, size }: { team: Team; size?: number }) {
  const s = size ?? 44
  return (
    <div
      className="logo-circle"
      style={{ width: s, height: s, fontSize: s * 0.5, background: `linear-gradient(135deg, ${team.primaryColor}33, transparent)`, borderColor: `${team.primaryColor}66` }}
    >
      {team.logo || '🛡️'}
    </div>
  )
}

export function Avatar({ user }: { user: User }) {
  return <span className="avatar">{user.username.slice(0, 2).toUpperCase()}</span>
}

export function VerificationChecks({ user }: { user: User }) {
  return (
    <div className="checks">
      <Badge kind={user.emailVerified ? 'official' : 'neutral'}>{user.emailVerified ? '✓ email' : 'email'}</Badge>
      <Badge kind={user.phoneVerified ? 'official' : 'neutral'}>{user.phoneVerified ? '✓ phone' : 'phone'}</Badge>
      {user.idVerified && <Badge kind="awaiting">✓ ID verified</Badge>}
    </div>
  )
}

export function RosterProgress({ current, required }: { current: number; required: number }) {
  const pct = Math.min(100, Math.round((current / required) * 100))
  const done = current >= required
  return (
    <div>
      <div className="progress">
        <div className={`fill${done ? ' done' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="faint">
        {done ? 'Roster requirement met' : `${current} of ${required} verified players — ${required - current} more to activate`}
      </div>
    </div>
  )
}

export function Toasts() {
  const { state, dismiss } = useStore()
  if (state.notifications.length === 0) return null
  return (
    <div className="toasts">
      {state.notifications.slice(-3).map((n) => (
        <div key={n.id} className={`toast ${n.kind}`} onClick={() => dismiss(n.id)}>
          {n.text}
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      {children}
    </div>
  )
}

export function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
