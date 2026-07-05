import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { PLATFORM_MIN_PLAYERS, type LeaguePrivacy, type ScheduleFormat, type Sport } from '../core/types'
import { now } from '../adapters/clock'
import { Icon } from './icons'

const SPORTS: Sport[] = ['football', 'basketball', 'volleyball', 'cricket', 'baseball', 'hockey', 'rugby', 'tennis', 'pickleball', 'esports', 'chess', 'custom']

/** An ISO date `days` from today — so form defaults are never a hard-coded year. */
function isoDate(days: number): string {
  return new Date(now() + days * 86400000).toISOString().slice(0, 10)
}

/** Create a league or a knockout cup. Everything's on one screen — no hidden menus. */
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
    homeVenue: '',
    // Defaults track the calendar, never a baked-in year.
    seasonStart: isoDate(0),
    seasonEnd: isoDate(120),
    minTeams: 4,
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
  const isCup = form.scheduleFormat === 'knockout'

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
      <div className="kicker" style={{ marginTop: 10 }}>New competition</div>
      <h1>Create a Competition</h1>
      <p className="muted" style={{ marginTop: 0 }}>You run it. Teams register, you kick off when everyone&rsquo;s ready.</p>

      <label className="field">
        <span>Name</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Downtown Football League" />
      </label>

      <label className="field">
        <span>Format</span>
        <div className="segmented">
          <button className={!isCup ? 'on' : ''} onClick={() => set('scheduleFormat', 'round-robin')} type="button">
            <Icon name="activity" size={15} /> League
          </button>
          <button className={isCup ? 'on' : ''} onClick={() => set('scheduleFormat', 'knockout')} type="button">
            <Icon name="trophy" size={15} /> Knockout cup
          </button>
        </div>
      </label>
      <p className="faint" style={{ marginTop: -4, display: 'flex', gap: 8 }}>
        <Icon name={isCup ? 'trophy' : 'activity'} size={14} />
        <span>{isCup ? 'Single-elimination bracket — win or go home. Needs 2, 4, 8, or 16 teams.' : 'Everyone plays everyone once; the table decides the champion.'}</span>
      </p>

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
          <span>Who can find it</span>
          <select value={form.privacy} onChange={(e) => set('privacy', e.target.value as LeaguePrivacy)}>
            <option value="public">Public — in Discover</option>
            <option value="private">Private — code only</option>
            <option value="invite-only">Invite only</option>
          </select>
        </label>
        <label className="field">
          <span>City</span>
          <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Austin" />
        </label>
        <label className="field">
          <span>Country</span>
          <input value={form.country} onChange={(e) => set('country', e.target.value)} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Home venue</span>
          <input value={form.homeVenue} onChange={(e) => set('homeVenue', e.target.value)} placeholder="Riverside Park, Pitch 2" />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Description</span>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What's this competition about?" />
        </label>
      </div>

      <h2>Teams</h2>
      <p className="faint" style={{ marginTop: -6 }}>
        You can launch once at least the minimum number of teams have registered <strong>and</strong> reached {form.minPlayersPerTeam} players.
      </p>
      <div className="fieldgrid">
        <label className="field">
          <span>Min teams to start</span>
          <input type="number" min={2} value={form.minTeams} onChange={(e) => set('minTeams', Number(e.target.value))} />
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
      </div>

      {!isCup && (
        <>
          <h2>Scoring</h2>
          <div className="fieldgrid">
            <label className="field">
              <span>Points for a win</span>
              <input type="number" min={1} value={form.pointsForWin} onChange={(e) => set('pointsForWin', Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Points for a draw</span>
              <input type="number" min={0} value={form.pointsForDraw} onChange={(e) => set('pointsForDraw', Number(e.target.value))} />
            </label>
          </div>
        </>
      )}

      <p className="faint" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Icon name="shield" size={14} />
        <span>Teams register with a roster and go official at {form.minPlayersPerTeam} players.</span>
      </p>
      <button className="btn primary" onClick={submit}>Create {isCup ? 'Cup' : 'League'}</button>
    </div>
  )
}
