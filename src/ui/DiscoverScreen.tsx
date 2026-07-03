import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import type { League } from '../core/types'
import { Badge, EmptyState } from './components'
import { Icon, LeagueBadge } from './icons'

/**
 * Around me: browse the leagues taking entries and walk in with your team.
 * Local-first honesty — this searches the leagues on this device, by city,
 * sport, or name. No GPS, no server.
 */
export function DiscoverScreen() {
  const { state, currentUser, enterLeague } = useStore()
  const [query, setQuery] = useState('')

  const myFreeTeams = state.teams.filter(
    (t) => t.captainId === currentUser.id && t.status === 'official' && t.leagueId === null,
  )

  const q = query.trim().toLowerCase()
  const matches = (l: League) =>
    !q ||
    l.name.toLowerCase().includes(q) ||
    l.city.toLowerCase().includes(q) ||
    l.country.toLowerCase().includes(q) ||
    l.sport.toLowerCase().includes(q)

  const visible = state.leagues
    .filter((l) => l.privacy === 'public' && matches(l))
    .map((l) => {
      const teamCount = state.teams.filter((t) => t.leagueId === l.id).length
      return { league: l, teamCount, spots: Math.max(0, l.maxTeams - teamCount) }
    })
    .sort((a, b) => b.spots - a.spots || b.league.createdAt - a.league.createdAt)

  return (
    <div>
      <div className="kicker">Around you</div>
      <h1>Discover Leagues</h1>
      <p className="muted" style={{ marginTop: 0 }}>Find a league taking entries — and walk in with your whole team.</p>

      <label className="field">
        <span>Search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City, sport, or league name"
          autoCapitalize="none"
        />
      </label>

      {myFreeTeams.length === 0 && (
        <p className="faint" style={{ display: 'flex', gap: 8 }}>
          <Icon name="shield" size={14} />
          <span>
            Captains enter with a full team.{' '}
            <Link to="/create-team" style={{ color: 'var(--volt)' }}>Create yours</Link> and recruit to 11.
          </span>
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState icon="compass">
          {q ? `Nothing matches “${query.trim()}”.` : 'No public leagues around yet. Start the first one.'}
        </EmptyState>
      ) : (
        visible.map(({ league, teamCount, spots }) => (
          <div className="card" key={league.id}>
            <Link to={`/league/${league.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <LeagueBadge name={league.name} size={46} />
              <div className="grow">
                <div className="row" style={{ gap: 8 }}>
                  <strong className="truncate">{league.name}</strong>
                  <Badge kind={spots > 0 ? 'official' : 'neutral'}>{spots > 0 ? `${spots} spot${spots === 1 ? '' : 's'} open` : 'Full'}</Badge>
                </div>
                <div className="muted" style={{ textTransform: 'capitalize' }}>
                  {league.sport}
                  {league.city ? ` · ${league.city}` : ''}
                  {league.country ? `, ${league.country}` : ''}
                </div>
                <div className="faint">
                  {teamCount} team{teamCount === 1 ? '' : 's'} · min {league.minPlayersPerTeam} players · Season {league.currentSeason}
                </div>
              </div>
              <span style={{ color: 'var(--faint)' }}><Icon name="chevronRight" size={16} /></span>
            </Link>
            {spots > 0 &&
              myFreeTeams.map((t) => (
                <button
                  key={t.id}
                  className="btn primary small"
                  style={{ marginTop: 10 }}
                  onClick={() => enterLeague(t.id, league.id)}
                >
                  <Icon name="shield" size={14} /> Enter with {t.name}
                </button>
              ))}
          </div>
        ))
      )}

      <Link to="/create-league" className="btn" style={{ textDecoration: 'none', marginTop: 8 }}>
        <Icon name="plus" size={15} /> Start a league around you
      </Link>
      <p className="faint" style={{ marginTop: 14, textAlign: 'center' }}>
        Searches the leagues on this device. Private leagues don&rsquo;t show up here.
      </p>
    </div>
  )
}
