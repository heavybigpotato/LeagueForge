import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { ROUTES } from '../core/config'
import { Avatar, Badge, VerificationChecks } from './components'
import { Icon, LeagueBadge, Crest } from './icons'

export function ProfileScreen() {
  const { state, currentUser, signIn, signOut } = useStore()
  const [switchFor, setSwitchFor] = useState<string | null>(null)
  const [switchPassword, setSwitchPassword] = useState('')

  const myTeams = state.teams.filter((t) => t.memberIds.includes(currentUser.id))
  const myLeagues = state.leagues.filter((l) => l.commissionerId === currentUser.id)

  // Switchable identities: accounts created on this device, plus captains and
  // commissioners of leagues the current user is part of.
  const relevantLeagueIds = new Set([
    ...myLeagues.map((l) => l.id),
    ...myTeams.map((t) => t.leagueId),
  ])
  const captains = state.teams.filter((t) => relevantLeagueIds.has(t.leagueId)).map((t) => t.captainId)
  const switchable = state.users.filter(
    (u) =>
      u.id === currentUser.id ||
      state.primaryAccountIds.includes(u.id) ||
      captains.includes(u.id) ||
      state.leagues.some((l) => relevantLeagueIds.has(l.id) && l.commissionerId === u.id),
  )
  const roleOf = (id: string) => {
    if (state.leagues.some((l) => l.commissionerId === id)) return 'Commissioner'
    const t = state.teams.find((x) => x.captainId === id)
    if (t) return `Captain · ${t.name}`
    return state.primaryAccountIds.includes(id) ? 'Account on this device' : 'Player'
  }

  return (
    <div>
      <div className="kicker">Career profile</div>
      <h1>@{currentUser.username}</h1>

      <div className="hero" style={{ marginTop: 8 }}>
        <div className="glow" style={{ background: 'radial-gradient(380px 190px at 90% -25%, rgba(201,245,66,0.12), transparent 65%)' }} />
        <div className="hero-head">
          <Avatar user={currentUser} />
          <div className="grow">
            <strong>{currentUser.email}</strong>
            <div className="faint">{currentUser.phone}</div>
            <VerificationChecks user={currentUser} />
          </div>
        </div>
        <div className="statchips">
          <div className="statchip"><div className="v">{currentUser.reputation}</div><div className="k">Reputation</div></div>
          <div className="statchip"><div className="v">{myTeams.length}</div><div className="k">Teams</div></div>
          <div className="statchip"><div className="v">{myLeagues.length}</div><div className="k">Leagues run</div></div>
        </div>
      </div>

      <h2>Career</h2>
      <div className="card">
        {myTeams.length === 0 && myLeagues.length === 0 && (
          <p className="faint" style={{ margin: 0 }}>No teams or leagues yet — create a league or join a team from the Home tab.</p>
        )}
        {myLeagues.map((l) => (
          <div className="listlink" key={l.id}>
            <LeagueBadge name={l.name} size={32} />
            <span className="grow truncate" style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</span>
            <Badge kind="volt">Commissioner</Badge>
          </div>
        ))}
        {myTeams.map((t) => (
          <div className="listlink" key={t.id}>
            <Crest team={t} size={32} />
            <span className="grow truncate" style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
            {t.captainId === currentUser.id ? <Badge kind="volt">Captain</Badge> : <Badge kind="neutral">Player</Badge>}
          </div>
        ))}
      </div>

      {switchable.length > 1 && (
        <>
          <h2>Switch identity</h2>

          <div className="card">
            {switchable.map((u) => (
              <div key={u.id}>
                <div className="person">
                  <Avatar user={u} />
                  <div className="grow">
                    <strong>@{u.username}</strong>
                    <div className="faint">{roleOf(u.id)}</div>
                  </div>
                  {u.id === currentUser.id ? (
                    <Badge kind="official">You</Badge>
                  ) : (
                    <button
                      className="btn small"
                      onClick={() => {
                        setSwitchFor(switchFor === u.id ? null : u.id)
                        setSwitchPassword('')
                      }}
                    >
                      {switchFor === u.id ? 'Cancel' : 'Switch'}
                    </button>
                  )}
                </div>
                {switchFor === u.id && (
                  <div className="row" style={{ padding: '0 0 12px', gap: 8 }}>
                    <input
                      type="password"
                      placeholder={`Password for @${u.username}`}
                      autoComplete="current-password"
                      value={switchPassword}
                      onChange={(e) => setSwitchPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && signIn(u.id, switchPassword)}
                      autoFocus
                    />
                    <button className="btn primary small" onClick={() => signIn(u.id, switchPassword)}>
                      Sign in
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Account</h2>
      <div className="card" style={{ padding: '6px 14px' }}>
        <Link to={ROUTES.dataCenter} className="listlink hoverable" style={{ padding: '13px 0' }}>
          <span className="rowicon"><Icon name="scroll" size={16} /></span>
          <span className="grow">
            <strong style={{ fontSize: 14.5 }}>Data Center</strong>
            <div className="faint">Back up, import &amp; reset</div>
          </span>
          <Icon name="chevronRight" size={16} />
        </Link>
        <button className="listlink hoverable" onClick={signOut} style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border-soft)', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: '13px 0', textAlign: 'left' }}>
          <span className="rowicon"><Icon name="plus" size={16} /></span>
          <span className="grow">
            <strong style={{ fontSize: 14.5 }}>Add another account</strong>
            <div className="faint">Sign in a second identity on this device</div>
          </span>
          <Icon name="chevronRight" size={16} />
        </button>
        <button className="listlink hoverable" onClick={signOut} style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border-soft)', color: 'var(--red)', font: 'inherit', cursor: 'pointer', padding: '13px 0', textAlign: 'left' }}>
          <span className="rowicon" style={{ color: 'var(--red)' }}><Icon name="x" size={16} /></span>
          <span className="grow"><strong style={{ fontSize: 14.5 }}>Sign out</strong></span>
        </button>
      </div>

      <p className="faint" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Icon name="shield" size={14} />
        <span>Everything stays on this device — no server, no tracking. Your data leaves only when you export it.</span>
      </p>
    </div>
  )
}
