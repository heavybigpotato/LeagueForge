import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { isVerifiedUser } from '../core/types'
import { VerificationChecks } from './components'

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
      <h1>Join a Team</h1>
      <p className="muted">
        Enter the 8-character invite code your captain shared — or open their invite link / scan their QR code.
      </p>
      <div className="card">
        <div className="row">
          <span className="avatar">{store.currentUser.username.slice(0, 2).toUpperCase()}</span>
          <div className="grow">
            <strong>@{store.currentUser.username}</strong>
            <VerificationChecks user={store.currentUser} />
          </div>
        </div>
        {!verified && (
          <p className="faint">You must verify your email and phone before you can join a roster.</p>
        )}
      </div>
      <label className="field">
        <span>Invite code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC12345"
          maxLength={8}
          style={{ textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center', fontSize: 20, fontWeight: 700 }}
        />
      </label>
      <button className="btn primary" disabled={code.length !== 8 || !verified} onClick={join}>
        Join Team
      </button>
      <p className="faint" style={{ marginTop: 14 }}>
        Joining sends a request to the team captain. You are added to the roster only after approval, and one account can
        only be on one team per league.
      </p>
    </div>
  )
}
