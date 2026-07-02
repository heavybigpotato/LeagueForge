import type { League, Match, StandingRow, Team } from './types'

/**
 * Standings are derived purely from OFFICIAL (verified) matches of OFFICIAL
 * teams. Pending teams and unverified scores can never influence the table.
 */
export function computeStandings(league: League, teams: Team[], matches: Match[]): StandingRow[] {
  const official = teams.filter((t) => t.leagueId === league.id && t.status === 'official')
  const rows = new Map<string, StandingRow>(
    official.map((t) => [
      t.id,
      { teamId: t.id, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, winPct: 0 },
    ]),
  )

  const verified = matches.filter(
    (m) => m.leagueId === league.id && m.status === 'official' && m.result && m.stage !== 'playoff',
  )
  for (const m of verified) {
    const home = rows.get(m.homeTeamId)
    const away = rows.get(m.awayTeamId)
    if (!home || !away || !m.result) continue
    const { homeScore, awayScore } = m.result
    apply(home, homeScore, awayScore, league)
    apply(away, awayScore, homeScore, league)
  }

  for (const r of rows.values()) {
    r.goalDifference = r.goalsFor - r.goalsAgainst
    r.winPct = r.played === 0 ? 0 : Math.round((r.wins / r.played) * 1000) / 10
  }

  return [...rows.values()].sort((a, b) => compareRows(a, b, league, verified))
}

function apply(row: StandingRow, scored: number, conceded: number, league: League) {
  row.played += 1
  row.goalsFor += scored
  row.goalsAgainst += conceded
  if (scored > conceded) {
    row.wins += 1
    row.points += league.scoring.pointsForWin
  } else if (scored === conceded) {
    row.draws += 1
    row.points += league.scoring.pointsForDraw
  } else {
    row.losses += 1
    row.points += league.scoring.pointsForLoss
  }
}

function compareRows(a: StandingRow, b: StandingRow, league: League, verified: Match[]): number {
  if (b.points !== a.points) return b.points - a.points
  for (const tb of league.tieBreakers) {
    let d = 0
    switch (tb) {
      case 'goal-difference':
        d = b.goalDifference - a.goalDifference
        break
      case 'goals-for':
        d = b.goalsFor - a.goalsFor
        break
      case 'win-percentage':
        d = b.winPct - a.winPct
        break
      case 'head-to-head':
        d = headToHead(a.teamId, b.teamId, verified, league)
        break
    }
    if (d !== 0) return d
  }
  return 0
}

export type FormResult = 'W' | 'D' | 'L'

/** Last `limit` verified regular-season results for a team, oldest → newest. */
export function formGuide(teamId: string, matches: Match[], limit = 5): FormResult[] {
  return matches
    .filter(
      (m) =>
        m.status === 'official' && m.result && m.stage !== 'playoff' && (m.homeTeamId === teamId || m.awayTeamId === teamId),
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(-limit)
    .map((m) => {
      const isHome = m.homeTeamId === teamId
      const scored = isHome ? m.result!.homeScore : m.result!.awayScore
      const conceded = isHome ? m.result!.awayScore : m.result!.homeScore
      return scored > conceded ? 'W' : scored === conceded ? 'D' : 'L'
    })
}

/** Positive if b beat a on aggregate points in their direct meetings. */
function headToHead(aId: string, bId: string, verified: Match[], league: League): number {
  let aPts = 0
  let bPts = 0
  for (const m of verified) {
    if (!m.result) continue
    const pair =
      (m.homeTeamId === aId && m.awayTeamId === bId) || (m.homeTeamId === bId && m.awayTeamId === aId)
    if (!pair) continue
    const homeIsA = m.homeTeamId === aId
    const aScore = homeIsA ? m.result.homeScore : m.result.awayScore
    const bScore = homeIsA ? m.result.awayScore : m.result.homeScore
    if (aScore > bScore) aPts += league.scoring.pointsForWin
    else if (bScore > aScore) bPts += league.scoring.pointsForWin
    else {
      aPts += league.scoring.pointsForDraw
      bPts += league.scoring.pointsForDraw
    }
  }
  return bPts - aPts
}
