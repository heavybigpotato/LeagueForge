import { useState } from 'react'
import { ACCENTS, PRO } from '../core/config'
import { activateProKey, setAccent, useProState } from '../store/pro'
import { Badge } from './components'
import { Icon } from './icons'

/**
 * The LeagueForge Pro purchase surface (Profile screen). Three honest rules:
 *  - with no checkout link configured and nothing unlocked, it renders
 *    NOTHING — no teaser for a product that can't be bought
 *  - buying happens on the payment provider's page, never in-app: the app
 *    takes no card data and runs no payment code
 *  - the license key works forever, verified on-device
 */
export function ProCard() {
  const { unlocked, accent } = useProState()
  const [entering, setEntering] = useState(false)
  const [key, setKey] = useState('')
  const [failed, setFailed] = useState(false)

  const purchasable = PRO.checkoutUrl.length > 0
  if (!purchasable && !unlocked) return null

  if (unlocked) {
    return (
      <>
        <h2>LeagueForge Pro</h2>
        <div className="card procard">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--volt)' }}><Icon name="sparkle" size={17} /></span>
            <strong className="grow">Pro is active on this device</strong>
            <Badge kind="volt">Supporter</Badge>
          </div>
          <p className="faint" style={{ margin: '8px 0 6px' }}>Pick your accent — the whole app follows.</p>
          <div className="accent-row">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className={`accent-chip${accent === a.id ? ' on' : ''}`}
                data-accent={a.id}
                onClick={() => setAccent(a.id)}
                aria-pressed={accent === a.id}
              >
                <i />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <h2>LeagueForge Pro</h2>
      <div className="card procard">
        <div className="row" style={{ gap: 8 }}>
          <span style={{ color: 'var(--volt)' }}><Icon name="sparkle" size={17} /></span>
          <strong className="grow">Support the app, unlock the extras</strong>
          <Badge kind="volt">{PRO.currency}{PRO.price}</Badge>
        </div>
        <p className="faint" style={{ margin: '8px 0 10px' }}>
          One-time purchase: accent theme packs, a Supporter badge, and a say in what gets built next. Payment happens on a
          secure checkout page — the app never sees your card. You get a license key by email; enter it here.
        </p>
        <a className="btn primary" href={PRO.checkoutUrl} target="_blank" rel="noreferrer">
          <Icon name="sparkle" size={16} /> Get Pro — {PRO.currency}{PRO.price}
        </a>
        {entering ? (
          <div style={{ marginTop: 10 }}>
            <div className={`auth-field${failed ? ' invalid shake' : ''}`}>
              <input
                placeholder="LFPRO-XXXXX-XXXXX-XXXXX"
                value={key}
                autoCapitalize="characters"
                onChange={(e) => {
                  setKey(e.target.value)
                  setFailed(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && (activateProKey(key) || setFailed(true))}
                aria-invalid={failed}
              />
            </div>
            {failed && <p className="field-error" role="alert">That key doesn&rsquo;t check out — mind the dashes.</p>}
            <button className="btn" style={{ marginTop: 8 }} onClick={() => (activateProKey(key) ? undefined : setFailed(true))}>
              Activate
            </button>
          </div>
        ) : (
          <button className="textlink" style={{ marginTop: 10 }} onClick={() => setEntering(true)}>
            I already have a key
          </button>
        )}
      </div>
    </>
  )
}
