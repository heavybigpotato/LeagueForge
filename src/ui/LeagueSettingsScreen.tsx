import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import type { LeaguePrivacy } from '../core/types'
import { Avatar, Badge, EmptyState } from './components'
import { Icon } from './icons'

/** Commissioner control room: rules, referees, and the season lifecycle. */
export function LeagueSettingsScreen() {
  const { leagueId } = useParams()
  const store = useStore()
  const navigate = useNavigate()
  const { state, currentUser } = store
  const league = state.leagues.find((l) => l.id === leagueId)

  const [form, setForm] = useState(() => ({
    description: league?.description ?? '',
    homeVenue: league?.homeVenue ?? '',
    privacy: (league?.privacy ?? 'public') as LeaguePrivacy,
    allowTransfers: league?.allowTransfers ?? false,
    pointsForWin: league?.scoring.pointsForWin ?? 3,
    pointsForDraw: league?.scoring.pointsForDraw ?? 1,
    minPlayersPerTeam: league?.minPlayersPerTeam ?? 11,
    maxPlayersPerTeam: league?.maxPlayersPerTeam ?? 22,
  }))

  if (!league) return <EmptyState icon="alert">League not found.</EmptyState>
  if (currentUser.id !== league.commissionerId) {
    return <EmptyState icon="lock">Only the commissioner can open league settings.</EmptyState>
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    const ok = store.updateLeague(league.id, {
      description: form.description,
      homeVenue: form.homeVenue,
      privacy: form.privacy,
      allowTransfers: form.allowTransfers,
      scoring: { pointsForWin: form.pointsForWin, pointsForDraw: form.pointsForDraw, pointsForLoss: league.scoring.pointsForLoss },
      minPlayersPerTeam: form.minPlayersPerTeam,
      maxPlayersPerTeam: form.maxPlayersPerTeam,
    })
    if (ok) navigate(`/league/${league.id}`)
  }

  // Referee candidates: verified accounts on this device or in this league.
  const memberIds = new Set(state.teams.filter((t) => t.leagueId === league.id).flatMap((t) => t.memberIds))
  const candidates = state.users.filter(
    (u) =>
      u.id !== league.commissionerId &&
      u.emailVerified &&
      u.phoneVerified &&
      (state.primaryAccountIds.includes(u.id) || memberIds.has(u.id) || league.refereeIds.includes(u.id)),
  )

  return (
    <div>
      <Link to={`/league/${league.id}`} className="backlink"><Icon name="arrowLeft" size={15} /> {league.name}</Link>
      <div className="kicker" style={{ marginTop: 10 }}>Commissioner tools</div>
      <h1>League Settings</h1>

      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <div className="fieldgrid">
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Home venue</span>
          <input value={form.homeVenue} onChange={(e) => set('homeVenue', e.target.value)} />
        </label>
        <label className="field">
          <span>Privacy</span>
          <select value={form.privacy} onChange={(e) => set('privacy', e.target.value as LeaguePrivacy)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="invite-only">Invite only</option>
          </select>
        </label>
        <label className="field">
          <span>Transfers</span>
          <select value={form.allowTransfers ? 'yes' : 'no'} onChange={(e) => set('allowTransfers', e.target.value === 'yes')}>
            <option value="no">Rosters lock on activation</option>
            <option value="yes">Transfers allowed</option>
          </select>
        </label>
        <label className="field">
          <span>Points: win</span>
          <input type="number" min={1} value={form.pointsForWin} onChange={(e) => set('pointsForWin', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Points: draw</span>
          <input type="number" min={0} value={form.pointsForDraw} onChange={(e) => set('pointsForDraw', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Min players / team</span>
          <input type="number" value={form.minPlayersPerTeam} onChange={(e) => set('minPlayersPerTeam', Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Max players / team</span>
          <input type="number" value={form.maxPlayersPerTeam} onChange={(e) => set('maxPlayersPerTeam', Number(e.target.value))} />
        </label>
      </div>
      <button className="btn primary" onClick={save}>Save settings</button>

      <h2>Referees</h2>
      <p className="faint" style={{ marginTop: -2 }}>
        Referees can enter official scores and resolve disputes — a neutral third whistle for your league.
      </p>
      <div className="card">
        {candidates.length === 0 && <p className="faint" style={{ margin: 0 }}>No eligible verified accounts yet.</p>}
        {candidates.map((u) => {
          const isRef = league.refereeIds.includes(u.id)
          return (
            <div className="person" key={u.id}>
              <Avatar user={u} />
              <div className="grow">
                <strong>@{u.username}</strong>
                {isRef && <Badge kind="awaiting">Referee</Badge>}
              </div>
              <button className={`btn small${isRef ? ' danger' : ''}`} onClick={() => store.setReferee(league.id, u.id, !isRef)}>
                {isRef ? 'Remove' : 'Assign'}
              </button>
            </div>
          )
        })}
      </div>

      <h2>Season</h2>
      <div className="card">
        <div className="row">
          <span style={{ color: 'var(--volt)' }}><Icon name="calendar" size={17} /></span>
          <div className="grow">
            <strong>Season {league.currentSeason} in progress</strong>
            <div className="faint">
              {league.seasons.length === 0
                ? 'No archived seasons yet.'
                : `${league.seasons.length} archived season${league.seasons.length === 1 ? '' : 's'} in league history.`}
            </div>
          </div>
        </div>
        <p className="faint">
          Ending the season freezes the final table and champions into league history, starts season{' '}
          {league.currentSeason + 1}, and unlocks all rosters so squads can be reshaped.
        </p>
        <button
          className="btn danger"
          onClick={() => {
            if (window.confirm(`End Season ${league.currentSeason} and archive it to history?`)) {
              store.endSeason(league.id)
              navigate(`/league/${league.id}`)
            }
          }}
        >
          <Icon name="scroll" size={15} /> End Season {league.currentSeason} &amp; archive
        </button>
      </div>
    </div>
  )
}
