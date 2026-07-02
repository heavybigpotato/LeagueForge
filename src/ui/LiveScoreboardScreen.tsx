import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import type { Team } from '../core/types'
import { EmptyState, TeamLogo } from './components'
import { Icon, bestText } from './icons'

/**
 * Match Day Live — a full-screen courtside scoreboard. A competing captain
 * keeps score in real time (big tap targets, running clock, undo), and when
 * the final whistle goes the result is handed straight to the verification
 * pipeline: nothing touches the standings until the opposing captain
 * confirms. Scorekeeping that looks like a stadium, honesty built in.
 */
export function LiveScoreboardScreen() {
  const { matchId } = useParams()
  const store = useStore()
  const navigate = useNavigate()
  const { state, currentUser } = store

  const [home, setHome] = useState(0)
  const [away, setAway] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (running) {
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    }
    return () => clearInterval(timer.current)
  }, [running])

  const match = state.matches.find((m) => m.id === matchId)
  if (!match) return <EmptyState icon="alert">Match not found.</EmptyState>
  const homeTeam = state.teams.find((t) => t.id === match.homeTeamId)!
  const awayTeam = state.teams.find((t) => t.id === match.awayTeamId)!
  const isCompetingCaptain = [homeTeam, awayTeam].some((t) => t.captainId === currentUser.id)

  if (match.status !== 'scheduled' || !isCompetingCaptain) {
    return (
      <EmptyState icon="gauge">
        The live scoreboard is available to competing captains before a score has been submitted.
        <div style={{ marginTop: 14 }}>
          <Link to={`/match/${match.id}`} className="btn small" style={{ textDecoration: 'none' }}>Back to match</Link>
        </div>
      </EmptyState>
    )
  }

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  const finish = () => {
    store.submitScore(match.id, home, away)
    navigate(`/match/${match.id}`)
  }

  return (
    <div className="live">
      <div className="live-top">
        <Link to={`/match/${match.id}`} className="backlink"><Icon name="arrowLeft" size={15} /> Exit</Link>
        <span className="badge volt">● Match Day Live</span>
      </div>

      <div className="live-clock num" onClick={() => setRunning((r) => !r)} role="button" aria-label="toggle clock">
        {clock}
        <span className="live-clock-hint">{running ? 'tap to pause' : 'tap to start'}</span>
      </div>

      <div className="live-board">
        <LiveSide team={homeTeam} goals={home} onGoal={() => setHome((n) => n + 1)} onUndo={() => setHome((n) => Math.max(0, n - 1))} />
        <div className="live-dash num">–</div>
        <LiveSide team={awayTeam} goals={away} onGoal={() => setAway((n) => n + 1)} onUndo={() => setAway((n) => Math.max(0, n - 1))} />
      </div>

      <p className="faint" style={{ textAlign: 'center' }}>
        {match.venue} · the final score goes to the opposing captain for confirmation — the live board never edits standings directly.
      </p>
      <button className="btn primary" onClick={finish}>
        <Icon name="whistle" size={17} /> Full time — submit {home}–{away} for verification
      </button>
    </div>
  )
}

function LiveSide({ team, goals, onGoal, onUndo }: { team: Team; goals: number; onGoal: () => void; onUndo: () => void }) {
  return (
    <div className="live-side">
      <TeamLogo team={team} size={54} />
      <div className="live-name truncate">{team.name}</div>
      <div className="live-score num">{goals}</div>
      <button
        className="live-goal"
        style={{ background: team.primaryColor, color: bestText(team.primaryColor) }}
        onClick={onGoal}
        aria-label={`goal for ${team.name}`}
      >
        <Icon name="plus" size={26} />
      </button>
      <button className="live-undo" onClick={onUndo} disabled={goals === 0}>
        undo
      </button>
    </div>
  )
}
