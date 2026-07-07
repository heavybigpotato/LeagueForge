import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { PLATFORM_MIN_PLAYERS, type Match } from '../core/types'
import { formGuide } from '../core/standings'
import { now } from '../adapters/clock'
import { ActionCard, Badge, FormPills, TeamLogo, formatDate, formatTime } from './components'
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
  const freeOfficialTeams = myCaptainTeams.filter((t) => t.status === 'official' && t.leagueId === null)
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

      {(attention > 0 || pendingTeams.length > 0 || freeOfficialTeams.length > 0) && (
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
              sub={`${t.name} · players waiting on your approval`}
            />
          ))}
          {pendingTeams.map((t) => {
            const league = state.leagues.find((l) => l.id === t.leagueId)
            const required = league?.minPlayersPerTeam ?? PLATFORM_MIN_PLAYERS
            const missing = required - t.memberIds.length
            return (
              <ActionCard
                key={t.id}
                to={`/team/${t.id}`}
                icon="ticket"
                tone="gold"
                title={`${t.name} is ${missing} player${missing === 1 ? '' : 's'} from going official`}
                sub={`Share invite code ${t.inviteCode} to reach ${required}`}
              />
            )
          })}
          {freeOfficialTeams.map((t) => (
            <ActionCard
              key={t.id}
              to="/discover"
              icon="compass"
              tone="volt"
              title={`${t.name} is ready for a league`}
              sub="Browse leagues near you and enter as a complete side"
            />
          ))}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h2>Next up</h2>
          <NextMatchFeature match={upcoming[0]} />
          {upcoming.length > 1 && (
            <div className="card flush">
              {upcoming.slice(1).map((m) => {
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
          )}
        </>
      )}

      {myTeams.length === 0 && myLeagues.length === 0 && (
        <>
          <h2>Get started</h2>
          <ActionCard
            to="/create-team"
            icon="shield"
            tone="volt"
            title="Create a team"
            sub="Recruit your squad, then pick a league."
          />
          <ActionCard
            to="/join"
            icon="ticket"
            tone="blue"
            title="Join a team"
            sub="Have a code from a captain?"
          />
          <ActionCard
            to="/discover"
            icon="compass"
            tone="gold"
            title="Find a league"
            sub="See what's running around you."
          />
          <ActionCard
            to="/create-league"
            icon="trophy"
            tone="red"
            title="Create a league"
            sub="Set the rules. Run the season."
          />
        </>
      )}

      {myTeams.length > 0 && <h2>Your teams</h2>}
      {myTeams.map((t) => {
        const league = state.leagues.find((l) => l.id === t.leagueId)
        const form = formGuide(t.id, state.matches)
        return (
          <Link to={`/team/${t.id}`} key={t.id} className="card clickable">
            <div className="row">
              <TeamLogo team={t} size={42} />
              <div className="grow">
                <div className="row" style={{ gap: 8 }}>
                  <strong className="truncate">{t.name}</strong>
                  {t.captainId === currentUser.id && <Badge kind="volt">Captain</Badge>}
                  <Badge kind={t.status === 'official' ? 'official' : 'pending'}>{t.status}</Badge>
                </div>
                <div className="faint">
                  {league ? league.name : t.status === 'official' ? 'Free agent — pick a league' : `${t.memberIds.length} players · recruiting`}
                </div>
              </div>
              {form.length > 0 ? <FormPills form={form} /> : <span style={{ color: 'var(--faint)' }}><Icon name="chevronRight" size={16} /></span>}
            </div>
          </Link>
        )
      })}

      {myLeagues.length > 0 && <h2>Your leagues</h2>}
      {myLeagues.map((league) => {
        const official = state.teams.filter((t) => t.leagueId === league.id && t.status === 'official')
        const pending = state.teams.filter((t) => t.leagueId === league.id && t.status === 'pending')
        const played = state.matches.filter((m) => m.leagueId === league.id && m.status === 'official').length
        return (
          <Link to={`/league/${league.id}`} key={league.id} className="card clickable">
            <div className="row">
              <LeagueBadge name={league.name} size={46} />
              <div className="grow">
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 15.5, lineHeight: 1.25 }}>{league.name}</strong>
                  {league.commissionerId === currentUser.id ? (
                    <Badge kind="volt">Commissioner</Badge>
                  ) : (
                    <Badge kind="neutral">Member</Badge>
                  )}
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
      {(myTeams.length > 0 || myLeagues.length > 0) && (
        <div className="btnrow" style={{ marginTop: 6 }}>
          <Link to="/create-team" className="btn" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={15} /> New team
          </Link>
          <Link to="/create-league" className="btn" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={15} /> New league
          </Link>
        </div>
      )}

    </div>
  )
}

/** The nearest fixture, front and centre, with a live countdown to kickoff. */
function NextMatchFeature({ match }: { match: Match }) {
  const { state } = useStore()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const home = state.teams.find((t) => t.id === match.homeTeamId)
  const away = state.teams.find((t) => t.id === match.awayTeamId)
  if (!home || !away) return null

  const ms = new Date(match.scheduledAt).getTime() - now()
  const countdown = formatCountdown(ms)

  return (
    <Link to={`/match/${match.id}`} className="nextmatch">
      <div className="nm-head">
        <span className="kicker">{ms > 0 ? 'Kicks off in' : 'Kicking off'}</span>
        <span className="nm-count num">{countdown}</span>
      </div>
      <div className="nm-teams">
        <div className="nm-side">
          <TeamLogo team={home} size={44} />
          <strong className="truncate">{home.name}</strong>
        </div>
        <span className="nm-vs">VS</span>
        <div className="nm-side">
          <TeamLogo team={away} size={44} />
          <strong className="truncate">{away.name}</strong>
        </div>
      </div>
      <div className="nm-foot faint">{formatDate(match.scheduledAt)} · {formatTime(match.scheduledAt)} · {match.venue}</div>
    </Link>
  )
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  const m = mins % 60
  if (hours > 0) return `${hours}h ${m}m`
  return `${m}m`
}
