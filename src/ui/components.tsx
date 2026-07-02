import { useEffect, type ReactNode } from 'react'
import type { Team, User } from '../core/types'
import type { FormResult } from '../core/standings'
import { useStore } from '../store/store'
import { Crest, Icon, avatarColors } from './icons'

export function Badge({ kind, children }: { kind: 'pending' | 'official' | 'disputed' | 'awaiting' | 'neutral' | 'volt'; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function TeamLogo({ team, size }: { team: Team; size?: number }) {
  return <Crest team={team} size={size ?? 44} />
}

export function Avatar({ user, size }: { user: User; size?: 'sm' }) {
  const [from, to] = avatarColors(user.username)
  return (
    <span className={`avatar${size === 'sm' ? ' sm' : ''}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      {user.username.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function VerificationChecks({ user }: { user: User }) {
  return (
    <div className="checks">
      <Badge kind={user.emailVerified ? 'official' : 'neutral'}>{user.emailVerified ? '✓ email' : 'email'}</Badge>
      <Badge kind={user.phoneVerified ? 'official' : 'neutral'}>{user.phoneVerified ? '✓ phone' : 'phone'}</Badge>
      {user.idVerified && <Badge kind="awaiting">✓ ID</Badge>}
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

export function FormPills({ form }: { form: FormResult[] }) {
  if (form.length === 0) return <span className="faint">—</span>
  return (
    <span className="form">
      {form.map((r, i) => (
        <i key={i} className={r.toLowerCase()}>{r}</i>
      ))}
    </span>
  )
}

export function Toasts() {
  const { state } = useStore()
  if (state.notifications.length === 0) return null
  return (
    <div className="toasts">
      {state.notifications.slice(-3).map((n) => (
        <ToastItem key={n.id} id={n.id} kind={n.kind} text={n.text} />
      ))}
    </div>
  )
}

function ToastItem({ id, kind, text }: { id: number; kind: 'success' | 'info' | 'error'; text: string }) {
  const { dismiss } = useStore()

  // Each toast clears itself 4s after it appears; tapping dismisses immediately.
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className={`toast ${kind}`} onClick={() => dismiss(id)}>
      <span className="tico">
        <Icon name={kind === 'error' ? 'alert' : kind === 'info' ? 'clock' : 'check'} size={16} />
      </span>
      {text}
    </div>
  )
}

export function EmptyState({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="eico"><Icon name={icon} size={24} /></div>
      {children}
    </div>
  )
}

export function ActionCard({
  to,
  icon,
  tone,
  title,
  sub,
  onClick,
}: {
  to?: string
  icon: string
  tone: 'volt' | 'red' | 'blue' | 'gold'
  title: string
  sub: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className={`ico ${tone}`}><Icon name={icon} size={19} /></span>
      <span className="grow">
        <b>{title}</b>
        <span className="sub">{sub}</span>
      </span>
      <span className="chev"><Icon name="chevronRight" size={17} /></span>
    </>
  )
  if (to) {
    return <a className="action" href={`#${to}`}>{inner}</a>
  }
  return (
    <button className="action" style={{ width: '100%', textAlign: 'left', font: 'inherit' }} onClick={onClick}>
      {inner}
    </button>
  )
}

export function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
