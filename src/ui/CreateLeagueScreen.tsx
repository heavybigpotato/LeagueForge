import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { PLATFORM_MIN_PLAYERS, type LeaguePrivacy, type ScheduleFormat, type Sport } from '../core/types'
import { Icon } from './icons'

const SPORTS: Sport[] = ['football', 'basketball', 'volleyball', 'cricket', 'baseball', 'hockey', 'rugby', 'tennis', 'pickleball', 'esports', 'chess', 'custom']

/**
 * Create a league. Only the essentials are on screen; the rest have sensible
 * defaults tucked behind "More options" so making a league takes seconds.
 */
export function CreateLeagueScreen() {
  const store = useStore()
  const navigate = useNavigate()
  const [advanced, setAdvanced] = useState(false)
  const [form, setForm] = useState({
    name: '',
    sport: 'football' as Sport,
    logo: '🏆',
    description: '',
    country: '',
    city: '',
    homeVenue: '',
    seasonStart: '2026-08-01',
    seasonEnd: '2026-12-15',
    minTeams: 2,
    maxTeams: 12,
    minPlayersPerTeam: PLATFORM_MIN_PLAYERS,
    maxPlayersPerTeam: 22,
    scheduleFormat: 'round-robin' as ScheduleFormat,
    privacy: 'public' as LeaguePrivacy,
    allowTransfers: false,
    pointsForWin: 3,
    pointsForDraw: 1,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    const league = store.createLeague({
      ...form,
      banner: 'linear-gradient(135deg,#134e5e,#71b280)',
      scoring: { pointsForWin: form.pointsForWin, pointsForDraw: form.pointsForDraw, pointsForLoss: 0 },
      tieBreakers: ['goal-difference', 'goals-for', 'head-to-head'],
    })
    if (league) navigate(`/league/${league.id}`)
  }

  return (
    <div>
      <Link to="/" className="backlink"><Icon name="arrowLeft" size={15} /> Back</Link>
      <div className="kicker" style={{ marginTop: 10 }}>New league</div>
      <h1>Create a League</h1>
      <p className="muted" style={{ marginTop: 0 }}>You run it. Teams register, you kick off the season.</p>

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
          <span>City</span>
          <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Austin" />
        </label>
        <label className="field">
          <span>Format</span>
          <select value={form.scheduleFormat} onChange={(e) => set('scheduleFormat', e.target.value as ScheduleFormat)}>
            <option value="round-robin">Single round robin</option>
            <option value="double-round-robin">Double round robin</option>
          </select>
        </label>
        <label className="field">
          <span>Who can find it</span>
          <select value={form.privacy} onChange={(e) => set('privacy', e.target.value as LeaguePrivacy)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="invite-only">Invite only</option>
          </select>
        </label>
      </div>

      <button
        className="row"
        style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: '14px 2px 4px', gap: 8 }}
        onClick={() => setAdvanced((a) => !a)}
        aria-expanded={advanced}
      >
        <span style={{ color: 'var(--muted)' }}><Icon name="gauge" size={16} /></span>
        <strong className="grow" style={{ textAlign: 'left', fontSize: 14.5 }}>More options</strong>
        <span style={{ color: 'var(--faint)', transform: advanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          <Icon name="chevronRight" size={16} />
        </span>
      </button>

      {advanced && (
        <>
          <label className="field">
            <span>Description</span>
            <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What's this league about?" />
          </label>
          <div className="fieldgrid">
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Home venue</span>
              <input value={form.homeVenue} onChange={(e) => set('homeVenue', e.target.value)} placeholder="Riverside Park, Pitch 2" />
            </label>
            <label className="field">
              <span>Country</span>
              <input value={form.country} onChange={(e) => set('country', e.target.value)} />
            </label>
            <label className="field">
              <span>Max teams</span>
              <input type="number" min={2} value={form.maxTeams} onChange={(e) => set('maxTeams', Number(e.target.value))} />
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
              <span>Points: win</span>
              <input type="number" min={1} value={form.pointsForWin} onChange={(e) => set('pointsForWin', Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Points: draw</span>
              <input type="number" min={0} value={form.pointsForDraw} onChange={(e) => set('pointsForDraw', Number(e.target.value))} />
            </label>
          </div>
        </>
      )}

      <p className="faint" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Icon name="shield" size={14} />
        <span>Teams register with {PLATFORM_MIN_PLAYERS}+ verified players. You launch the season when you&rsquo;re ready.</span>
      </p>
      <button className="btn primary" onClick={submit}>Create League</button>
    </div>
  )
}
