import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { inviteLink } from '../core/ids'
import { computeTeamStats } from '../core/teamStats'
import { formGuide } from '../core/standings'
import type { Team } from '../core/types'
import { Avatar, Badge, EmptyState, FormPills, RosterProgress, TeamLogo, VerificationChecks } from './components'
import { Icon } from './icons'
import { InviteQR } from './InviteQR'

export function TeamScreen() {
  const { teamId } = useParams()
  const { state, currentUser, approvePlayer } = useStore()

  const team = state.teams.find((t) => t.id === teamId)
  if (!team) return <EmptyState icon="alert">Team not found.</EmptyState>
  const league = state.leagues.find((l) => l.id === team.leagueId)!
  const captain = state.users.find((u) => u.id === team.captainId)
  const isCaptain = currentUser.id === team.captainId
  const userOf = (id: string) => state.users.find((u) => u.id === id)

  return (
    <div>
      <Link to={`/league/${league.id}`} className="backlink"><Icon name="arrowLeft" size={15} /> {league.name}</Link>

      <div className="hero">
        <div
          className="glow"
          style={{ background: `radial-gradient(420px 220px at 85% -30%, ${team.primaryColor}2e, transparent 65%)` }}
        />
        <div className="hero-head">
          <TeamLogo team={team} size={62} />
          <div className="grow">
            <h1>{team.name}</h1>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <Badge kind={team.status === 'official' ? 'official' : 'pending'}>
                {team.status === 'official' ? 'Official Team' : 'Pending'}
              </Badge>
              {team.rosterLocked && <Badge kind="neutral"><Icon name="lock" size={10} /> Roster locked</Badge>}
            </div>
          </div>
        </div>
        <div className="kitbar">
          <i style={{ background: team.primaryColor }} />
          <i style={{ background: team.secondaryColor }} />
          <i style={{ background: team.primaryColor }} />
        </div>
        {team.bio && <p className="muted" style={{ marginBottom: 0 }}>{team.bio}</p>}
      </div>

      {team.status === 'pending' ? (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--volt)' }}><Icon name="gauge" size={17} /></span>
            <strong>Road to activation</strong>
          </div>
          <RosterProgress current={team.memberIds.length} required={league.minPlayersPerTeam} />
          <p className="faint" style={{ marginBottom: 0 }}>
            A pending team cannot play matches, be scheduled, or appear in standings. When player #{league.minPlayersPerTeam} is
            approved, the team is automatically registered in the league and the commissioner is notified.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--green)' }}><Icon name="shieldCheck" size={17} /></span>
            <strong>Officially registered</strong>
          </div>
          <p className="faint" style={{ marginBottom: 0 }}>
            Activated {team.activatedAt ? new Date(team.activatedAt).toLocaleDateString() : ''} — this team is in the league,
            included in the schedule and eligible for standings.
          </p>
        </div>
      )}

      {isCaptain && !team.rosterLocked && (
        <div className="ticket">
          <div className="row" style={{ gap: 8, position: 'relative' }}>
            <span style={{ color: 'var(--volt)' }}><Icon name="ticket" size={17} /></span>
            <strong>Invite players</strong>
          </div>
          <p className="faint" style={{ position: 'relative' }}>
            Share the code, link, or QR. Players need a verified email and phone number to join.
          </p>
          <div className="invite-code">{team.inviteCode}</div>
          <div className="faint" style={{ textAlign: 'center', position: 'relative' }}>{inviteLink(team.inviteCode)}</div>
          <InviteQR code={team.inviteCode} />
        </div>
      )}

      {team.status === 'official' && <SeasonStats team={team} />}

      {isCaptain && team.pendingMemberIds.length > 0 && (
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ color: 'var(--blue)' }}><Icon name="users" size={17} /></span>
            <strong>Join requests ({team.pendingMemberIds.length})</strong>
          </div>
          {team.pendingMemberIds.map((id) => {
            const u = userOf(id)
            if (!u) return null
            return (
              <div className="person" key={id}>
                <Avatar user={u} />
                <div className="grow">
                  <strong>@{u.username}</strong>
                  <VerificationChecks user={u} />
                </div>
                <button className="btn primary small" onClick={() => approvePlayer(team.id, u.id)}>
                  Approve
                </button>
              </div>
            )
          })}
        </div>
      )}

      <h2>
        Roster · {team.memberIds.length}/{league.maxPlayersPerTeam} <span style={{ color: 'var(--faint)' }}>(min {league.minPlayersPerTeam})</span>
      </h2>
      <div className="card">
        {team.memberIds.map((id) => {
          const u = userOf(id)
          if (!u) return null
          return (
            <div className="person" key={id}>
              <Avatar user={u} />
              <div className="grow">
                <div className="row" style={{ gap: 7 }}>
                  <strong>@{u.username}</strong>
                  {id === team.captainId && <Badge kind="volt">Captain</Badge>}
                </div>
                <div className="faint">reputation {u.reputation}</div>
              </div>
              <VerificationChecks user={u} />
            </div>
          )
        })}
      </div>
      {captain && (
        <p className="faint">Captain @{captain.username} manages the roster, submits scores, and confirms results.</p>
      )}
    </div>
  )
}

/** Team-level season statistics — LeagueForge tracks the club, not individuals. */
function SeasonStats({ team }: { team: Team }) {
  const { state } = useStore()
  const leagueMatches = state.matches.filter((m) => m.leagueId === team.leagueId)
  const s = computeTeamStats(team.id, leagueMatches)
  if (s.played === 0) return null
  const opponent = state.teams.find((t) => t.id === s.biggestWin?.opponentTeamId)
  const streakLabel = s.currentStreak
    ? `${s.currentStreak.count}${s.currentStreak.type}`
    : '—'
  return (
    <div className="card">
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <span style={{ color: 'var(--volt)' }}><Icon name="activity" size={17} /></span>
        <strong className="grow">Season stats</strong>
        <FormPills form={formGuide(team.id, leagueMatches)} />
      </div>
      <div className="statgrid">
        <div className="cell"><div className="v">{s.wins}-{s.draws}-{s.losses}</div><div className="k">Record</div></div>
        <div className="cell"><div className="v">{s.goalsFor}:{s.goalsAgainst}</div><div className="k">Goals</div></div>
        <div className="cell"><div className="v">{s.cleanSheets}</div><div className="k">Clean sheets</div></div>
        <div className="cell"><div className="v">{s.home.wins}-{s.home.draws}-{s.home.losses}</div><div className="k">Home</div></div>
        <div className="cell"><div className="v">{s.away.wins}-{s.away.draws}-{s.away.losses}</div><div className="k">Away</div></div>
        <div className="cell"><div className="v">{streakLabel}</div><div className="k">Streak</div></div>
      </div>
      {s.biggestWin && opponent && (
        <p className="faint" style={{ marginBottom: 0 }}>
          Biggest win: {s.biggestWin.scored}–{s.biggestWin.conceded} vs {opponent.name} · longest win streak {s.longestWinStreak}
        </p>
      )}
    </div>
  )
}
