import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { bracket, cupStarted, isValidCupSize, winnerOf } from '../core/knockout'
import type { BracketSlot } from '../core/knockout'
import type { League, Team } from '../core/types'
import { RosterProgress, TeamLogo } from './components'
import { Crest, Icon } from './icons'
import { MatchBadge } from './LeagueScreen'

/**
 * Shared "kick it off" card. A season doesn't start on its own — the
 * commissioner launches it once enough teams have registered AND everyone
 * has reached the roster minimum. Used by both the league Matches tab and
 * the cup Bracket tab.
 */
export function LaunchCard({ league }: { league: League }) {
  const { state, currentUser, launchSeason, leaveLeague } = useStore()
  const isCommissioner = currentUser.id === league.commissionerId
  const isCup = league.scheduleFormat === 'knockout'
  const registered = state.teams.filter((t) => t.leagueId === league.id)
  const ready = registered.filter((t) => t.status === 'official')
  const recruiting = registered.filter((t) => t.status !== 'official')
  const minTeams = Math.max(2, league.minTeams)

  const enoughReady = ready.length >= minTeams
  const allReady = recruiting.length === 0
  const cupOk = !isCup || isValidCupSize(ready.length)
  const canLaunch = enoughReady && allReady && cupOk
  const reason = !enoughReady
    ? `${ready.length} of ${minTeams} teams ready`
    : !allReady
      ? `${recruiting.length} team${recruiting.length === 1 ? '' : 's'} still recruiting`
      : !cupOk
        ? `A cup needs 2, 4, 8, or 16 teams — you have ${ready.length}`
        : ''

  return (
    <div>
      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <span style={{ color: 'var(--volt)' }}><Icon name={isCup ? 'trophy' : 'calendar'} size={17} /></span>
          <div className="grow">
            <strong>{isCup ? 'The cup hasn’t been drawn' : `Season ${league.currentSeason} hasn’t started`}</strong>
            <div className="faint">
              {registered.length} registered · {ready.length} ready
              {recruiting.length > 0 ? ` · ${recruiting.length} recruiting` : ''}
            </div>
          </div>
        </div>

        {registered.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {registered.map((t) => (
              <div className="person" key={t.id}>
                <TeamLogo team={t} size={30} />
                <div className="grow">
                  <strong className="truncate">{t.name}</strong>
                  {t.status === 'official' ? (
                    <div className="faint" style={{ color: 'var(--green)' }}>Ready · {t.memberIds.length} players</div>
                  ) : (
                    <div style={{ marginTop: 4 }}>
                      <RosterProgress current={t.memberIds.length} required={league.minPlayersPerTeam} />
                    </div>
                  )}
                </div>
                {isCommissioner && (
                  <button
                    className="btn small danger"
                    onClick={() => {
                      if (window.confirm(`Remove "${t.name}" from ${league.name}? They go back to being a free agent.`)) leaveLeague(t.id)
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isCommissioner ? (
          <>
            <button className="btn primary" style={{ marginTop: 12 }} disabled={!canLaunch} onClick={() => launchSeason(league.id)}>
              <Icon name={isCup ? 'trophy' : 'trophy'} size={16} /> {isCup ? 'Draw the cup' : `Launch Season ${league.currentSeason}`}
            </button>
            {!canLaunch && <p className="faint" style={{ margin: '10px 0 0', textAlign: 'center' }}>{reason}.</p>}
          </>
        ) : (
          <p className="faint" style={{ marginBottom: 0, marginTop: 12 }}>
            The commissioner {isCup ? 'draws the cup' : 'launches the season'} once every team is ready.
          </p>
        )}
      </div>
      {isCommissioner && canLaunch && (
        <p className="faint" style={{ display: 'flex', gap: 8 }}>
          <Icon name="alert" size={14} />
          <span>{isCup ? 'Drawing' : 'Launching'} locks the team list and rosters for this season.</span>
        </p>
      )}
    </div>
  )
}

/** The Cup tab for a knockout league: the launch card, then the bracket. */
export function CupBracket({ league }: { league: League }) {
  const { state, currentUser, endSeason } = useStore()
  const teams = state.teams.filter((t) => t.leagueId === league.id)
  const isCommissioner = currentUser.id === league.commissionerId
  const drawn = cupStarted(league.id, state.matches, league.currentSeason)
  const b = drawn ? bracket(league.id, state.matches, league.currentSeason) : null

  if (!b) return <LaunchCard league={league} />

  return (
    <div>
      <ChampionCard league={league} teams={teams} championTeamId={b.championTeamId} />
      {b.championTeamId && isCommissioner && (
        <button className="btn primary" style={{ marginBottom: 12 }} onClick={() => endSeason(league.id)}>
          <Icon name="scroll" size={16} /> Crown champions &amp; archive Season {league.currentSeason}
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
      {m.status !== 'official' && <div className="tiestatus"><MatchBadge status={m.status} /></div>}
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
          <div className="kicker" style={{ color: 'var(--gold)' }}>Cup winners</div>
          <strong style={{ fontSize: 20, letterSpacing: '-0.02em' }}>{champ.name}</strong>
          <div className="faint">{league.name} · verified all the way to the trophy</div>
        </div>
        <span style={{ color: 'var(--gold)' }}><Icon name="trophy" size={30} /></span>
      </div>
    </div>
  )
}
