import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { Badge, EmptyState } from './components'

export function HomeScreen() {
  const { state, currentUser } = useStore()

  return (
    <div>
      <h1>Leagues</h1>
      {state.leagues.length === 0 && (
        <EmptyState icon="🏆">No leagues yet. Create one and become its commissioner.</EmptyState>
      )}
      {state.leagues.map((league) => {
        const official = state.teams.filter((t) => t.leagueId === league.id && t.status === 'official')
        const pending = state.teams.filter((t) => t.leagueId === league.id && t.status === 'pending')
        return (
          <Link to={`/league/${league.id}`} key={league.id} className="card clickable">
            <div className="banner" style={{ background: league.banner || 'linear-gradient(135deg,#1f2937,#374151)' }} />
            <div className="row" style={{ marginTop: 36 }}>
              <div className="logo-circle">{league.logo}</div>
              <div className="grow">
                <div className="row">
                  <strong>{league.name}</strong>
                  {league.commissionerId === currentUser.id && <Badge kind="awaiting">Commissioner</Badge>}
                </div>
                <div className="muted">
                  {league.sport} · {league.city}, {league.country} · {league.privacy}
                </div>
              </div>
            </div>
            <div className="faint" style={{ marginTop: 10 }}>
              {official.length} official team{official.length === 1 ? '' : 's'}
              {pending.length > 0 && ` · ${pending.length} pending`} · season {league.seasonStart} → {league.seasonEnd}
            </div>
          </Link>
        )
      })}
      <Link to="/create-league" className="btn primary" style={{ textDecoration: 'none', marginTop: 8 }}>
        + Create a League
      </Link>
    </div>
  )
}
