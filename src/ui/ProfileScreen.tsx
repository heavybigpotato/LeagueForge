import { useStore } from '../store/store'
import { Avatar, Badge, VerificationChecks } from './components'
import { Icon, LeagueBadge, Crest } from './icons'

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
      <div className="kicker">Career profile</div>
      <h1>@{currentUser.username}</h1>

      <div className="hero" style={{ marginTop: 8 }}>
        <div className="glow" style={{ background: 'radial-gradient(380px 190px at 90% -25%, rgba(201,245,66,0.12), transparent 65%)' }} />
        <div className="hero-head">
          <Avatar user={currentUser} />
          <div className="grow">
            <strong>{currentUser.email}</strong>
            <div className="faint">{currentUser.phone}</div>
            <VerificationChecks user={currentUser} />
          </div>
        </div>
        <div className="statchips">
          <div className="statchip"><div className="v">{currentUser.reputation}</div><div className="k">Reputation</div></div>
          <div className="statchip"><div className="v">{myTeams.length}</div><div className="k">Teams</div></div>
          <div className="statchip"><div className="v">{myLeagues.length}</div><div className="k">Leagues run</div></div>
        </div>
      </div>

      <h2>Career</h2>
      <div className="card">
        {myTeams.length === 0 && myLeagues.length === 0 && (
          <p className="faint" style={{ margin: 0 }}>No teams or leagues yet.</p>
        )}
        {myLeagues.map((l) => (
          <div className="listlink" key={l.id}>
            <LeagueBadge name={l.name} size={32} />
            <span className="grow truncate" style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</span>
            <Badge kind="volt">Commissioner</Badge>
          </div>
        ))}
        {myTeams.map((t) => (
          <div className="listlink" key={t.id}>
            <Crest team={t} size={32} />
            <span className="grow truncate" style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
            {t.captainId === currentUser.id ? <Badge kind="volt">Captain</Badge> : <Badge kind="neutral">Player</Badge>}
          </div>
        ))}
      </div>

      <h2>Demo: switch identity</h2>
      <p className="faint" style={{ marginTop: -2 }}>
        LeagueForge separates commissioner, captain, player, and referee permissions. Switch identities to experience each
        role&rsquo;s view of the same league.
      </p>
      <div className="card">
        {demoUsers.map((u) => (
          <div className="person" key={u.id}>
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

      <button className="btn danger" onClick={resetDemo}>
        <Icon name="x" size={15} /> Reset demo data
      </button>
    </div>
  )
}
