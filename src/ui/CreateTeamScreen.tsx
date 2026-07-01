import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'

export function CreateTeamScreen() {
  const { leagueId } = useParams()
  const store = useStore()
  const navigate = useNavigate()
  const league = store.state.leagues.find((l) => l.id === leagueId)
  const [form, setForm] = useState({ name: '', logo: '🛡️', primaryColor: '#f5c518', secondaryColor: '#111827', bio: '' })
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  if (!league) return <p className="muted">League not found.</p>

  const submit = () => {
    const team = store.createTeam(league.id, form)
    if (team) navigate(`/team/${team.id}`)
  }

  return (
    <div>
      <Link to={`/league/${league.id}`} className="backlink">← {league.name}</Link>
      <h1>Create a Team</h1>
      <p className="muted">
        You will be the captain. The team starts as <strong>Pending</strong> — it joins the league only after{' '}
        {league.minPlayersPerTeam} verified players are on the roster.
      </p>
      <label className="field">
        <span>Team name</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Thunder FC" />
      </label>
      <div className="fieldgrid">
        <label className="field">
          <span>Logo (emoji)</span>
          <input value={form.logo} onChange={(e) => set('logo', e.target.value)} />
        </label>
        <label className="field">
          <span>Primary color</span>
          <input type="color" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Secondary color</span>
        <input type="color" value={form.secondaryColor} onChange={(e) => set('secondaryColor', e.target.value)} />
      </label>
      <label className="field">
        <span>Bio</span>
        <textarea rows={2} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Tell the league who you are…" />
      </label>
      <button className="btn primary" onClick={submit}>Create Pending Team</button>
    </div>
  )
}
