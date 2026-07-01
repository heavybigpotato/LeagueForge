import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import type { EvidenceKind } from '../core/types'
import { EmptyState, TeamLogo, formatDate, formatTime, formatWhen } from './components'
import { MatchBadge } from './LeagueScreen'
import { Icon } from './icons'

const EVIDENCE_KINDS: { kind: EvidenceKind; label: string; icon: string }[] = [
  { kind: 'photo', label: 'Photo', icon: 'camera' },
  { kind: 'video', label: 'Video', icon: 'eye' },
  { kind: 'score-sheet', label: 'Score sheet', icon: 'scroll' },
  { kind: 'referee-report', label: 'Referee report', icon: 'whistle' },
  { kind: 'witness', label: 'Witness', icon: 'user' },
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
  if (!match) return <EmptyState icon="alert">Match not found.</EmptyState>
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
      <Link to={`/league/${league.id}`} className="backlink"><Icon name="arrowLeft" size={15} /> {league.name}</Link>

      <div className="card flush fixture" style={{ marginTop: 12 }}>
        <div className="fixture-top">
          <span>Round {match.round}</span>
          <span>·</span>
          <span>{formatDate(match.scheduledAt)}, {formatTime(match.scheduledAt)}</span>
          <span>·</span>
          <span className="truncate">{match.venue}</span>
          <span className="grow" />
          <MatchBadge status={match.status} />
        </div>
        <div className="scoreline" style={{ padding: '20px 12px' }}>
          <div className="team"><TeamLogo team={home} size={50} />{home.name}</div>
          <div className="score num" style={{ fontSize: 38 }}>
            {score ? <>{score.homeScore}<span className="dash">–</span>{score.awayScore}</> : <span className="vs">VS</span>}
          </div>
          <div className="team"><TeamLogo team={away} size={50} />{away.name}</div>
        </div>
        {match.status === 'awaiting-confirmation' && (
          <div className="statusnote">
            <Icon name="clock" size={14} />
            Submitted by {submittedBy === home.id ? home.name : away.name} — waiting for the opposing captain. Standings are not affected yet.
          </div>
        )}
        {match.status === 'disputed' && (
          <div className="statusnote" style={{ color: 'var(--red)' }}>
            <Icon name="alert" size={14} />
            Disputed: “{match.disputeReason}”. Standings frozen; commissioner notified; evidence requested.
          </div>
        )}
        {match.result && (
          <div className="statusnote" style={{ color: 'var(--green)' }}>
            <Icon name="shieldCheck" size={14} />
            Verified by {match.result.verifiedBy} · {formatWhen(match.result.verifiedAt)}
          </div>
        )}
      </div>

      {match.status === 'scheduled' && myTeam && !checkedIn && (
        <button className="btn" onClick={() => store.checkIn(match.id, myTeam.id)}>
          <Icon name="qr" size={16} /> QR Check-in <span style={{ color: 'var(--faint)', fontWeight: 600 }}>(GPS validated)</span>
        </button>
      )}
      {match.checkIns.length > 0 && (
        <p className="faint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="mapPin" size={13} /> {match.checkIns.length} player{match.checkIns.length === 1 ? '' : 's'} checked in
        </p>
      )}

      {match.status === 'scheduled' && isCaptainOfMine && (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--volt)' }}><Icon name="send" size={16} /></span>
            <strong>Submit final score</strong>
          </div>
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
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--blue)' }}><Icon name="whistle" size={16} /></span>
            <strong>Respond to submitted score</strong>
          </div>
          <p className="faint">Confirming makes the result official and updates the standings immediately.</p>
          <button className="btn primary" onClick={() => store.confirmScore(match.id)}>
            <Icon name="check" size={16} /> Confirm result
          </button>
          <label className="field" style={{ marginTop: 14 }}>
            <span>Dispute reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What actually happened?" />
          </label>
          <button className="btn danger" onClick={() => store.disputeScore(match.id, reason)}>
            <Icon name="alert" size={15} /> Dispute
          </button>
        </div>
      )}

      {match.status === 'disputed' && (isCommissioner || isReferee) && (
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--gold)' }}><Icon name="shield" size={16} /></span>
            <strong>{isCommissioner ? 'Commissioner' : 'Referee'} resolution</strong>
          </div>
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
        const meta = EVIDENCE_KINDS.find((k) => k.kind === ev.kind)
        return (
          <div className="card" key={ev.id}>
            <div className="row">
              <span className="row" style={{ gap: 7, color: 'var(--blue)', fontWeight: 700, fontSize: 13 }}>
                <Icon name={meta?.icon ?? 'camera'} size={15} /> {meta?.label ?? ev.kind}
              </span>
              <span className="grow" />
              <span className="faint">{formatWhen(ev.at)}</span>
            </div>
            <div className="muted" style={{ marginTop: 7 }}>{ev.note}</div>
            <div className="faint" style={{ marginTop: 4 }}>by @{u?.username}</div>
          </div>
        )
      })}
      {(myTeam || isCommissioner || isReferee) && match.status !== 'official' && (
        <div className="card">
          <strong>Add evidence</strong>
          <div className="fieldgrid" style={{ marginTop: 10 }}>
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
            <Icon name="plus" size={15} /> Upload
          </button>
        </div>
      )}
    </div>
  )
}
