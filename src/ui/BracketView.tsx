import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { bracket, playoffsStarted, winnerOf } from '../core/playoffs'
import { evaluateSeasonAchievements } from '../core/achievements'
import { computeStandings } from '../core/standings'
import type { BracketSlot } from '../core/playoffs'
import type { League, Match, Team } from '../core/types'
import { Badge, EmptyState, TeamLogo } from './components'
import { Crest, Icon } from './icons'
import { MatchBadge } from './LeagueScreen'

export function PlayoffsTab({ league, embedded = false }: { league: League; embedded?: boolean }) {
  const { state, currentUser, startPlayoffs, endSeason } = useStore()
  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const leagueMatches = state.matches.filter((m) => m.leagueId === league.id && (m.season ?? 1) === league.currentSeason)
  const isCommissioner = currentUser.id === league.commissionerId
  const started = playoffsStarted(league.id, state.matches, league.currentSeason)
  const b = started ? bracket(league.id, state.matches, league.currentSeason) : null
  const official = teams.filter((t) => t.status === 'official')
  const regularDone = leagueMatches.filter((m) => m.stage !== 'playoff' && m.status !== 'official').length === 0

  // Embedded (inside the Matches tab) skips the "no bracket yet" empty state —
  // it only surfaces the commissioner's start action when the season is ready.
  return (
    <div>
      {!started && (!embedded || isCommissioner) && (
        <>
          {!embedded && <EmptyState icon="trophy">The bracket appears when the commissioner starts the playoffs.</EmptyState>}
          {isCommissioner && (
            <>
              {embedded && official.length >= 2 && <h2>Playoffs</h2>}
              {!regularDone && official.length >= 2 && (
                <p className="faint" style={{ textAlign: 'center' }}>
                  {leagueMatches.filter((m) => m.stage !== 'playoff' && m.status !== 'official').length} matches still open — seeding uses the table as it stands.
                </p>
              )}
              <button className="btn primary" onClick={() => startPlayoffs(league.id)} disabled={official.length < 2}>
                <Icon name="trophy" size={16} />{' '}
                {league.scheduleFormat === 'knockout'
                  ? 'Draw the cup bracket'
                  : `Start Playoffs (${Math.min(official.length, 4) >= 4 ? 'top 4' : 'top 2'} qualify)`}
              </button>
            </>
          )}
        </>
      )}

      {b && (
        <>
          <ChampionCard league={league} teams={teams} championTeamId={b.championTeamId} />
          {b.championTeamId && isCommissioner && (
            <button className="btn primary" style={{ marginBottom: 12 }} onClick={() => endSeason(league.id)}>
              <Icon name="scroll" size={16} /> End Season {league.currentSeason} &amp; archive to history
            </button>
          )}
          <div className="bracket">
            {b.rounds.map((round, i) => (
              <div className="roundcol" key={i}>
                <div className="roundname">{b.roundNames[i]}</div>
                <div className="roundslots">
                  {round.map((slot) => (
                    <TieCard key={`${slot.round}-${slot.slot}`} slot={slot} teams={teams} />
                  ))}
                </div>
              </div>
            ))}
            <div className="roundcol">
              <div className="roundname">Champion</div>
              <div className="roundslots">
                <ChampSlot teams={teams} championTeamId={b.championTeamId} />
              </div>
            </div>
          </div>
          <p className="faint">Winners advance as results are verified. No draws.</p>
        </>
      )}

      {(started || !embedded) && (
        <Honors league={league} teams={teams} matches={leagueMatches} championTeamId={b?.championTeamId} />
      )}
    </div>
  )
}

function TieCard({ slot, teams }: { slot: BracketSlot; teams: Team[] }) {
  const m = slot.match
  if (!m) {
    return (
      <div className="tie tbd">
        <div className="side"><span className="tbdmark">?</span><span className="grow faint">Winner of earlier tie</span></div>
        <div className="side"><span className="tbdmark">?</span><span className="grow faint">Winner of earlier tie</span></div>
      </div>
    )
  }
  const home = teams.find((t) => t.id === m.homeTeamId)
  const away = teams.find((t) => t.id === m.awayTeamId)
  if (!home || !away) return null
  const win = winnerOf(m)
  const score = m.result ?? m.submission
  return (
    <Link to={`/match/${m.id}`} className="tie live">
      <Side team={home} goals={score?.homeScore} winner={win === home.id} decided={!!win} />
      <Side team={away} goals={score?.awayScore} winner={win === away.id} decided={!!win} />
      {m.status !== 'official' && (
        <div className="tiestatus"><MatchBadge status={m.status} /></div>
      )}
    </Link>
  )
}

function Side({ team, goals, winner, decided }: { team: Team; goals?: number; winner: boolean; decided: boolean }) {
  return (
    <div className={`side${winner ? ' winner' : decided ? ' loser' : ''}`}>
      <TeamLogo team={team} size={22} />
      <span className="grow truncate">{team.name}</span>
      <span className="goals num">{goals ?? ''}</span>
    </div>
  )
}

function ChampSlot({ teams, championTeamId }: { teams: Team[]; championTeamId?: string }) {
  const champ = teams.find((t) => t.id === championTeamId)
  return (
    <div className={`tie champslot${champ ? ' crowned' : ' tbd'}`}>
      <div className="side" style={{ justifyContent: 'center', gap: 10 }}>
        {champ ? (
          <>
            <Crest team={champ} size={26} />
            <strong>{champ.name}</strong>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--gold)' }}><Icon name="trophy" size={18} /></span>
            <span className="faint">To be decided</span>
          </>
        )}
      </div>
    </div>
  )
}

function ChampionCard({ league, teams, championTeamId }: { league: League; teams: Team[]; championTeamId?: string }) {
  const champ = teams.find((t) => t.id === championTeamId)
  if (!champ) return null
  return (
    <div className="champion">
      <div className="row" style={{ gap: 14, position: 'relative' }}>
        <Crest team={champ} size={56} />
        <div className="grow">
          <div className="kicker" style={{ color: 'var(--gold)' }}>League champions</div>
          <strong style={{ fontSize: 20, letterSpacing: '-0.02em' }}>{champ.name}</strong>
          <div className="faint">{league.name} · verified all the way to the trophy</div>
        </div>
        <span style={{ color: 'var(--gold)' }}><Icon name="trophy" size={30} /></span>
      </div>
    </div>
  )
}

function Honors({ league, teams, matches, championTeamId }: { league: League; teams: Team[]; matches: Match[]; championTeamId?: string }) {
  const { state } = useStore()
  const awards = evaluateSeasonAchievements(league, teams, matches)
  const table = computeStandings(league, teams, state.matches)
  const items: { icon: string; title: string; teamId: string; sub: string; rare?: boolean }[] = []
  if (championTeamId) {
    items.push({ icon: 'trophy', title: 'Playoff Champions', teamId: championTeamId, sub: 'Won the playoff final' })
  }
  for (const a of awards) {
    if (a.key === 'champion' && table.length > 0) {
      items.push({ icon: 'flame', title: 'Regular Season Winners', teamId: a.teamId, sub: 'Topped the verified table' })
    } else if (a.key !== 'champion') {
      items.push({ icon: a.key === 'perfect-season' ? 'sparkle' : 'shieldCheck', title: a.title, teamId: a.teamId, sub: a.description, rare: a.rare })
    }
  }
  if (items.length === 0) return null
  return (
    <>
      <h2>Season honors</h2>
      <div className="card">
        {items.map((it, i) => {
          const team = teams.find((t) => t.id === it.teamId)
          if (!team) return null
          return (
            <div className="person" key={i}>
              <span className="honoricon"><Icon name={it.icon} size={18} /></span>
              <div className="grow">
                <div className="row" style={{ gap: 7 }}>
                  <strong>{it.title}</strong>
                  {it.rare && <Badge kind="pending">Rare</Badge>}
                </div>
                <div className="faint">{team.name} · {it.sub}</div>
              </div>
              <TeamLogo team={team} size={28} />
            </div>
          )
        })}
      </div>
    </>
  )
}
