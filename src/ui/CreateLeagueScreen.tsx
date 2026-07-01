import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { PLATFORM_MIN_PLAYERS, type LeaguePrivacy, type PlayoffFormat, type ScheduleFormat, type Sport } from '../core/types'

const SPORTS: Sport[] = ['football', 'basketball', 'volleyball', 'cricket', 'baseball', 'hockey', 'rugby', 'tennis', 'pickleball', 'esports', 'chess', 'custom']

export function CreateLeagueScreen() {
  const store = useStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    sport: 'football' as Sport,
    logo: '🏆',
    description: '',
    country: '',
    city: '',
    seasonStart: '2026-08-01',
    seasonEnd: '2026-12-15',
    minTeams: 4,
    maxTeams: 12,
    minPlayersPerTeam: PLATFORM_MIN_PLAYERS,
    maxPlayersPerTeam: 22,
    scheduleFormat: 'round-robin' as ScheduleFormat,
    playoffFormat: 'single-elimination' as PlayoffFormat,
    privacy: 'public' as LeaguePrivacy,
    allowTransfers: false,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    const league = store.createLeague({
      ...form,
      banner: 'linear-gradient(135deg,#134e5e,#71b280)',
      scoring: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
      tieBreakers: ['goal-difference', 'goals-for', 'head-to-head'],
    })
    if (league) navigate(`/league/${league.id}`)
  }

  return (
    <div>
      <Link to="/" className="backlink">← Back</Link>
      <h1>Create a League</h1>
      <p className="muted">You will be the commissioner: you approve teams, review disputes, and manage the season.</p>

      <label className="field">
        <span>League name</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Downtown Football League" />
      </label>
      <div className="fieldgrid">
        <label className="field">
          <span>Sport</span>
          <select value={form.sport} onChange={(e) => set('sport', e.target.value as Sport)}>
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Logo (emoji)</span>
          <input value={form.logo} onChange={(e) => set('logo', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <div className="fieldgrid">
        <label className="field">
          <span>Country</span>
          <input value={form.country} onChange={(e) => set('country', e.target.value)} />
        </label>
        <label className="field">
          <span>City</span>
          <input value={form.city} onChange={(e) => set('city', e.target.value)} />
        </label>
        <label className="field">
          <span>Season start</span>
          <input type="date" value={form.seasonStart} onChange={(e) => set('seasonStart', e.target.value)} />
        </label>
        <label className="field">
          <span>Season end</span>
          <input type="date" value={form.seasonEnd} onChange={(e) => set('seasonEnd', e.target.value)} />
        </label>
        <label className="field">
          <span>Min teams</span>
          <input type="number" min={2} value={form.minTeams} onChange={(e) => set('minTeams', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Max teams</span>
          <input type="number" value={form.maxTeams} onChange={(e) => set('maxTeams', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Min players / team</span>
          <input type="number" min={PLATFORM_MIN_PLAYERS} value={form.minPlayersPerTeam} onChange={(e) => set('minPlayersPerTeam', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Max players / team</span>
          <input type="number" value={form.maxPlayersPerTeam} onChange={(e) => set('maxPlayersPerTeam', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Format</span>
          <select value={form.scheduleFormat} onChange={(e) => set('scheduleFormat', e.target.value as typeof form.scheduleFormat)}>
            <option value="round-robin">Round robin</option>
            <option value="double-round-robin">Double round robin</option>
          </select>
        </label>
        <label className="field">
          <span>Privacy</span>
          <select value={form.privacy} onChange={(e) => set('privacy', e.target.value as typeof form.privacy)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="invite-only">Invite only</option>
          </select>
        </label>
      </div>
      <p className="faint">
        Roster minimum can be raised for large-squad sports but never below the platform floor of {PLATFORM_MIN_PLAYERS} verified players.
      </p>
      <button className="btn primary" onClick={submit}>Create League</button>
    </div>
  )
}
