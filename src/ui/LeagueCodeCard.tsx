import type { League } from '../core/types'
import { Icon } from './icons'

/**
 * The league's join code — any captain can enter it to bring their team in.
 * Shown on the Teams tab and in Settings so it's easy to share.
 */
export function LeagueCodeCard({ league }: { league: League }) {
  const share = async () => {
    const text = `Join ${league.name} on LeagueForge with code ${league.joinCode}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${league.name}`, text })
        return
      }
      await navigator.clipboard.writeText(league.joinCode)
    } catch {
      /* dismissed or clipboard unavailable */
    }
  }

  return (
    <div className="ticket">
      <div className="row" style={{ gap: 8, position: 'relative' }}>
        <span style={{ color: 'var(--volt)' }}><Icon name="ticket" size={17} /></span>
        <strong>Invite teams to this league</strong>
      </div>
      <p className="faint" style={{ position: 'relative' }}>
        Captains enter this code to bring their team in{league.privacy === 'public' ? ' — or find you in Discover.' : '.'}
      </p>
      <div className="invite-code">{league.joinCode}</div>
      <div className="btnrow" style={{ position: 'relative', marginTop: 12 }}>
        <button className="btn small" onClick={() => navigator.clipboard?.writeText(league.joinCode).catch(() => {})}>Copy code</button>
        <button className="btn small" onClick={share}>Share</button>
      </div>
    </div>
  )
}
