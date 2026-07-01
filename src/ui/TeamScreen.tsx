import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { inviteLink } from '../core/ids'
import { Avatar, Badge, EmptyState, RosterProgress, TeamLogo, VerificationChecks } from './components'

export function TeamScreen() {
  const { teamId } = useParams()
  const { state, currentUser, approvePlayer } = useStore()

  const team = state.teams.find((t) => t.id === teamId)
  if (!team) return <EmptyState icon="❓">Team not found.</EmptyState>
  const league = state.leagues.find((l) => l.id === team.leagueId)!
  const captain = state.users.find((u) => u.id === team.captainId)
  const isCaptain = currentUser.id === team.captainId
  const userOf = (id: string) => state.users.find((u) => u.id === id)

  return (
    <div>
      <Link to={`/league/${league.id}`} className="backlink">← {league.name}</Link>
      <div className="row" style={{ marginTop: 12 }}>
        <TeamLogo team={team} size={56} />
        <div className="grow">
          <h1 style={{ margin: 0 }}>{team.name}</h1>
          <div className="row" style={{ marginTop: 4 }}>
            <Badge kind={team.status === 'official' ? 'official' : 'pending'}>
              {team.status === 'official' ? 'Official Team' : 'Pending'}
            </Badge>
            {team.rosterLocked && <Badge kind="neutral">Roster locked</Badge>}
          </div>
        </div>
      </div>
      {team.bio && <p className="muted">{team.bio}</p>}

      {team.status === 'pending' ? (
        <div className="card">
          <strong>Road to activation</strong>
          <RosterProgress current={team.memberIds.length} required={league.minPlayersPerTeam} />
          <p className="faint">
            A pending team cannot play matches, be scheduled, or appear in standings. When player #{league.minPlayersPerTeam} is
            approved, the team is automatically registered in the league and the commissioner is notified.
          </p>
        </div>
      ) : (
        <div className="card">
          <strong>🎉 Officially registered</strong>
          <p className="faint" style={{ marginBottom: 0 }}>
            Activated {team.activatedAt ? new Date(team.activatedAt).toLocaleDateString() : ''} — this team is in the league,
            included in the schedule and eligible for standings.
          </p>
        </div>
      )}

      {isCaptain && !team.rosterLocked && (
        <div className="card">
          <strong>Invite players</strong>
          <p className="faint">Share the code, link, or QR. Players need a verified email and phone number to join.</p>
          <div className="invite-code">{team.inviteCode}</div>
          <div className="faint" style={{ textAlign: 'center' }}>{inviteLink(team.inviteCode)}</div>
          <div className="qr" title="QR code" />
        </div>
      )}

      {isCaptain && team.pendingMemberIds.length > 0 && (
        <div className="card">
          <strong>Join requests ({team.pendingMemberIds.length})</strong>
          {team.pendingMemberIds.map((id) => {
            const u = userOf(id)
            if (!u) return null
            return (
              <div className="row" key={id} style={{ marginTop: 10 }}>
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
        Roster · {team.memberIds.length}/{league.maxPlayersPerTeam}
        <span className="faint"> (min {league.minPlayersPerTeam})</span>
      </h2>
      <div className="card">
        {team.memberIds.map((id) => {
          const u = userOf(id)
          if (!u) return null
          return (
            <div className="row" key={id} style={{ padding: '7px 0' }}>
              <Avatar user={u} />
              <div className="grow">
                <strong>@{u.username}</strong> {id === team.captainId && <Badge kind="awaiting">Captain</Badge>}
                <div className="faint">reputation {u.reputation}</div>
              </div>
              <VerificationChecks user={u} />
            </div>
          )
        })}
      </div>
      {captain && (
        <p className="faint">
          Captain @{captain.username} manages the roster, submits scores, and confirms results.
        </p>
      )}
    </div>
  )
}
