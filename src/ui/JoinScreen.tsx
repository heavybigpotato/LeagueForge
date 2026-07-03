import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { isVerifiedUser } from '../core/types'
import { Avatar, VerificationChecks } from './components'
import { Icon } from './icons'

/** Handles both the Join tab and deep links (leagueforge.app/join/CODE → /#/join/CODE). */
export function JoinScreen() {
  const { code: codeParam } = useParams()
  const store = useStore()
  const navigate = useNavigate()
  const [code, setCode] = useState(codeParam ?? '')
  const verified = isVerifiedUser(store.currentUser)

  const join = () => {
    const team = store.joinByCode(code)
    if (team) navigate(`/team/${team.id}`)
  }

  return (
    <div>
      <div className="kicker">Got an invite?</div>
      <h1>Join a Team</h1>
      <p className="muted" style={{ marginTop: 0 }}>Enter the code your captain shared.</p>

      <div className="card">
        <div className="row">
          <Avatar user={store.currentUser} />
          <div className="grow">
            <strong>@{store.currentUser.username}</strong>
            <VerificationChecks user={store.currentUser} />
          </div>
        </div>
        {!verified && (
          <p className="faint" style={{ marginBottom: 0 }}>Finish verification before joining a roster.</p>
        )}
      </div>

      <label className="field" style={{ marginTop: 18 }}>
        <span>Invite code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC12345"
          maxLength={8}
          style={{ textTransform: 'uppercase', letterSpacing: '0.3em', textIndent: '0.3em', textAlign: 'center', fontSize: 22, fontWeight: 800, padding: '16px 12px' }}
        />
      </label>
      <button className="btn primary" disabled={code.length !== 8 || !verified} onClick={join}>
        <Icon name="ticket" size={16} /> Join Team
      </button>
      <p className="faint" style={{ marginTop: 16, textAlign: 'center' }}>The captain approves every request.</p>

      <PendingRequests />
    </div>
  )
}

/** Requests you've sent that are still waiting on a captain. */
function PendingRequests() {
  const { state, currentUser } = useStore()
  const pending = state.teams.filter((t) => t.pendingMemberIds.includes(currentUser.id))
  if (pending.length === 0) return null
  return (
    <>
      <h2>Your pending requests</h2>
      {pending.map((t) => {
        const league = state.leagues.find((l) => l.id === t.leagueId)
        return (
          <div className="card" key={t.id}>
            <div className="row">
              <span style={{ color: 'var(--blue)' }}><Icon name="clock" size={16} /></span>
              <div className="grow">
                <strong>{t.name}</strong>
                <div className="faint">{league?.name} · waiting for the captain to approve you</div>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
