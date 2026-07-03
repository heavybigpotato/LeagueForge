import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { emailError, passwordError, passwordStrength, phoneError, usernameError } from '../core/account'
import type { User } from '../core/types'
import { now } from '../adapters/clock'
import { Avatar, Toasts } from './components'
import { BrandMark, Icon } from './icons'
import { ImportBackupButton } from './ImportBackup'

type View = 'landing' | 'signup' | 'signin'

export function OnboardingScreen() {
  const store = useStore()
  const { state } = store
  const [view, setView] = useState<View>('landing')

  const user = state.users.find((u) => u.id === state.currentUserId)
  const accounts = state.users.filter((u) => state.primaryAccountIds.includes(u.id))

  if (user && (!user.emailVerified || !user.phoneVerified)) {
    return <VerifyStep user={user} />
  }
  if (view === 'signup') return <SignUpFlow onBack={() => setView('landing')} />
  if (view === 'signin' && accounts.length > 0) return <SignInScreen accounts={accounts} onBack={() => setView('landing')} />
  return <Landing accounts={accounts} onCreate={() => setView('signup')} onSignIn={() => setView('signin')} />
}

// ---------------------------------------------------------------- landing

function Landing({ accounts, onCreate, onSignIn }: { accounts: User[]; onCreate: () => void; onSignIn: () => void }) {
  const store = useStore()
  // A team invite deep link (#/join/CODE) survives signup — the router picks it
  // up as soon as the account is verified. Acknowledge it up front.
  const invite = window.location.hash.match(/^#\/join\/([A-Za-z0-9]{8})/)?.[1]?.toUpperCase()
  return (
    <Shell>
      <div className="auth-hero">
        <BrandMark size={64} />
        <div className="wordmark" style={{ fontSize: 32, marginTop: 16 }}>
          League<em>Forge</em>
        </div>
        <p className="auth-tagline">Real leagues. Verified results. Earned titles.</p>
      </div>
      {invite && (
        <div className="auth-invite">
          <Icon name="ticket" size={16} />
          <span>
            You&rsquo;re invited — code <strong className="num">{invite}</strong>.{' '}
            {accounts.length > 0 ? 'Sign in to accept it.' : 'Create an account to accept it.'}
          </span>
        </div>
      )}
      <div className="auth-actions">
        {accounts.length > 0 ? (
          <>
            <button className="btn primary" onClick={onSignIn}>Sign in</button>
            <button className="btn" onClick={onCreate}>Create account</button>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={onCreate}>Create account</button>
            <button className="btn" onClick={() => store.startGuidedDemo()}>
              <Icon name="sparkle" size={16} /> Try the demo
            </button>
          </>
        )}
        <div className="auth-links">
          {accounts.length > 0 && (
            <button className="textlink" onClick={() => store.startGuidedDemo()}>Try the demo</button>
          )}
          <ImportBackupLink />
        </div>
      </div>
      <p className="auth-foot">Everything stays on this device.</p>
    </Shell>
  )
}

function ImportBackupLink() {
  // reuse the validated import flow, styled as a quiet link
  return (
    <span className="auth-import">
      <ImportBackupButton ghost />
    </span>
  )
}

// ---------------------------------------------------------------- sign up

interface Draft {
  username: string
  email: string
  phone: string
  password: string
}

const STEPS = ['username', 'email', 'phone', 'password'] as const
type StepKey = (typeof STEPS)[number]

const STEP_META: Record<StepKey, { title: string; caption: string; placeholder: string; type: string; autoComplete: string; inputMode?: 'email' | 'tel' | 'text' }> = {
  username: { title: 'Pick a username', caption: 'This is how teammates will see you.', placeholder: 'alexrivera', type: 'text', autoComplete: 'username' },
  email: { title: "What's your email?", caption: "You'll confirm it in a second.", placeholder: 'you@example.com', type: 'email', autoComplete: 'email', inputMode: 'email' },
  phone: { title: 'And your phone?', caption: 'One account per person — that’s the deal.', placeholder: '+1 555 000 0000', type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  password: { title: 'Set a password', caption: 'You’ll need it to sign in on this device.', placeholder: 'At least 8 characters', type: 'password', autoComplete: 'new-password' },
}

function SignUpFlow({ onBack }: { onBack: () => void }) {
  const store = useStore()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>({ username: '', email: '', phone: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const key = STEPS[step]
  const meta = STEP_META[key]
  const value = draft[key]

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  const validate = (): string | null => {
    switch (key) {
      case 'username':
        return usernameError(value, store.state.users)
      case 'email':
        return emailError(value, store.state.users)
      case 'phone':
        return phoneError(value)
      case 'password':
        return passwordError(value)
    }
  }

  const next = () => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      store.signUp(draft)
    }
  }

  const back = () => {
    setError(null)
    if (step === 0) onBack()
    else setStep(step - 1)
  }

  const strength = passwordStrength(draft.password)

  return (
    <Shell>
      <div className="auth-top">
        <button className="auth-back" onClick={back} aria-label="Back">
          <Icon name="arrowLeft" size={18} />
        </button>
        <div className="dots" role="progressbar" aria-valuenow={step + 1} aria-valuemax={STEPS.length}>
          {STEPS.map((s, i) => (
            <i key={s} className={i <= step ? 'on' : ''} />
          ))}
        </div>
      </div>

      <div className="auth-step">
        <h1>{meta.title}</h1>
        <p className="muted" style={{ marginTop: 2 }}>{meta.caption}</p>

        <div className={`auth-field${error ? ' invalid' : ''}`}>
          <input
            ref={inputRef}
            type={key === 'password' && showPassword ? 'text' : meta.type}
            inputMode={meta.inputMode}
            autoComplete={meta.autoComplete}
            autoCapitalize="none"
            placeholder={meta.placeholder}
            value={value}
            onChange={(e) => {
              setDraft((d) => ({ ...d, [key]: e.target.value }))
              if (error) setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && next()}
            aria-invalid={!!error}
            aria-describedby={error ? 'auth-error' : undefined}
          />
          {key === 'password' && (
            <button className="eye" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <Icon name="eye" size={18} />
            </button>
          )}
        </div>
        {error && (
          <p className="field-error" id="auth-error" role="alert">{error}</p>
        )}

        {key === 'password' && draft.password.length > 0 && (
          <div className="strength" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <i key={i} className={strength > i ? `s${strength}` : ''} />
            ))}
            <span className="faint">{strength <= 1 ? 'Okay' : strength === 2 ? 'Good' : 'Strong'}</span>
          </div>
        )}

        <button className="btn primary" style={{ marginTop: 18 }} disabled={value.trim().length === 0} onClick={next}>
          {step < STEPS.length - 1 ? 'Continue' : 'Create account'}
        </button>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------- verify

function VerifyStep({ user }: { user: User }) {
  const store = useStore()
  const verification = store.state.verifications[user.id]
  const stage: 'email' | 'phone' = !user.emailVerified ? 'email' : 'phone'
  const code = stage === 'email' ? verification?.emailCode : verification?.phoneCode
  const target = stage === 'email' ? user.email : user.phone

  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  void tick

  const remaining = verification ? Math.max(0, Math.floor((verification.expiresAt - now()) / 1000)) : 0
  const expired = verification ? remaining === 0 : false
  const mm = String(Math.floor(remaining / 60))
  const ss = String(remaining % 60).padStart(2, '0')

  const submit = (candidate: string): boolean =>
    stage === 'email' ? store.verifyEmail(candidate) : store.verifyPhone(candidate)

  return (
    <Shell>
      <div className="auth-top">
        <button className="auth-back" onClick={() => store.signOut()} aria-label="Cancel">
          <Icon name="arrowLeft" size={18} />
        </button>
        <div className="dots">
          <i className="on" /><i className={stage === 'phone' ? 'on' : ''} /><i />
        </div>
      </div>

      <div className="auth-step">
        <h1>Confirm your {stage}</h1>
        <p className="muted" style={{ marginTop: 2 }}>
          We sent a code to <strong>{target}</strong>.
        </p>

        <OtpEntry key={stage} submit={submit} />

        {code && !expired && (
          <button className="democode" data-code={code} onClick={() => submit(code)}>
            <Icon name="send" size={14} /> Demo code: <strong>{code}</strong> — tap to fill
          </button>
        )}

        <p className="auth-meta">
          {expired ? (
            <span className="field-error" style={{ margin: 0 }}>Code expired.</span>
          ) : (
            <span className="faint num">Expires in {mm}:{ss}</span>
          )}
          {' · '}
          <button className="textlink" onClick={() => store.resendCodes()}>Send a new code</button>
        </p>
        <p className="auth-foot" style={{ marginTop: 'auto' }}>
          Demo mode — codes are generated on this device. No email or SMS is sent.
        </p>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------- sign in

function SignInScreen({ accounts, onBack }: { accounts: User[]; onBack: () => void }) {
  const store = useStore()
  const [selected, setSelected] = useState<User | null>(accounts.length === 1 ? accounts[0] : null)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [failed, setFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selected) inputRef.current?.focus()
  }, [selected])

  const attempt = () => {
    if (!selected) return
    const ok = store.signIn(selected.id, password, { quiet: true })
    if (!ok) {
      setFailed(true)
      setPassword('')
    }
  }

  if (!selected) {
    return (
      <Shell>
        <div className="auth-top">
          <button className="auth-back" onClick={onBack} aria-label="Back">
            <Icon name="arrowLeft" size={18} />
          </button>
        </div>
        <div className="auth-step">
          <h1>Who&rsquo;s signing in?</h1>
          <div className="card" style={{ marginTop: 16 }}>
            {accounts.map((u) => (
              <button key={u.id} className="person auth-account" onClick={() => setSelected(u)}>
                <Avatar user={u} />
                <span className="grow" style={{ textAlign: 'left' }}>
                  <strong>@{u.username}</strong>
                  <span className="faint" style={{ display: 'block' }}>{u.email}</span>
                </span>
                <Icon name="chevronRight" size={16} />
              </button>
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="auth-top">
        <button className="auth-back" onClick={() => (accounts.length === 1 ? onBack() : setSelected(null))} aria-label="Back">
          <Icon name="arrowLeft" size={18} />
        </button>
      </div>
      <div className="auth-step">
        <div className="row" style={{ gap: 12, marginBottom: 6 }}>
          <Avatar user={selected} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Welcome back</h1>
            <span className="faint">@{selected.username}</span>
          </div>
        </div>
        <div className={`auth-field${failed ? ' invalid shake' : ''}`} style={{ marginTop: 14 }}>
          <input
            ref={inputRef}
            type={show ? 'text' : 'password'}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setFailed(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && attempt()}
            aria-invalid={failed}
          />
          <button className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            <Icon name="eye" size={18} />
          </button>
        </div>
        {failed && <p className="field-error" role="alert">Wrong password for @{selected.username}.</p>}
        <button className="btn primary" style={{ marginTop: 18 }} disabled={password.length === 0} onClick={attempt}>
          Sign in
        </button>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------- shell

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="phone">
      <main className="content auth" style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <Toasts />
    </div>
  )
}

/** Six-box code entry: auto-advance, paste support, shake + clear on a miss. */
function OtpEntry({ submit }: { submit: (code: string) => boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [failed, setFailed] = useState(false)
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  const setDigit = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '')
    if (!clean) return
    const next = [...digits]
    const chars = clean.slice(0, 6 - index).split('')
    chars.forEach((c, offset) => (next[index + offset] = c))
    setFailed(false)
    const filled = next.join('')
    if (filled.length === 6) {
      if (submit(filled)) return
      setFailed(true)
      setDigits(Array(6).fill(''))
      setTimeout(() => boxes.current[0]?.focus(), 50)
      return
    }
    setDigits(next)
    boxes.current[Math.min(index + chars.length, 5)]?.focus()
  }

  const onKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[index]) next[index] = ''
      else if (index > 0) {
        next[index - 1] = ''
        boxes.current[index - 1]?.focus()
      }
      setDigits(next)
    }
  }

  return (
    <>
      <div className={`otp-row${failed ? ' shake' : ''}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el
            }}
            className="otp-box"
            inputMode="numeric"
            maxLength={6}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            aria-label={`Digit ${i + 1}`}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {failed && <p className="field-error" role="alert">That code didn&rsquo;t match. Try again.</p>}
    </>
  )
}
