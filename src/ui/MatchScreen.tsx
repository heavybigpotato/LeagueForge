import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import type { EvidenceKind } from '../core/types'
import { EmptyState, TeamLogo, formatDate, formatWhen } from './components'
import { MatchBadge } from './LeagueScreen'

const EVIDENCE_KINDS: { kind: EvidenceKind; label: string }[] = [
  { kind: 'photo', label: '📷 Photo' },
  { kind: 'video', label: '🎬 Video' },
  { kind: 'score-sheet', label: '📄 Score sheet' },
  { kind: 'referee-report', label: '🧑‍⚖️ Referee report' },
  { kind: 'witness', label: '🙋 Witness' },
]

export function MatchScreen() {
  const { matchId } = useParams()
  const store = useStore()
  const { state, currentUser } = store
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [kind, setKind] = useState<EvidenceKind>('photo')

  const match = state.matches.find((m) => m.id === matchId)
  if (!match) return <EmptyState icon="❓">Match not found.</EmptyState>
  const league = state.leagues.find((l) => l.id === match.leagueId)!
  const home = state.teams.find((t) => t.id === match.homeTeamId)!
  const away = state.teams.find((t) => t.id === match.awayTeamId)!

  const myTeam = [home, away].find((t) => t.memberIds.includes(currentUser.id))
  const isCaptainOfMine = myTeam?.captainId === currentUser.id
  const submittedBy = match.submission?.submittedByTeamId
  const isOpposingCaptain = isCaptainOfMine && myTeam && myTeam.id !== submittedBy
  const isCommissioner = currentUser.id === league.commissionerId
  const isReferee = league.refereeIds.includes(currentUser.id)
  const checkedIn = match.checkIns.some((c) => c.userId === currentUser.id)
  const score = match.result ?? match.submission

  return (
    <div>
      <Link to={`/league/${league.id}`} className="backlink">← {league.name}</Link>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <span className="faint">Round {match.round} · {formatDate(match.scheduledAt)} · {match.venue}</span>
          <span className="grow" />
          <MatchBadge status={match.status} />
        </div>
        <div className="scoreline">
          <div className="team"><TeamLogo team={home} size={44} />{home.name}</div>
          <div className="score">
            {score ? <>{score.homeScore}<span className="dash">–</span>{score.awayScore}</> : <span className="dash">vs</span>}
          </div>
          <div className="team"><TeamLogo team={away} size={44} />{away.name}</div>
        </div>
        {match.status === 'awaiting-confirmation' && (
          <p className="faint" style={{ textAlign: 'center' }}>
            Submitted by {submittedBy === home.id ? home.name : away.name} — waiting for the opposing captain. Standings are not affected yet.
          </p>
        )}
        {match.status === 'disputed' && (
          <p className="faint" style={{ textAlign: 'center' }}>
            ⚠️ Disputed: “{match.disputeReason}”. Standings frozen; commissioner notified; evidence requested.
          </p>
        )}
        {match.result && (
          <p className="faint" style={{ textAlign: 'center' }}>
            ✓ Verified by {match.result.verifiedBy} · {formatWhen(match.result.verifiedAt)}
          </p>
        )}
      </div>

      {match.status === 'scheduled' && myTeam && !checkedIn && (
        <button className="btn" onClick={() => store.checkIn(match.id, myTeam.id)}>
          📍 QR Check-in (GPS validated)
        </button>
      )}
      {match.checkIns.length > 0 && (
        <p className="faint">
          {match.checkIns.length} player{match.checkIns.length === 1 ? '' : 's'} checked in
        </p>
      )}

      {match.status === 'scheduled' && isCaptainOfMine && (
        <div className="card">
          <strong>Submit final score</strong>
          <p className="faint">The opposing captain must confirm before this result becomes official.</p>
          <div className="fieldgrid">
            <label className="field">
              <span>{home.name}</span>
              <input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>{away.name}</span>
              <input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(Number(e.target.value))} />
            </label>
          </div>
          <button className="btn primary" onClick={() => store.submitScore(match.id, homeScore, awayScore)}>
            Submit for verification
          </button>
        </div>
      )}

      {match.status === 'awaiting-confirmation' && isOpposingCaptain && (
        <div className="card">
          <strong>Respond to submitted score</strong>
          <div className="btnrow">
            <button className="btn primary" onClick={() => store.confirmScore(match.id)}>✓ Confirm</button>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Dispute reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What actually happened?" />
          </label>
          <button className="btn danger" onClick={() => store.disputeScore(match.id, reason)}>⚠ Dispute</button>
        </div>
      )}

      {match.status === 'disputed' && (isCommissioner || isReferee) && (
        <div className="card">
          <strong>{isCommissioner ? 'Commissioner' : 'Referee'} resolution</strong>
          <p className="faint">Review the evidence below and enter the final, official score.</p>
          <div className="fieldgrid">
            <label className="field">
              <span>{home.name}</span>
              <input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>{away.name}</span>
              <input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(Number(e.target.value))} />
            </label>
          </div>
          <button className="btn primary" onClick={() => store.resolveDispute(match.id, homeScore, awayScore)}>
            Record official result
          </button>
        </div>
      )}

      <h2>Evidence ({match.evidence.length})</h2>
      {match.evidence.length === 0 && <p className="faint">No evidence uploaded yet.</p>}
      {match.evidence.map((ev) => {
        const u = state.users.find((x) => x.id === ev.uploadedBy)
        return (
          <div className="card" key={ev.id}>
            <div className="row">
              <span>{EVIDENCE_KINDS.find((k) => k.kind === ev.kind)?.label ?? ev.kind}</span>
              <span className="grow" />
              <span className="faint">{formatWhen(ev.at)}</span>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>{ev.note}</div>
            <div className="faint" style={{ marginTop: 4 }}>by @{u?.username}</div>
          </div>
        )
      })}
      {(myTeam || isCommissioner || isReferee) && match.status !== 'official' && (
        <div className="card">
          <strong>Add evidence</strong>
          <div className="fieldgrid" style={{ marginTop: 8 }}>
            <label className="field">
              <span>Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)}>
                {EVIDENCE_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>{k.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Note</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe the evidence" />
            </label>
          </div>
          <button className="btn" onClick={() => { store.addEvidence(match.id, kind, note); setNote('') }}>
            Upload
          </button>
        </div>
      )}
    </div>
  )
}
