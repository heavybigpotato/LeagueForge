import type { League, Match, StandingRow, Team } from '../core/types'
import { bestText, monogram, shade } from './icons'

/**
 * Shareable graphics: every verified result and every standings update can
 * be exported as a polished 1080×1350 card and dropped straight into the
 * group chat or a story. The card is rendered on a canvas (crests included)
 * and handed to the native share sheet; if sharing isn't available it
 * downloads instead. Every share carries the LeagueForge mark.
 */

const W = 1080
const H = 1350

export async function shareResultCard(league: League, match: Match, home: Team, away: Team): Promise<boolean> {
  const c = canvas()
  const ctx = c.getContext('2d')!
  background(ctx)
  header(ctx, league.name, 'FULL TIME · VERIFIED RESULT')

  drawCrest(ctx, home, W / 2 - 300, 560, 120)
  drawCrest(ctx, away, W / 2 + 300, 560, 120)
  teamName(ctx, home.name, W / 2 - 300, 760)
  teamName(ctx, away.name, W / 2 + 300, 760)

  const result = match.result ?? match.submission
  ctx.fillStyle = '#f2f4f7'
  ctx.font = '800 220px "Outfit Variable", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${result?.homeScore ?? 0}–${result?.awayScore ?? 0}`, W / 2, 640)

  ctx.fillStyle = '#9aa4b2'
  ctx.font = '600 40px "Outfit Variable", sans-serif'
  const when = new Date(match.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  ctx.fillText(`${when} · ${match.venue}`, W / 2, 880)

  if (match.result) {
    pill(ctx, W / 2, 970, `✓ verified by ${match.result.verifiedBy}`, '#45d483')
  }
  footer(ctx)
  return deliver(c, `${home.name}-vs-${away.name}.png`)
}

export async function shareStandingsCard(league: League, rows: StandingRow[], teams: Team[]): Promise<boolean> {
  const c = canvas()
  const ctx = c.getContext('2d')!
  background(ctx)
  header(ctx, league.name, 'LEAGUE STANDINGS')

  const top = rows.slice(0, 6)
  const startY = 420
  const rowH = 130
  ctx.textAlign = 'left'
  top.forEach((r, i) => {
    const team = teams.find((t) => t.id === r.teamId)
    if (!team) return
    const y = startY + i * rowH
    if (i === 0) {
      ctx.fillStyle = 'rgba(201,245,66,0.08)'
      roundRect(ctx, 60, y - 62, W - 120, rowH - 12, 24)
      ctx.fill()
    }
    ctx.fillStyle = i === 0 ? '#c9f542' : '#5f6a79'
    ctx.font = '800 44px "Outfit Variable", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(String(i + 1), 96, y + 16)
    drawCrest(ctx, team, 210, y, 44)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f2f4f7'
    ctx.font = '700 46px "Outfit Variable", sans-serif'
    ctx.fillText(clip(ctx, team.name, 440), 300, y + 16)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#9aa4b2'
    ctx.font = '600 40px "Outfit Variable", sans-serif'
    ctx.fillText(`${r.played}P  ${r.goalDifference >= 0 ? '+' : ''}${r.goalDifference}GD`, W - 260, y + 16)
    ctx.fillStyle = '#c9f542'
    ctx.font = '800 52px "Outfit Variable", sans-serif'
    ctx.fillText(String(r.points), W - 96, y + 18)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = '#5f6a79'
  ctx.font = '600 34px "Outfit Variable", sans-serif'
  ctx.fillText('Only verified results count', W / 2, startY + top.length * rowH + 40)
  footer(ctx)
  return deliver(c, `${league.name}-standings.png`)
}

// ---------------------------------------------------------------- drawing

function canvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return c
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#10141a')
  g.addColorStop(1, '#0b0d10')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, 700)
  glow.addColorStop(0, 'rgba(201,245,66,0.10)')
  glow.addColorStop(1, 'rgba(201,245,66,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
}

function header(ctx: CanvasRenderingContext2D, leagueName: string, kicker: string) {
  ctx.textAlign = 'center'
  ctx.fillStyle = '#c9f542'
  ctx.font = '800 36px "Outfit Variable", sans-serif'
  ctx.fillText(kicker, W / 2, 170)
  ctx.fillStyle = '#f2f4f7'
  ctx.font = '800 72px "Outfit Variable", sans-serif'
  ctx.fillText(clip(ctx, leagueName, W - 160), W / 2, 260)
}

function footer(ctx: CanvasRenderingContext2D) {
  // brand pennant
  const x = W / 2 - 130
  const y = H - 130
  ctx.save()
  ctx.translate(x, y - 34)
  ctx.scale(1.6, 1.6)
  const g = ctx.createLinearGradient(0, 0, 32, 32)
  g.addColorStop(0, '#d8fb54')
  g.addColorStop(1, '#8fc025')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(6, 3)
  ctx.lineTo(26, 3)
  ctx.quadraticCurveTo(27.5, 3, 27.5, 4.5)
  ctx.lineTo(27.5, 19)
  ctx.lineTo(16, 29.5)
  ctx.lineTo(4.5, 19)
  ctx.lineTo(4.5, 4.5)
  ctx.quadraticCurveTo(4.5, 3, 6, 3)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#0c0e08'
  ctx.beginPath()
  ctx.moveTo(17.8, 8)
  ctx.lineTo(12, 17)
  ctx.lineTo(15.4, 17)
  ctx.lineTo(14.2, 24)
  ctx.lineTo(20, 15)
  ctx.lineTo(16.6, 15)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f2f4f7'
  ctx.font = '800 48px "Outfit Variable", sans-serif'
  ctx.fillText('League', x + 70, y)
  const w = ctx.measureText('League').width
  ctx.fillStyle = '#c9f542'
  ctx.fillText('Forge', x + 70 + w, y)
}

function drawCrest(ctx: CanvasRenderingContext2D, team: Team, cx: number, cy: number, r: number) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  g.addColorStop(0, team.primaryColor)
  g.addColorStop(1, shade(team.primaryColor, -0.45))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = team.secondaryColor
  ctx.lineWidth = Math.max(3, r * 0.06)
  ctx.stroke()
  ctx.fillStyle = bestText(team.primaryColor)
  ctx.font = `800 ${Math.round(r * 0.72)}px "Outfit Variable", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(monogram(team.name), cx, cy + r * 0.04)
  ctx.textBaseline = 'alphabetic'
}

function teamName(ctx: CanvasRenderingContext2D, name: string, cx: number, y: number) {
  ctx.fillStyle = '#f2f4f7'
  ctx.font = '700 46px "Outfit Variable", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(clip(ctx, name, 400), cx, y)
}

function pill(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string, color: string) {
  ctx.font = '800 36px "Outfit Variable", sans-serif'
  const w = ctx.measureText(text).width + 70
  ctx.fillStyle = 'rgba(69,212,131,0.12)'
  roundRect(ctx, cx - w / 2, cy - 42, w, 68, 34)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(text, cx, cy + 5)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 2 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

// ---------------------------------------------------------------- delivery

async function deliver(c: HTMLCanvasElement, filename: string): Promise<boolean> {
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))
  if (!blob) return false
  const safeName = filename.replace(/[^\w.-]+/g, '-')
  const file = new File([blob], safeName, { type: 'image/png' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return true
    } catch {
      /* user dismissed the sheet — fall through to download */
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return true
}
