import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { inviteLink } from '../core/ids'
import { useState } from 'react'
import { computeTeamStats } from '../core/teamStats'
import { clubProfile, trophyCount } from '../core/clubStats'
import { formGuide } from '../core/standings'
import { rosterBounds } from '../core/team'
import { ROUTES } from '../core/config'
import type { Team } from '../core/types'
import { Avatar, Badge, EmptyState, FormPills, RosterProgress, TeamLogo } from './components'
import { Ring } from './charts'
import { Icon } from './icons'
import { InviteQR } from './InviteQR'

export function TeamScreen() {
  const { teamId } = useParams()
  const { state, currentUser, approvePlayer, leaveLeague } = useStore()

  const team = state.teams.find((t) => t.id === teamId)
  if (!team) return <EmptyState icon="alert">Team not found.</EmptyState>
  const league = state.leagues.find((l) => l.id === team.leagueId) ?? null
  const bounds = rosterBounds(league)
  const isCaptain = currentUser.id === team.captainId
  const userOf = (id: string) => state.users.find((u) => u.id === id)
  const hasFixturesThisSeason =
    league !== null &&
    state.matches.some(
      (m) =>
        m.leagueId === league.id &&
        (m.season ?? 1) === league.currentSeason &&
        (m.homeTeamId === team.id || m.awayTeamId === team.id),
    )
  const championships = state.leagues.reduce(
    (count, l) => count + l.seasons.filter((s) => s.championTeamId === team.id).length,
    0,
  )

  return (
    <div>
      {league ? (
        <Link to={`/league/${league.id}`} className="backlink"><Icon name="arrowLeft" size={15} /> {league.name}</Link>
      ) : (
        <Link to={ROUTES.home} className="backlink"><Icon name="arrowLeft" size={15} /> Home</Link>
      )}

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
              {!league && team.status === 'official' && <Badge kind="awaiting">Free agent</Badge>}
              {championships > 0 && <Badge kind="pending">🏆 Champions{championships > 1 ? ` ×${championships}` : ''}</Badge>}
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

      {league ? (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: team.status === 'official' ? 'var(--green)' : 'var(--volt)' }}>
              <Icon name={team.status === 'official' ? 'shieldCheck' : 'gauge'} size={17} />
            </span>
            <div className="grow">
              <strong>
                {hasFixturesThisSeason ? 'Playing in ' : 'Registered for '}
                <Link to={`/league/${league.id}`} style={{ color: 'var(--volt)' }}>{league.name}</Link>
              </strong>
              <div className="faint">
                {team.status === 'official'
                  ? `Ready · ${team.memberIds.length} players · Season ${league.currentSeason}`
                  : `Recruiting — reach ${bounds.min} players to be ready for kickoff`}
              </div>
            </div>
          </div>
          {team.status !== 'official' && (
            <div style={{ marginTop: 10 }}>
              <RosterProgress current={team.memberIds.length} required={bounds.min} />
            </div>
          )}
          {isCaptain && !hasFixturesThisSeason && (
            <button
              className="btn small danger"
              style={{ marginTop: 12 }}
              onClick={() => {
                if (window.confirm(`Withdraw from ${league.name}? The team stays together and can register elsewhere.`)) leaveLeague(team.id)
              }}
            >
              Withdraw from league
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--volt)' }}><Icon name={team.status === 'official' ? 'trophy' : 'gauge'} size={17} /></span>
            <div className="grow">
              <strong>{team.status === 'official' ? 'Ready for a league' : 'Building the squad'}</strong>
              <div className="faint">
                {team.status === 'official'
                  ? `${team.memberIds.length} players — register anywhere.`
                  : `${team.memberIds.length}/${bounds.min} players. You can register for a league now and recruit the rest.`}
              </div>
            </div>
          </div>
          {team.status !== 'official' && (
            <div style={{ marginTop: 10 }}>
              <RosterProgress current={team.memberIds.length} required={bounds.min} />
            </div>
          )}
          {isCaptain && <JoinLeagueBox teamId={team.id} />}
        </div>
      )}

      {isCaptain && !team.rosterLocked && (
        <div className="ticket">
          <div className="row" style={{ gap: 8, position: 'relative' }}>
            <span style={{ color: 'var(--volt)' }}><Icon name="ticket" size={17} /></span>
            <strong>Invite players</strong>
          </div>
          <p className="faint" style={{ position: 'relative' }}>Share the code, link, or QR.</p>
          <div className="invite-code">{team.inviteCode}</div>
          <div className="faint" style={{ textAlign: 'center', position: 'relative' }}>{inviteLink(team.inviteCode)}</div>
          <InviteQR code={team.inviteCode} />
          <div className="btnrow" style={{ position: 'relative', marginTop: 12 }}>
            <button className="btn small" onClick={() => copyInvite(team.inviteCode, false)}>Copy code</button>
            <button className="btn small" onClick={() => copyInvite(team.inviteCode, true)}>Share link</button>
          </div>
        </div>
      )}

      <ClubCard team={team} />

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
                  <div className="faint">reputation {u.reputation}</div>
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
        Roster · {team.memberIds.length}/{bounds.max} <span style={{ color: 'var(--faint)' }}>(min {bounds.min})</span>
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
            </div>
          )
        })}
      </div>

    </div>
  )
}

/** A free team's two ways into a league: browse Discover, or paste a league code. */
function JoinLeagueBox({ teamId }: { teamId: string }) {
  const { enterLeagueByCode } = useStore()
  const [code, setCode] = useState('')
  return (
    <div style={{ marginTop: 12 }}>
      <Link to={ROUTES.discover} className="btn primary" style={{ textDecoration: 'none' }}>
        <Icon name="compass" size={16} /> Find a league
      </Link>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Have a league code?"
          maxLength={8}
          style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}
        />
        <button
          className="btn small"
          disabled={code.trim().length < 4}
          onClick={() => {
            if (enterLeagueByCode(teamId, code)) setCode('')
          }}
        >
          Join
        </button>
      </div>
    </div>
  )
}

/** Copy the code, or share the deep link via the native share sheet when available. */
async function copyInvite(code: string, asLink: boolean) {
  const link = `${window.location.origin}${window.location.pathname}#/join/${code}`
  try {
    if (asLink && navigator.share) {
      await navigator.share({ title: 'Join my team on LeagueForge', url: link })
      return
    }
    await navigator.clipboard.writeText(asLink ? link : code)
  } catch {
    /* user dismissed the share sheet, or clipboard unavailable */
  }
}

/**
 * The club's honours and all-time story: a trophy cabinet and a lifetime
 * record across every league and season it has ever played.
 */
function ClubCard({ team }: { team: Team }) {
  const { state } = useStore()
  const profile = clubProfile(team.id, state.leagues, state.matches)
  const { total, leagues, cups } = trophyCount(profile.titles)
  const s = profile.allTime
  const winPct = s.played ? (s.wins / s.played) * 100 : 0
  if (total === 0 && s.played === 0) return null

  return (
    <>
      {total > 0 && (
        <>
          <h2>Trophy cabinet</h2>
          <div className="card">
            <div className="row" style={{ gap: 14, marginBottom: profile.titles.length ? 12 : 0 }}>
              <span className="honoricon" style={{ background: 'rgba(240,199,94,0.14)' }}><Icon name="trophy" size={22} /></span>
              <div className="grow">
                <strong style={{ fontSize: 20 }}>{total} {total === 1 ? 'trophy' : 'trophies'}</strong>
                <div className="faint">
                  {leagues > 0 && `${leagues} league title${leagues === 1 ? '' : 's'}`}
                  {leagues > 0 && cups > 0 && ' · '}
                  {cups > 0 && `${cups} cup${cups === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>
            {profile.titles.map((t, i) => (
              <div className="person" key={i}>
                <span className="honoricon"><Icon name={t.kind === 'cup' ? 'trophy' : 'shieldCheck'} size={16} /></span>
                <div className="grow">
                  <strong>{t.leagueName}</strong>
                  <div className="faint">{t.kind === 'cup' ? 'Cup winners' : 'League champions'} · Season {t.season}</div>
                </div>
                <Badge kind="pending">🏆</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {s.played > 0 && (
        <>
          <h2>All-time record</h2>
          <div className="card">
            <div className="row" style={{ gap: 16, alignItems: 'center' }}>
              <Ring pct={winPct} label="Win rate" />
              <div className="grow statgrid" style={{ marginTop: 0 }}>
                <div className="cell"><div className="v">{s.played}</div><div className="k">Played</div></div>
                <div className="cell"><div className="v">{s.wins}-{s.draws}-{s.losses}</div><div className="k">W-D-L</div></div>
                <div className="cell"><div className="v">{s.goalsFor}:{s.goalsAgainst}</div><div className="k">Goals</div></div>
                <div className="cell"><div className="v">{s.cleanSheets}</div><div className="k">Clean sheets</div></div>
              </div>
            </div>
            <p className="faint" style={{ marginBottom: 0, marginTop: 10 }}>
              {profile.appearances > 0 ? `${profile.appearances} league${profile.appearances === 1 ? '' : 's'} played · ` : ''}
              longest win streak {s.longestWinStreak}
            </p>
          </div>
        </>
      )}
    </>
  )
}

/** Team-level season statistics — LeagueForge tracks the club, not individuals. */
function SeasonStats({ team }: { team: Team }) {
  const { state } = useStore()
  const league = state.leagues.find((l) => l.id === team.leagueId)
  const leagueMatches = state.matches.filter(
    (m) => m.leagueId === team.leagueId && (m.season ?? 1) === (league?.currentSeason ?? 1),
  )
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
