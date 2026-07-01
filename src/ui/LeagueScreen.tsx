import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { computeStandings } from '../core/standings'
import type { Match, Team } from '../core/types'
import { Badge, EmptyState, RosterProgress, TeamLogo, formatDate, formatWhen } from './components'

type Tab = 'standings' | 'schedule' | 'teams' | 'log'

export function LeagueScreen() {
  const { leagueId } = useParams()
  const { state, currentUser, generateSchedule } = useStore()
  const [tab, setTab] = useState<Tab>('standings')

  const league = state.leagues.find((l) => l.id === leagueId)
  if (!league) return <EmptyState icon="❓">League not found.</EmptyState>

  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const official = teams.filter((t) => t.status === 'official')
  const matches = state.matches.filter((m) => m.leagueId === league.id)
  const isCommissioner = currentUser.id === league.commissionerId
  const myTeam = teams.find((t) => t.memberIds.includes(currentUser.id))

  return (
    <div>
      <Link to="/" className="backlink">← Leagues</Link>
      <div className="banner" style={{ background: league.banner, marginTop: 10 }} />
      <div className="row" style={{ marginTop: 38 }}>
        <div className="logo-circle">{league.logo}</div>
        <div className="grow">
          <h1 style={{ margin: 0 }}>{league.name}</h1>
          <div className="muted">
            {league.sport} · {league.city}, {league.country}
            {isCommissioner && <> · <Badge kind="awaiting">Commissioner</Badge></>}
          </div>
        </div>
      </div>
      <p className="muted">{league.description}</p>

      <div className="tabs">
        {(['standings', 'schedule', 'teams', 'log'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'log' ? 'Audit Log' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'standings' && <Standings leagueId={league.id} />}

      {tab === 'schedule' && (
        <div>
          {matches.length === 0 ? (
            <EmptyState icon="📅">
              No fixtures yet.{' '}
              {isCommissioner ? 'Generate the schedule once at least two teams are official.' : 'The commissioner has not generated the schedule.'}
            </EmptyState>
          ) : (
            matches
              .slice()
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
              .map((m) => <MatchCard key={m.id} match={m} teams={teams} />)
          )}
          {isCommissioner && (
            <button className="btn" onClick={() => generateSchedule(league.id)}>
              ⚙️ {matches.length ? 'Regenerate remaining fixtures' : 'Generate schedule'} ({official.length} official teams)
            </button>
          )}
        </div>
      )}

      {tab === 'teams' && (
        <div>
          {teams.map((t) => (
            <Link to={`/team/${t.id}`} key={t.id} className="card clickable">
              <div className="row">
                <TeamLogo team={t} />
                <div className="grow">
                  <div className="row">
                    <strong>{t.name}</strong>
                    <Badge kind={t.status === 'official' ? 'official' : 'pending'}>{t.status}</Badge>
                  </div>
                  <div className="faint">{t.memberIds.length} players · captain @{state.users.find((u) => u.id === t.captainId)?.username}</div>
                </div>
              </div>
              {t.status === 'pending' && (
                <div style={{ marginTop: 8 }}>
                  <RosterProgress current={t.memberIds.length} required={league.minPlayersPerTeam} />
                </div>
              )}
            </Link>
          ))}
          {!myTeam && (
            <Link to={`/league/${league.id}/create-team`} className="btn primary" style={{ textDecoration: 'none' }}>
              + Create a Team
            </Link>
          )}
        </div>
      )}

      {tab === 'log' && <AuditLog leagueId={league.id} />}
    </div>
  )
}

function Standings({ leagueId }: { leagueId: string }) {
  const { state } = useStore()
  const league = state.leagues.find((l) => l.id === leagueId)!
  const teams = state.teams.filter((t) => t.leagueId === leagueId)
  const rows = computeStandings(league, teams, state.matches)
  const frozen = state.matches.some((m) => m.leagueId === leagueId && m.status === 'disputed')

  if (rows.length === 0) {
    return <EmptyState icon="📊">Standings appear once teams become official. Pending teams are never listed.</EmptyState>
  }
  return (
    <div className="card">
      {frozen && (
        <p className="faint" style={{ marginTop: 0 }}>
          ⚠️ A dispute is open — disputed results are excluded until the commissioner resolves them.
        </p>
      )}
      <table className="standings">
        <thead>
          <tr>
            <th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = teams.find((t) => t.id === r.teamId)!
            return (
              <tr key={r.teamId}>
                <td className="pos">{i + 1}</td>
                <td><Link to={`/team/${team.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>{team.logo} {team.name}</Link></td>
                <td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td>
                <td>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                <td className="pts">{r.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="faint" style={{ marginBottom: 0 }}>
        Only verified (official) results count. Tie-breakers: goal difference, goals for, head-to-head.
      </p>
    </div>
  )
}

function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const home = teams.find((t) => t.id === match.homeTeamId)
  const away = teams.find((t) => t.id === match.awayTeamId)
  if (!home || !away) return null
  const score = match.result ?? match.submission
  return (
    <Link to={`/match/${match.id}`} className="card clickable">
      <div className="row">
        <span className="faint">Round {match.round} · {formatDate(match.scheduledAt)} · {match.venue}</span>
        <span className="grow" />
        <MatchBadge status={match.status} />
      </div>
      <div className="scoreline">
        <div className="team"><TeamLogo team={home} size={36} />{home.name}</div>
        <div className="score">
          {score ? (
            <>
              {score.homeScore}
              <span className="dash">–</span>
              {score.awayScore}
            </>
          ) : (
            <span className="dash">vs</span>
          )}
        </div>
        <div className="team"><TeamLogo team={away} size={36} />{away.name}</div>
      </div>
    </Link>
  )
}

export function MatchBadge({ status }: { status: Match['status'] }) {
  switch (status) {
    case 'scheduled':
      return <Badge kind="neutral">Scheduled</Badge>
    case 'awaiting-confirmation':
      return <Badge kind="awaiting">Awaiting confirmation</Badge>
    case 'disputed':
      return <Badge kind="disputed">Disputed</Badge>
    case 'official':
      return <Badge kind="official">Official</Badge>
  }
}

function AuditLog({ leagueId }: { leagueId: string }) {
  const { state } = useStore()
  const entries = state.auditLog.filter((e) => e.leagueId === leagueId).slice().reverse()
  return (
    <div className="card">
      <p className="faint" style={{ marginTop: 0 }}>
        Immutable record of every action in this league. Entries can only be appended — never edited or deleted.
      </p>
      <div className="audit">
        {entries.map((e) => (
          <div className="entry" key={e.id}>
            <div className="when">{formatWhen(e.at)}</div>
            <div className="what">{e.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
