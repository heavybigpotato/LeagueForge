import { useState } from 'react'
import { useStore } from '../store/store'
import { VERIFICATION } from '../core/config'
import { Avatar, Toasts } from './components'
import { BrandMark, Icon } from './icons'
import { ImportBackupButton } from './ImportBackup'

/**
 * Gate shown until an account on this device is signed in AND verified.
 * Sign up → verify email → verify phone. There is no mail/SMS gateway in
 * the local build, so the generated codes are displayed inline, clearly
 * labelled — the rules they enforce are the real ones.
 */
export function OnboardingScreen() {
  const store = useStore()
  const { state } = store
  const [mode, setMode] = useState<'welcome' | 'signup'>('welcome')
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '' })
  const [loginFor, setLoginFor] = useState<string | null>(null)
  const [loginPassword, setLoginPassword] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')

  const user = state.users.find((u) => u.id === state.currentUserId)
  const verification = user ? state.verifications[user.id] : undefined
  const primaryAccounts = state.users.filter((u) => state.primaryAccountIds.includes(u.id))

  // ---- step: verify email / phone (signed in, not yet verified)
  if (user && (!user.emailVerified || !user.phoneVerified)) {
    const stage = !user.emailVerified ? 'email' : 'phone'
    const code = stage === 'email' ? verification?.emailCode : verification?.phoneCode
    const target = stage === 'email' ? user.email : user.phone
    return (
      <Shell>
        <div className="kicker">Step {stage === 'email' ? '2' : '3'} of 3</div>
        <h1>Verify your {stage}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Enter the 6-digit code sent to <strong>{target}</strong>. Verified identity is what keeps every league on
          LeagueForge real.
        </p>
        {code && (
          <div className="democode" data-code={code}>
            <Icon name="send" size={14} /> Demo code (generated locally — no real {stage} is sent): <strong>{code}</strong>
          </div>
        )}
        <p className="faint" style={{ textAlign: 'center', marginTop: 8 }}>
          Codes expire after {Math.round(VERIFICATION.ttlMs / 60000)} minutes.{' '}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--blue)', font: 'inherit', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            onClick={() => store.resendCodes()}
          >
            Resend codes
          </button>
        </p>
        <label className="field" style={{ marginTop: 14 }}>
          <span>{stage === 'email' ? 'Email code' : 'Phone code'}</span>
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={stage === 'email' ? emailCode : phoneCode}
            onChange={(e) => (stage === 'email' ? setEmailCode(e.target.value) : setPhoneCode(e.target.value))}
            style={{ textAlign: 'center', letterSpacing: '0.35em', fontSize: 22, fontWeight: 800 }}
          />
        </label>
        <button
          className="btn primary"
          disabled={(stage === 'email' ? emailCode : phoneCode).trim().length !== 6}
          onClick={() => (stage === 'email' ? store.verifyEmail(emailCode) : store.verifyPhone(phoneCode))}
        >
          Verify {stage}
        </button>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => store.signOut()}>
          Cancel
        </button>
      </Shell>
    )
  }

  // ---- step: create account
  if (mode === 'signup') {
    const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
    return (
      <Shell>
        <div className="kicker">New account</div>
        <h1 style={{ marginTop: 4 }}>Create your account</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          One account per person. You&rsquo;ll verify your email and phone next — unverified accounts can&rsquo;t join rosters.
        </p>
        <p className="faint" style={{ marginTop: -6 }}>
          Local-only identity: this account lives on this device. Verification codes are generated locally — production
          email/SMS delivery requires a hosted provider.
        </p>
        <label className="field">
          <span>Username</span>
          <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="alexrivera" autoCapitalize="none" />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" autoCapitalize="none" />
        </label>
        <label className="field">
          <span>Phone</span>
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
        </label>
        <label className="field">
          <span>Password (8+ characters)</span>
          <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </label>
        <button
          className="btn primary"
          disabled={!form.username.trim() || !form.email.trim() || !form.phone.trim() || form.password.length < 8}
          onClick={() => store.signUp(form)}
        >
          Continue
        </button>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setMode('welcome')}>
          Back
        </button>
      </Shell>
    )
  }

  // ---- first run: landing with explicit paths (nothing is auto-created)
  if (primaryAccounts.length === 0) {
    return (
      <Shell>
        <Welcome />
        <button className="btn primary" onClick={() => setMode('signup')}>
          <Icon name="user" size={16} /> Create commissioner account
        </button>
        <p className="faint" style={{ textAlign: 'center', margin: '10px 0' }}>
          Got a team invite code? Create your account first — you&rsquo;ll enter the code right after.
        </p>
        <button className="btn ghost" onClick={() => store.startGuidedDemo()}>
          <Icon name="sparkle" size={16} /> Try guided demo
        </button>
        <div style={{ marginTop: 8 }}>
          <ImportBackupButton ghost />
        </div>
        <p className="faint" style={{ textAlign: 'center', marginTop: 16 }}>
          Local-first: everything stays on this device. Demo verification codes are generated locally — no real email or
          SMS is sent in this build.
        </p>
      </Shell>
    )
  }

  // ---- step: welcome back — pick an account or add one
  return (
    <Shell>
      <Welcome />
      <h2>Sign in</h2>
      <div className="card">
        {primaryAccounts.map((u) => (
          <div key={u.id}>
            <button
              className="person"
              style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              onClick={() => {
                setLoginFor(loginFor === u.id ? null : u.id)
                setLoginPassword('')
              }}
            >
              <Avatar user={u} />
              <span className="grow">
                <strong>@{u.username}</strong>
                <span className="faint" style={{ display: 'block' }}>{u.email}</span>
              </span>
              <Icon name={loginFor === u.id ? 'x' : 'chevronRight'} size={16} />
            </button>
            {loginFor === u.id && (
              <div className="row" style={{ padding: '2px 0 12px', gap: 8 }}>
                <input
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && store.signIn(u.id, loginPassword)}
                  autoFocus
                />
                <button className="btn primary small" onClick={() => store.signIn(u.id, loginPassword)}>
                  Sign in
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="btn primary" onClick={() => setMode('signup')}>
        <Icon name="plus" size={16} /> Create a new account
      </button>
      <div style={{ marginTop: 8 }}>
        <ImportBackupButton ghost />
      </div>
    </Shell>
  )
}

function Welcome() {
  return (
    <div style={{ textAlign: 'center', padding: '26px 0 6px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <BrandMark size={52} />
      </div>
      <div className="wordmark" style={{ fontSize: 26 }}>
        League<em>Forge</em>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Run real leagues. Verified rosters, verified results, earned championships.
      </p>
      <div className="row" style={{ justifyContent: 'center', gap: 14, margin: '14px 0 6px', color: 'var(--faint)', fontSize: 12, fontWeight: 700 }}>
        <span className="row" style={{ gap: 5 }}><Icon name="shieldCheck" size={14} /> Verified identity</span>
        <span className="row" style={{ gap: 5 }}><Icon name="whistle" size={14} /> Verified results</span>
        <span className="row" style={{ gap: 5 }}><Icon name="trophy" size={14} /> Real playoffs</span>
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="phone">
      <main className="content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </main>
      <Toasts />
    </div>
  )
}
