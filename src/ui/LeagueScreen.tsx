import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { computeStandings, formGuide } from '../core/standings'
import type { Match, Team } from '../core/types'
import { Badge, EmptyState, FormPills, RosterProgress, TeamLogo, formatDate, formatWhen } from './components'
import { Icon, LeagueBadge } from './icons'

type Tab = 'standings' | 'schedule' | 'teams' | 'log'

export function LeagueScreen() {
  const { leagueId } = useParams()
  const { state, currentUser, generateSchedule } = useStore()
  const [tab, setTab] = useState<Tab>('standings')

  const league = state.leagues.find((l) => l.id === leagueId)
  if (!league) return <EmptyState icon="alert">League not found.</EmptyState>

  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const official = teams.filter((t) => t.status === 'official')
  const matches = state.matches.filter((m) => m.leagueId === league.id)
  const verified = matches.filter((m) => m.status === 'official')
  const isCommissioner = currentUser.id === league.commissionerId
  const myTeam = teams.find((t) => t.memberIds.includes(currentUser.id))
  const goals = verified.reduce((sum, m) => sum + (m.result ? m.result.homeScore + m.result.awayScore : 0), 0)

  return (
    <div>
      <Link to="/" className="backlink"><Icon name="arrowLeft" size={15} /> Home</Link>

      <div className="hero">
        <div
          className="glow"
          style={{ background: `radial-gradient(420px 200px at 88% -30%, rgba(201,245,66,0.14), transparent 65%), radial-gradient(340px 180px at -10% 110%, rgba(108,196,245,0.09), transparent 60%)` }}
        />
        <div className="hero-head">
          <LeagueBadge name={league.name} size={54} />
          <div className="grow">
            <div className="kicker" style={{ textTransform: 'uppercase' }}>{league.sport} · {league.city}</div>
            <h1>{league.name}</h1>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <Badge kind="neutral">{league.privacy}</Badge>
              {isCommissioner && <Badge kind="volt">Commissioner</Badge>}
              {myTeam && !isCommissioner && <Badge kind="awaiting">{myTeam.name}</Badge>}
            </div>
          </div>
        </div>
        <div className="statchips">
          <div className="statchip"><div className="v">{official.length}</div><div className="k">Teams</div></div>
          <div className="statchip"><div className="v">{verified.length}</div><div className="k">Results</div></div>
          <div className="statchip"><div className="v">{goals}</div><div className="k">Goals</div></div>
          <div className="statchip"><div className="v">{Math.max(0, matches.length - verified.length)}</div><div className="k">To play</div></div>
        </div>
      </div>

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
            <EmptyState icon="calendar">
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
              <Icon name="calendar" size={16} /> {matches.length ? 'Regenerate remaining fixtures' : 'Generate schedule'}
            </button>
          )}
        </div>
      )}

      {tab === 'teams' && (
        <div>
          {teams.map((t) => (
            <Link to={`/team/${t.id}`} key={t.id} className="card clickable">
              <div className="row">
                <TeamLogo team={t} size={46} />
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <strong className="truncate">{t.name}</strong>
                    <Badge kind={t.status === 'official' ? 'official' : 'pending'}>{t.status}</Badge>
                  </div>
                  <div className="faint">
                    {t.memberIds.length} players · captain @{state.users.find((u) => u.id === t.captainId)?.username}
                  </div>
                </div>
                <span style={{ color: 'var(--faint)' }}><Icon name="chevronRight" size={16} /></span>
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
              <Icon name="plus" size={16} /> Create a Team
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
    return <EmptyState icon="activity">Standings appear once teams become official. Pending teams are never listed.</EmptyState>
  }
  return (
    <div className="card flush">
      {frozen && (
        <div className="statusnote" style={{ borderTop: 'none', color: 'var(--gold)' }}>
          <Icon name="alert" size={14} /> A dispute is open — disputed results are excluded until the commissioner resolves them.
        </div>
      )}
      <div style={{ padding: '2px 14px 6px' }}>
        <table className="standings">
          <thead>
            <tr>
              <th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th><th>Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const team = teams.find((t) => t.id === r.teamId)!
              return (
                <tr key={r.teamId} className={i === 0 && r.played > 0 ? 'lead' : ''}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    <Link to={`/team/${team.id}`} className="teamcell">
                      <TeamLogo team={team} size={24} />
                      <span>{team.name}</span>
                    </Link>
                  </td>
                  <td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td>
                  <td>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                  <td className="pts">{r.points}</td>
                  <td><FormPills form={formGuide(r.teamId, state.matches.filter((m) => m.leagueId === leagueId))} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="statusnote">
        Only verified results count · tie-breakers: goal difference, goals for, head-to-head
      </div>
    </div>
  )
}

function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const home = teams.find((t) => t.id === match.homeTeamId)
  const away = teams.find((t) => t.id === match.awayTeamId)
  if (!home || !away) return null
  const score = match.result ?? match.submission
  return (
    <Link to={`/match/${match.id}`} className="card clickable flush fixture">
      <div className="fixture-top">
        <span>Round {match.round}</span>
        <span>·</span>
        <span>{formatDate(match.scheduledAt)}</span>
        <span>·</span>
        <span className="truncate">{match.venue}</span>
        <span className="grow" />
        <MatchBadge status={match.status} />
      </div>
      <div className="scoreline">
        <div className="team"><TeamLogo team={home} size={38} />{home.name}</div>
        <div className="score num">
          {score ? (
            <>
              {score.homeScore}
              <span className="dash">–</span>
              {score.awayScore}
            </>
          ) : (
            <span className="vs">VS</span>
          )}
        </div>
        <div className="team"><TeamLogo team={away} size={38} />{away.name}</div>
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
      <div className="row" style={{ marginBottom: 12 }}>
        <span style={{ color: 'var(--volt)' }}><Icon name="scroll" size={17} /></span>
        <span className="faint">
          Immutable record of every action in this league. Entries can only be appended — never edited or deleted.
        </span>
      </div>
      <div className="audit">
        {entries.map((e, i) => (
          <div className={`entry${i < 3 ? ' hot' : ''}`} key={e.id}>
            <div className="when">{formatWhen(e.at)}</div>
            <div className="what">{e.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
