import { useStore } from '../store/store'
import { Avatar, Badge, VerificationChecks } from './components'

export function ProfileScreen() {
  const { state, currentUser, switchUser, resetDemo } = useStore()

  const myTeams = state.teams.filter((t) => t.memberIds.includes(currentUser.id))
  const myLeagues = state.leagues.filter((l) => l.commissionerId === currentUser.id)

  // Interesting identities for demoing every role from one device.
  const captains = state.teams.map((t) => t.captainId)
  const demoUsers = state.users.filter(
    (u) => u.id === currentUser.id || captains.includes(u.id) || state.leagues.some((l) => l.commissionerId === u.id),
  )
  const roleOf = (id: string) => {
    if (state.leagues.some((l) => l.commissionerId === id)) return 'Commissioner'
    const t = state.teams.find((x) => x.captainId === id)
    if (t) return `Captain · ${t.name}`
    return 'Player'
  }

  return (
    <div>
      <h1>Profile</h1>
      <div className="card">
        <div className="row">
          <Avatar user={currentUser} />
          <div className="grow">
            <strong>@{currentUser.username}</strong>
            <div className="faint">{currentUser.email} · {currentUser.phone}</div>
          </div>
        </div>
        <VerificationChecks user={currentUser} />
        <hr className="divider" />
        <div className="row">
          <div className="grow">
            <div className="faint">Reputation</div>
            <strong>{currentUser.reputation}</strong>
          </div>
          <div className="grow">
            <div className="faint">Teams</div>
            <strong>{myTeams.length}</strong>
          </div>
          <div className="grow">
            <div className="faint">Leagues run</div>
            <strong>{myLeagues.length}</strong>
          </div>
        </div>
      </div>

      <h2>Career</h2>
      <div className="card">
        {myTeams.length === 0 && myLeagues.length === 0 && <p className="faint" style={{ margin: 0 }}>No teams or leagues yet.</p>}
        {myLeagues.map((l) => (
          <div className="row" key={l.id} style={{ padding: '6px 0' }}>
            <span>{l.logo}</span>
            <span className="grow">{l.name}</span>
            <Badge kind="awaiting">Commissioner</Badge>
          </div>
        ))}
        {myTeams.map((t) => (
          <div className="row" key={t.id} style={{ padding: '6px 0' }}>
            <span>{t.logo}</span>
            <span className="grow">{t.name}</span>
            {t.captainId === currentUser.id ? <Badge kind="awaiting">Captain</Badge> : <Badge kind="neutral">Player</Badge>}
          </div>
        ))}
      </div>

      <h2>Demo: switch identity</h2>
      <p className="faint">
        LeagueForge separates commissioner, captain, player, and referee permissions. Switch identities to experience each
        role's view of the same league.
      </p>
      <div className="card">
        {demoUsers.map((u) => (
          <div className="row" key={u.id} style={{ padding: '6px 0' }}>
            <Avatar user={u} />
            <div className="grow">
              <strong>@{u.username}</strong>
              <div className="faint">{roleOf(u.id)}</div>
            </div>
            {u.id === currentUser.id ? (
              <Badge kind="official">You</Badge>
            ) : (
              <button className="btn small" onClick={() => switchUser(u.id)}>Switch</button>
            )}
          </div>
        ))}
      </div>

      <button className="btn danger" onClick={resetDemo}>Reset demo data</button>
    </div>
  )
}
