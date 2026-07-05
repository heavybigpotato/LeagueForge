import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { emailError, passwordError, passwordStrength, phoneError, usernameError } from '../core/account'
import type { User } from '../core/types'
import { Avatar, Toasts } from './components'
import { BrandMark, Icon } from './icons'

type View = 'landing' | 'signup' | 'signin'

export function OnboardingScreen() {
  const store = useStore()
  const { state } = store
  const [view, setView] = useState<View>('landing')

  const accounts = state.users.filter((u) => state.primaryAccountIds.includes(u.id))

  if (view === 'signup') return <SignUpFlow onBack={() => setView('landing')} />
  if (view === 'signin' && accounts.length > 0) return <SignInScreen accounts={accounts} onBack={() => setView('landing')} />
  return <Landing accounts={accounts} onCreate={() => setView('signup')} onSignIn={() => setView('signin')} />
}

// ---------------------------------------------------------------- landing

function Landing({ accounts, onCreate, onSignIn }: { accounts: User[]; onCreate: () => void; onSignIn: () => void }) {
  // A team invite deep link (#/join/CODE) survives signup — the router picks
  // it up as soon as the account exists. Acknowledge it up front.
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
        <button className="btn primary" onClick={onCreate}>Create account</button>
        {accounts.length > 0 && (
          <button className="btn" onClick={onSignIn}>Sign in</button>
        )}
      </div>
      <p className="auth-foot">
        Everything stays on this device. By continuing you agree to the{' '}
        <a className="textlink" href="#/terms">Terms</a> and <a className="textlink" href="#/privacy">Privacy Policy</a>.
      </p>
    </Shell>
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
  email: { title: "What's your email?", caption: 'Your sign-in identity on this device.', placeholder: 'you@example.com', type: 'email', autoComplete: 'email', inputMode: 'email' },
  phone: { title: 'Add a phone? (optional)', caption: 'Teammates see it for match-day coordination. Skip if you prefer.', placeholder: '+1 555 000 0000', type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
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

        <button
          className="btn primary"
          style={{ marginTop: 18 }}
          disabled={key !== 'phone' && value.trim().length === 0}
          onClick={next}
        >
          {step < STEPS.length - 1 ? (key === 'phone' && value.trim() === '' ? 'Skip for now' : 'Continue') : 'Create account'}
        </button>
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
