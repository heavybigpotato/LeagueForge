import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { Crest, Icon } from './icons'
import type { Team } from '../core/types'

export function CreateTeamScreen() {
  const { leagueId } = useParams()
  const store = useStore()
  const navigate = useNavigate()
  const league = store.state.leagues.find((l) => l.id === leagueId)
  const [form, setForm] = useState({ name: '', logo: '', primaryColor: '#c9f542', secondaryColor: '#14171c', bio: '' })
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  if (!league) return <p className="muted">League not found.</p>

  const submit = () => {
    const team = store.createTeam(league.id, form)
    if (team) navigate(`/team/${team.id}`)
  }

  // Live crest preview built from the form values.
  const preview: Team = {
    id: 'preview',
    leagueId: league.id,
    name: form.name || 'Your Team',
    logo: '',
    primaryColor: form.primaryColor,
    secondaryColor: form.secondaryColor,
    bio: '',
    captainId: '',
    status: 'pending',
    memberIds: [],
    pendingMemberIds: [],
    inviteCode: '',
    rosterLocked: false,
    createdAt: 0,
  }

  return (
    <div>
      <Link to={`/league/${league.id}`} className="backlink"><Icon name="arrowLeft" size={15} /> {league.name}</Link>
      <div className="kicker" style={{ marginTop: 10 }}>New team</div>
      <h1>Create a Team</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        You&rsquo;re the captain. The team goes official at {league.minPlayersPerTeam} verified players.
      </p>

      <div className="card">
        <div className="row">
          <Crest team={preview} size={56} />
          <div className="grow">
            <strong style={{ fontSize: 16 }}>{form.name || 'Your Team'}</strong>
            <div className="faint">Crest generated from your name and colors</div>
          </div>
        </div>
      </div>

      <label className="field">
        <span>Team name</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Thunder FC" />
      </label>
      <div className="fieldgrid">
        <label className="field">
          <span>Primary color</span>
          <input type="color" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
        </label>
        <label className="field">
          <span>Secondary color</span>
          <input type="color" value={form.secondaryColor} onChange={(e) => set('secondaryColor', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Bio</span>
        <textarea rows={2} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Tell the league who you are…" />
      </label>
      <button className="btn primary" onClick={submit}>Create Pending Team</button>
    </div>
  )
}
