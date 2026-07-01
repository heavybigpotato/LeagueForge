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
      <p className="muted" style={{ marginTop: 0 }}>
        Enter the 8-character code your captain shared — or open their invite link / scan their QR code.
      </p>

      <div className="card">
        <div className="row">
          <Avatar user={store.currentUser} />
          <div className="grow">
            <strong>@{store.currentUser.username}</strong>
            <VerificationChecks user={store.currentUser} />
          </div>
        </div>
        {!verified && (
          <p className="faint" style={{ marginBottom: 0 }}>You must verify your email and phone before you can join a roster.</p>
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
      <p className="faint" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Icon name="shield" size={14} />
        <span>
          Joining sends a request to the team captain. You are added to the roster only after approval, and one account can
          only be on one team per league.
        </span>
      </p>
    </div>
  )
}
