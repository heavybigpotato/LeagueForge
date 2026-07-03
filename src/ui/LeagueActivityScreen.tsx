import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { EmptyState, formatWhen } from './components'
import { Icon } from './icons'

/**
 * The league's activity log: every action, in order, never edited or deleted.
 * A transparency feature — reachable from the league but out of the main
 * three-tab flow so the day-to-day stays uncluttered.
 */
export function LeagueActivityScreen() {
  const { leagueId } = useParams()
  const { state } = useStore()
  const league = state.leagues.find((l) => l.id === leagueId)
  if (!league) return <EmptyState icon="alert">League not found.</EmptyState>

  const entries = state.auditLog.filter((e) => e.leagueId === league.id).slice().reverse()

  return (
    <div>
      <Link to={`/league/${league.id}`} className="backlink"><Icon name="arrowLeft" size={15} /> {league.name}</Link>
      <div className="kicker" style={{ marginTop: 10 }}>On the record</div>
      <h1>Activity Log</h1>
      <p className="muted" style={{ marginTop: 0 }}>Every action in this league. Nothing is edited or deleted.</p>

      {entries.length === 0 ? (
        <EmptyState icon="scroll">Nothing has happened yet.</EmptyState>
      ) : (
        <div className="card">
          <div className="audit">
            {entries.map((e, i) => (
              <div className={`entry${i < 3 ? ' hot' : ''}`} key={e.id}>
                <div className="when">{formatWhen(e.at)}</div>
                <div className="what">{e.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
