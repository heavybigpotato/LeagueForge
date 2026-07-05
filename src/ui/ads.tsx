import { useEffect, useState } from 'react'
import { ADSENSE } from '../core/config'
import { getAdConsent, setAdConsent, type AdConsent } from '../store/consent'

/**
 * Google AdSense surfaces. Two hard rules:
 *
 *  1. Nothing renders and no third-party script loads until BOTH a real
 *     publisher id is configured (core/config.ts → ADSENSE.clientId) AND the
 *     user has consented. No placeholders, no fake ads, no silent tracking.
 *  2. Ads look like part of the app: a normal card with a small "Sponsored"
 *     label, placed between content sections — never floating over content.
 *
 * Setup lives in docs/MONETIZATION.md.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export function adsConfigured(): boolean {
  return ADSENSE.clientId.length > 0
}

let scriptRequested = false

function loadAdSenseScript(): void {
  if (scriptRequested || !adsConfigured()) return
  scriptRequested = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.clientId}`
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}

/** In-page listeners so every ad surface reacts the moment consent changes. */
const listeners = new Set<() => void>()

/** Consent state shared across components, kept in sync with localStorage. */
export function useAdConsent(): [AdConsent, (v: 'granted' | 'denied') => void] {
  const [consent, setConsent] = useState<AdConsent>(getAdConsent)
  useEffect(() => {
    const refresh = () => setConsent(getAdConsent())
    listeners.add(refresh)
    return () => void listeners.delete(refresh)
  }, [])
  const decide = (v: 'granted' | 'denied') => {
    setAdConsent(v)
    if (v === 'granted') loadAdSenseScript()
    listeners.forEach((fn) => fn())
  }
  return [consent, decide]
}

/**
 * One ad unit, styled as a native card. Renders nothing at all unless ads
 * are configured, consented to, and the surface has a slot id.
 */
export function AdSlot({ surface }: { surface: keyof typeof ADSENSE.slots }) {
  const [consent] = useAdConsent()
  const slot = ADSENSE.slots[surface]
  const active = adsConfigured() && consent === 'granted' && slot.length > 0

  useEffect(() => {
    if (!active) return
    loadAdSenseScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* blocked or offline — the empty ins collapses, nothing breaks */
    }
  }, [active])

  if (!active) return null
  return (
    <div className="adcard" aria-label="Sponsored content">
      <div className="adcard-label">Sponsored</div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE.clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}

/**
 * First-visit consent banner. Only appears once ads are actually configured —
 * an app with no ad id has nothing to ask consent for.
 */
export function ConsentBanner() {
  const [consent, decide] = useAdConsent()
  if (!adsConfigured() || consent !== null) return null
  return (
    <div className="consent" role="dialog" aria-label="Advertising consent">
      <p>
        LeagueForge is free because it shows a few ads. Allow Google AdSense to display ads? Your game data stays on this
        device either way. Details in the <a href="#/privacy">Privacy Policy</a>.
      </p>
      <div className="consent-actions">
        <button className="btn primary" onClick={() => decide('granted')}>Allow ads</button>
        <button className="btn" onClick={() => decide('denied')}>No thanks</button>
      </div>
    </div>
  )
}
