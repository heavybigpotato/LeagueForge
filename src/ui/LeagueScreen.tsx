import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { computeStandings, formGuide } from '../core/standings'
import { currentSeasonMatches } from '../core/seasons'
import { powerRankings } from '../core/powerRankings'
import { leagueSeasonStats } from '../core/leagueStats'
import { Bars, Donut } from './charts'
import { ROUTES } from '../core/config'
import { shareStandingsCard } from './shareCards'
import type { Match, Team } from '../core/types'
import { Badge, EmptyState, FormPills, RosterProgress, TeamLogo, formatDate, formatWhen } from './components'
import type { League, SeasonRecord } from '../core/types'
import { Icon, LeagueBadge } from './icons'
import { LeagueCodeCard } from './LeagueCodeCard'
import { CupBracket, LaunchCard } from './BracketView'

// A league shows Table · Matches · Teams; a cup collapses to Bracket · Teams.
// Everything rarer (past seasons, activity log, settings) hangs off links.
type Tab = 'main' | 'matches' | 'teams'

export function LeagueScreen() {
  const { leagueId } = useParams()
  const { state, currentUser, enterLeague } = useStore()
  const [tab, setTab] = useState<Tab>('main')

  const league = state.leagues.find((l) => l.id === leagueId)
  if (!league) return <EmptyState icon="alert">League not found.</EmptyState>

  const isCup = league.scheduleFormat === 'knockout'
  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const official = teams.filter((t) => t.status === 'official')
  const matches = state.matches.filter((m) => m.leagueId === league.id && (m.season ?? 1) === league.currentSeason)
  const verified = matches.filter((m) => m.status === 'official')
  const launched = matches.length > 0
  const isCommissioner = currentUser.id === league.commissionerId
  const myTeam = teams.find((t) => t.memberIds.includes(currentUser.id))
  // Official free teams this user captains — they can register right here.
  const myFreeTeams = state.teams.filter(
    (t) => t.captainId === currentUser.id && t.leagueId === null,
  )
  const goals = verified.reduce((sum, m) => sum + (m.result ? m.result.homeScore + m.result.awayScore : 0), 0)
  // Reigning champion = winner of the most recently archived season.
  const lastSeason = league.seasons[league.seasons.length - 1]
  const reigningChampion = teams.find((t) => t.id === lastSeason?.championTeamId)

  const tabDefs: { key: Tab; label: string }[] = isCup
    ? [{ key: 'main', label: 'Bracket' }, { key: 'teams', label: 'Teams' }]
    : [{ key: 'main', label: 'Table' }, { key: 'matches', label: 'Matches' }, { key: 'teams', label: 'Teams' }]
  const activeTab = tabDefs.some((t) => t.key === tab) ? tab : 'main'

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
          <div className="grow" style={{ position: 'relative' }}>
            {isCommissioner && (
              <Link
                to={ROUTES.leagueSettings(league.id)}
                aria-label="League settings"
                style={{ position: 'absolute', right: 0, top: 0, color: 'var(--muted)' }}
              >
                <Icon name="gauge" size={20} />
              </Link>
            )}
            <div className="kicker" style={{ textTransform: 'uppercase' }}>{league.sport} · {league.city}</div>
            <h1>{league.name}</h1>
            <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <Badge kind="volt">Season {league.currentSeason}</Badge>
              <Badge kind="neutral">{isCup ? 'knockout cup' : league.privacy}</Badge>
              {isCommissioner && <Badge kind="volt">Commissioner</Badge>}
              {myTeam && !isCommissioner && <Badge kind="awaiting">{myTeam.name}</Badge>}
              {reigningChampion && <Badge kind="pending">🏆 {reigningChampion.name}</Badge>}
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

      <Announcements league={league} isCommissioner={isCommissioner} />

      {isCommissioner && <SetupChecklist league={league} />}

      <div className="tabs">
        {tabDefs.map((t) => (
          <button key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'main' &&
        (isCup ? (
          <CupBracket league={league} />
        ) : (
          <>
            {!launched && <LaunchCard league={league} />}
            <Standings leagueId={league.id} />
            <SeasonStatsPanel league={league} />
            <PastSeasons league={league} />
          </>
        ))}

      {activeTab === 'matches' && <MatchesTab league={league} />}

      {activeTab === 'teams' && (
        <div>
          <LeagueCodeCard league={league} />
          {teams.length === 0 && (
            <EmptyState icon="users">No teams registered yet. Share the code above to fill it up.</EmptyState>
          )}
          {teams.map((t) => (
            <Link to={`/team/${t.id}`} key={t.id} className="card clickable">
              <div className="row">
                <TeamLogo team={t} size={46} />
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <strong className="truncate">{t.name}</strong>
                    {t.status === 'official' ? <Badge kind="official">Ready</Badge> : <Badge kind="pending">Recruiting</Badge>}
                  </div>
                  <div className="faint">
                    captain @{state.users.find((u) => u.id === t.captainId)?.username}
                    {t.status === 'official' ? ` · ${t.memberIds.length} players` : ''}
                  </div>
                </div>
                <span style={{ color: 'var(--faint)' }}><Icon name="chevronRight" size={16} /></span>
              </div>
              {t.status !== 'official' && (
                <div style={{ marginTop: 8 }}>
                  <RosterProgress current={t.memberIds.length} required={league.minPlayersPerTeam} />
                </div>
              )}
            </Link>
          ))}
          {!launched && myFreeTeams.map((t) => (
            <button key={t.id} className="btn primary" onClick={() => enterLeague(t.id, league.id)}>
              <Icon name="shield" size={16} /> Register {t.name}
              {t.status !== 'official' ? ` (${t.memberIds.length}/${league.minPlayersPerTeam})` : ''}
            </button>
          ))}
          {!myTeam && myFreeTeams.length === 0 && (
            <Link to="/create-team" className="btn primary" style={{ textDecoration: 'none' }}>
              <Icon name="plus" size={16} /> Create a Team to register
            </Link>
          )}
        </div>
      )}

      <Link to={ROUTES.leagueActivity(league.id)} className="listlink" style={{ marginTop: 18, borderRadius: 14 }}>
        <span style={{ color: 'var(--muted)' }}><Icon name="scroll" size={16} /></span>
        <span className="grow faint">Activity log</span>
        <span style={{ color: 'var(--faint)' }}><Icon name="chevronRight" size={16} /></span>
      </Link>

    </div>
  )
}

/**
 * The Matches tab. The season doesn't start on its own — the commissioner
 * kicks it off from the launch card, which draws the fixtures and closes
 * entry. Until then teams keep registering.
 */
function MatchesTab({ league }: { league: League }) {
  const { state, currentUser, launchSeason } = useStore()
  const isCommissioner = currentUser.id === league.commissionerId
  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const fixtures = currentSeasonMatches(league, state.matches).slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const launched = fixtures.length > 0

  if (!launched) return <LaunchCard league={league} />

  return (
    <div>
      {fixtures.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)}
      {isCommissioner && (
        <button className="btn" onClick={() => launchSeason(league.id)}>
          <Icon name="calendar" size={16} /> Redraw remaining fixtures
        </button>
      )}
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
    return <EmptyState icon="activity" title="No table yet">Standings appear once teams go official and results are verified.</EmptyState>
  }
  return (
    <>
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
              const cls = i === 0 && r.played > 0 ? 'lead' : ''
              return (
                <tr key={r.teamId} className={cls}>
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
      <div className="statusnote">Verified results only · the table decides the champion</div>
    </div>

    {rows.some((r) => r.played > 0) && (
      <button className="btn" onClick={() => shareStandingsCard(league, rows, teams)}>
        <Icon name="send" size={15} /> Share standings card
      </button>
    )}

    <PowerRankingsCard leagueId={leagueId} />
    </>
  )
}

/** Weekly power rankings: quality of play, not just points. */
function PowerRankingsCard({ leagueId }: { leagueId: string }) {
  const { state } = useStore()
  const league = state.leagues.find((l) => l.id === leagueId)!
  const teams = state.teams.filter((t) => t.leagueId === leagueId)
  const ranks = powerRankings(league, teams, state.matches)
  if (ranks.length < 2 || ranks.every((r) => r.rating === ranks[0].rating)) return null
  return (
    <>
      <h2>Power Rankings</h2>
      <div className="card">
        {ranks.map((r) => {
          const team = teams.find((t) => t.id === r.teamId)!
          return (
            <div className="pr-row" key={r.teamId}>
              <span className="pr-rank">{r.rank}</span>
              <TeamLogo team={team} size={26} />
              <span className="grow truncate" style={{ fontWeight: 700, fontSize: 13.5 }}>{team.name}</span>
              <span className={`pr-move ${r.movement > 0 ? 'up' : r.movement < 0 ? 'down' : 'same'}`}>
                {r.movement > 0 ? `▲${r.movement}` : r.movement < 0 ? `▼${-r.movement}` : '—'}
              </span>
              <span className="pr-bar"><i style={{ width: `${r.rating}%` }} /></span>
              <span className="pr-rating num">{r.rating}</span>
            </div>
          )
        })}
        <p className="faint" style={{ marginBottom: 0 }}>Form, margin, and strength of opponent — recent games count more.</p>
      </div>
    </>
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

/** Commissioner bulletin board — latest news pinned under the hero. */
function Announcements({ league, isCommissioner }: { league: League; isCommissioner: boolean }) {
  const { state, postAnnouncement } = useStore()
  const [draft, setDraft] = useState('')
  const [showAll, setShowAll] = useState(false)
  const latest = league.announcements.slice().reverse()
  if (latest.length === 0 && !isCommissioner) return null
  const visible = showAll ? latest : latest.slice(0, 1)
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ color: 'var(--gold)' }}><Icon name="send" size={16} /></span>
        <strong className="grow">League news</strong>
        {latest.length > 1 && (
          <button className="btn small ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Latest only' : `All ${latest.length}`}
          </button>
        )}
      </div>
      {visible.map((a) => {
        const author = state.users.find((u) => u.id === a.authorId)
        return (
          <div key={a.id} style={{ marginTop: 10 }}>
            <div className="muted" style={{ fontSize: 14 }}>{a.text}</div>
            <div className="faint" style={{ marginTop: 3 }}>@{author?.username} · {formatWhen(a.at)}</div>
          </div>
        )
      })}
      {latest.length === 0 && <p className="faint" style={{ margin: '8px 0 0' }}>Nothing yet. Say something.</p>}
      {isCommissioner && (
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <input
            value={draft}
            placeholder="Post an announcement…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                postAnnouncement(league.id, draft)
                setDraft('')
              }
            }}
          />
          <button
            className="btn primary small"
            disabled={!draft.trim()}
            onClick={() => {
              postAnnouncement(league.id, draft)
              setDraft('')
            }}
          >
            Post
          </button>
        </div>
      )}
    </div>
  )
}

/** A glanceable visual read on the season: goals, result split, and leaders. */
function SeasonStatsPanel({ league }: { league: League }) {
  const { state } = useStore()
  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const stats = leagueSeasonStats(league, teams, state.matches)
  if (stats.played === 0) return null
  const name = (id?: string) => teams.find((t) => t.id === id)?.name ?? '—'
  const logo = (id?: string) => teams.find((t) => t.id === id)

  const leaders = [
    stats.topAttack && { icon: '⚔️', title: 'Top attack', teamId: stats.topAttack.teamId, value: `${stats.topAttack.value} scored` },
    stats.bestDefense && { icon: '🛡️', title: 'Best defense', teamId: stats.bestDefense.teamId, value: `${stats.bestDefense.value} conceded` },
    stats.mostWins && { icon: '🔥', title: 'Most wins', teamId: stats.mostWins.teamId, value: `${stats.mostWins.value} wins` },
  ].filter(Boolean) as { icon: string; title: string; teamId: string; value: string }[]

  return (
    <>
      <h2>Season stats</h2>
      <div className="card">
        <Donut
          size={128}
          centerTop={String(stats.goals)}
          centerBottom="goals"
          segments={[
            { label: 'Home wins', value: stats.results.homeWins, color: 'var(--volt)' },
            { label: 'Away wins', value: stats.results.awayWins, color: 'var(--blue)' },
            { label: 'Draws', value: stats.results.draws, color: 'var(--faint)' },
          ]}
        />
        <div className="statchips" style={{ marginTop: 14 }}>
          <div className="statchip"><div className="v">{stats.played}</div><div className="k">Played</div></div>
          <div className="statchip"><div className="v">{stats.goals}</div><div className="k">Goals</div></div>
          <div className="statchip"><div className="v">{stats.avgGoals}</div><div className="k">Avg / game</div></div>
        </div>
      </div>

      {stats.goalsByRound.length > 1 && (
        <div className="card">
          <strong className="grow" style={{ display: 'block', marginBottom: 10 }}>Goals by round</strong>
          <Bars data={stats.goalsByRound.map((r) => ({ label: `R${r.round}`, value: r.goals }))} />
        </div>
      )}

      {leaders.length > 0 && (
        <div className="card">
          {leaders.map((l, i) => {
            const t = logo(l.teamId)
            return (
              <div className="person" key={i}>
                <span className="honoricon" aria-hidden>{l.icon}</span>
                <div className="grow">
                  <strong>{l.title}</strong>
                  <div className="faint">{name(l.teamId)} · {l.value}</div>
                </div>
                {t && <TeamLogo team={t} size={28} />}
              </div>
            )
          })}
        </div>
      )}

      {(stats.biggestWin || stats.highestScoring) && (
        <div className="card">
          {stats.biggestWin && (
            <Link to={`/match/${stats.biggestWin.matchId}`} className="person" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="honoricon" aria-hidden>💥</span>
              <div className="grow">
                <strong>Biggest win</strong>
                <div className="faint">{name(stats.biggestWin.homeTeamId)} {stats.biggestWin.homeScore}–{stats.biggestWin.awayScore} {name(stats.biggestWin.awayTeamId)}</div>
              </div>
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
          {stats.highestScoring && stats.highestScoring.matchId !== stats.biggestWin?.matchId && (
            <Link to={`/match/${stats.highestScoring.matchId}`} className="person" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="honoricon" aria-hidden>🎆</span>
              <div className="grow">
                <strong>Goal fest</strong>
                <div className="faint">{name(stats.highestScoring.homeTeamId)} {stats.highestScoring.homeScore}–{stats.highestScoring.awayScore} {name(stats.highestScoring.awayTeamId)} · {stats.highestScoring.total} goals</div>
              </div>
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Past seasons live right under the current table — champions, table
 * leaders, and final standings, collapsed by default so they never crowd
 * the live season.
 */
function PastSeasons({ league }: { league: League }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const teamOf = (id?: string) => teams.find((t) => t.id === id)
  const records = league.seasons.slice().reverse()
  if (records.length === 0) return null
  return (
    <>
      <button
        className="row"
        style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: '18px 2px 6px', gap: 8 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span style={{ color: 'var(--gold)' }}><Icon name="scroll" size={16} /></span>
        <strong className="grow" style={{ textAlign: 'left', fontSize: 15 }}>
          Past seasons ({records.length})
        </strong>
        <span style={{ color: 'var(--faint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          <Icon name="chevronRight" size={16} />
        </span>
      </button>
      {open && records.map((rec) => <SeasonCard key={rec.season} record={rec} teamOf={teamOf} />)}
    </>
  )
}

function SeasonCard({ record, teamOf }: { record: SeasonRecord; teamOf: (id?: string) => Team | undefined }) {
  const champ = teamOf(record.championTeamId)
  const leader = teamOf(record.tableLeaderTeamId)
  const played = record.table.filter((r) => r.played > 0)
  const topAttack = played.length ? played.reduce((a, b) => (b.goalsFor > a.goalsFor ? b : a)) : undefined
  const bestDefense = played.length ? played.reduce((a, b) => (b.goalsAgainst < a.goalsAgainst ? b : a)) : undefined
  return (
    <div className="card">
      <div className="row" style={{ gap: 8 }}>
        <span className="honoricon"><Icon name="scroll" size={17} /></span>
        <div className="grow">
          <strong>Season {record.season}</strong>
          <div className="faint">archived {new Date(record.endedAt).toLocaleDateString()}</div>
        </div>
        {champ && <TeamLogo team={champ} size={30} />}
      </div>
      {(champ || leader) && (
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {champ && <Badge kind="pending">🏆 Champions: {champ.name}</Badge>}
          {leader && leader.id !== champ?.id && <Badge kind="volt">Table leaders: {leader.name}</Badge>}
        </div>
      )}
      {(topAttack || bestDefense) && (
        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {topAttack && <Badge kind="neutral">⚔️ Top attack: {teamOf(topAttack.teamId)?.name} ({topAttack.goalsFor})</Badge>}
          {bestDefense && <Badge kind="neutral">🛡️ Best defense: {teamOf(bestDefense.teamId)?.name} ({bestDefense.goalsAgainst})</Badge>}
        </div>
      )}
      {record.table.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {record.table.slice(0, 5).map((r, i) => {
            const team = teamOf(r.teamId)
            if (!team) return null
            return (
              <div className="pr-row" key={r.teamId}>
                <span className="pr-rank">{i + 1}</span>
                <TeamLogo team={team} size={22} />
                <span className="grow truncate" style={{ fontWeight: 700, fontSize: 13 }}>{team.name}</span>
                <span className="faint num">{r.played}P {r.goalDifference >= 0 ? '+' : ''}{r.goalDifference}GD</span>
                <span className="pr-rating num">{r.points}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


/**
 * Adaptive commissioner checklist: derived entirely from live league state,
 * collapses once the league is fully operational.
 */
function SetupChecklist({ league }: { league: League }) {
  const { state } = useStore()
  const [open, setOpen] = useState(true)
  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const official = teams.filter((t) => t.status === 'official')
  const matches = state.matches.filter((m) => m.leagueId === league.id && (m.season ?? 1) === league.currentSeason)
  const verified = matches.filter((m) => m.status === 'official')
  const disputes = matches.filter((m) => m.status === 'disputed')

  const steps: { label: string; done: boolean; hint: string }[] = [
    { label: 'League created', done: true, hint: 'Adjust rules anytime in Settings.' },
    { label: 'Share the join code', done: teams.length > 0, hint: 'Captains enter it (Teams tab) to bring their team in.' },
    {
      label: `${Math.max(2, league.minTeams)} teams registered`,
      done: official.length >= Math.max(2, league.minTeams),
      hint: `${official.length} in so far — you need ${Math.max(2, league.minTeams)} to kick off.`,
    },
    { label: 'Season launched', done: matches.length > 0, hint: 'Hit Launch Season on the Matches tab.' },
    { label: 'First verified result', done: verified.length > 0, hint: 'Captains submit, opponents confirm.' },
    { label: 'No open disputes', done: disputes.length === 0, hint: disputes.length > 0 ? `${disputes.length} waiting on your ruling.` : '' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button
        className="row"
        style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, gap: 8 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span style={{ color: 'var(--volt)' }}><Icon name="check" size={16} /></span>
        <strong className="grow" style={{ textAlign: 'left' }}>League setup - {doneCount}/{steps.length}</strong>
        <Icon name="chevronRight" size={15} />
      </button>
      <div className="progress" style={{ marginTop: 10 }}>
        <div className="fill" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          {steps.map((s, i) => (
            <div className="row" key={i} style={{ padding: '7px 0', alignItems: 'flex-start' }}>
              <span style={{ color: s.done ? 'var(--green)' : 'var(--faint)', marginTop: 2 }}>
                <Icon name={s.done ? 'check' : 'clock'} size={15} />
              </span>
              <span className="grow">
                <span style={{ fontWeight: 700, fontSize: 13.5, textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>
                  {s.label}
                </span>
                {!s.done && <span className="faint" style={{ display: 'block' }}>{s.hint}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
