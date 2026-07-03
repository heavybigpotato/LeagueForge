import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { ActionCard, Badge, TeamLogo, formatDate, formatTime } from './components'
import { Icon, LeagueBadge } from './icons'

export function HomeScreen() {
  const { state, currentUser } = useStore()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const myTeams = state.teams.filter((t) => t.memberIds.includes(currentUser.id))
  const myCaptainTeams = myTeams.filter((t) => t.captainId === currentUser.id)
  const myLeagues = state.leagues.filter(
    (l) => l.commissionerId === currentUser.id || myTeams.some((t) => t.leagueId === l.id),
  )

  // -------- items that genuinely need this person right now
  const confirmations = state.matches.filter(
    (m) =>
      m.status === 'awaiting-confirmation' &&
      myCaptainTeams.some((t) => (t.id === m.homeTeamId || t.id === m.awayTeamId) && t.id !== m.submission?.submittedByTeamId),
  )
  const disputes = state.matches.filter(
    (m) => m.status === 'disputed' && state.leagues.some((l) => l.id === m.leagueId && l.commissionerId === currentUser.id),
  )
  const approvals = myCaptainTeams.filter((t) => t.pendingMemberIds.length > 0)
  const pendingTeams = myCaptainTeams.filter((t) => t.status === 'pending')
  const attention = confirmations.length + disputes.length + approvals.length

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? '—'

  const upcoming = state.matches
    .filter(
      (m) =>
        m.status === 'scheduled' &&
        (myTeams.some((t) => t.id === m.homeTeamId || t.id === m.awayTeamId) ||
          state.leagues.some((l) => l.id === m.leagueId && l.commissionerId === currentUser.id)),
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 3)

  return (
    <div>
      <div className="kicker">{greeting}</div>
      <h1>@{currentUser.username}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {attention > 0
          ? `${attention} thing${attention === 1 ? '' : 's'} need${attention === 1 ? 's' : ''} your attention.`
          : 'All caught up.'}
      </p>

      {(attention > 0 || pendingTeams.length > 0) && (
        <>
          <h2>Needs your attention</h2>
          {confirmations.map((m) => (
            <ActionCard
              key={m.id}
              to={`/match/${m.id}`}
              icon="whistle"
              tone="blue"
              title="Confirm or dispute a score"
              sub={`${teamName(m.homeTeamId)} ${m.submission?.homeScore}–${m.submission?.awayScore} ${teamName(m.awayTeamId)} · submitted by the opposition`}
            />
          ))}
          {disputes.map((m) => (
            <ActionCard
              key={m.id}
              to={`/match/${m.id}`}
              icon="alert"
              tone="red"
              title="Resolve a disputed result"
              sub={`${teamName(m.homeTeamId)} vs ${teamName(m.awayTeamId)} · standings frozen until you rule`}
            />
          ))}
          {approvals.map((t) => (
            <ActionCard
              key={t.id}
              to={`/team/${t.id}`}
              icon="users"
              tone="volt"
              title={`${t.pendingMemberIds.length} join request${t.pendingMemberIds.length === 1 ? '' : 's'}`}
              sub={`${t.name} · verified players waiting on your approval`}
            />
          ))}
          {pendingTeams.map((t) => {
            const league = state.leagues.find((l) => l.id === t.leagueId)!
            const missing = league.minPlayersPerTeam - t.memberIds.length
            return (
              <ActionCard
                key={t.id}
                to={`/team/${t.id}`}
                icon="ticket"
                tone="gold"
                title={`${t.name} is ${missing} player${missing === 1 ? '' : 's'} from activation`}
                sub={`Share invite code ${t.inviteCode} to reach ${league.minPlayersPerTeam}`}
              />
            )
          })}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h2>Next up</h2>
          <div className="card flush">
            {upcoming.map((m) => {
              const home = state.teams.find((t) => t.id === m.homeTeamId)!
              const away = state.teams.find((t) => t.id === m.awayTeamId)!
              return (
                <Link key={m.id} to={`/match/${m.id}`} className="listlink" style={{ padding: '12px 14px' }}>
                  <TeamLogo team={home} size={30} />
                  <TeamLogo team={away} size={30} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 13.5 }} className="truncate">
                      {home.name} vs {away.name}
                    </strong>
                    <div className="faint">
                      {formatDate(m.scheduledAt)} · {formatTime(m.scheduledAt)} · {m.venue}
                    </div>
                  </span>
                  <span style={{ color: 'var(--faint)' }}><Icon name="chevronRight" size={16} /></span>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {state.leagues.length === 0 && (
        <>
          <h2>Get started</h2>
          <ActionCard
            to="/create-league"
            icon="trophy"
            tone="volt"
            title="Create a league"
            sub="Set the rules. Run the season."
          />
          <ActionCard
            to="/join"
            icon="ticket"
            tone="blue"
            title="Join a team"
            sub="Have a code from a captain?"
          />
        </>
      )}

      {state.leagues.length > 0 && <h2>Your leagues</h2>}
      {state.leagues.map((league) => {
        const official = state.teams.filter((t) => t.leagueId === league.id && t.status === 'official')
        const pending = state.teams.filter((t) => t.leagueId === league.id && t.status === 'pending')
        const played = state.matches.filter((m) => m.leagueId === league.id && m.status === 'official').length
        const mine = myLeagues.includes(league)
        return (
          <Link to={`/league/${league.id}`} key={league.id} className="card clickable">
            <div className="row">
              <LeagueBadge name={league.name} size={46} />
              <div className="grow">
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 15.5, lineHeight: 1.25 }}>{league.name}</strong>
                  {league.commissionerId === currentUser.id ? (
                    <Badge kind="volt">Commissioner</Badge>
                  ) : mine ? (
                    <Badge kind="neutral">Member</Badge>
                  ) : null}
                </div>
                <div className="muted" style={{ textTransform: 'capitalize' }}>
                  {league.sport} · {league.city}, {league.country}
                </div>
              </div>
            </div>
            <div className="row faint" style={{ marginTop: 12, gap: 14 }}>
              <span className="row" style={{ gap: 5 }}><Icon name="shield" size={13} /> {official.length} official{pending.length > 0 ? ` · ${pending.length} pending` : ''}</span>
              <span className="row" style={{ gap: 5 }}><Icon name="whistle" size={13} /> {played} verified result{played === 1 ? '' : 's'}</span>
            </div>
          </Link>
        )
      })}
      {state.leagues.length > 0 && (
        <Link to="/create-league" className="btn primary" style={{ textDecoration: 'none', marginTop: 6 }}>
          <Icon name="plus" size={16} /> Create a League
        </Link>
      )}
    </div>
  )
}
