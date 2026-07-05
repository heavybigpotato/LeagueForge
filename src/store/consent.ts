import { localStorageAdapter } from '../adapters/storage'

/**
 * Advertising consent, stored separately from app state so erasing app data
 * never silently re-enables anything. Three states:
 *  - null: never asked (banner shows, no ad code loads)
 *  - 'granted': ads may load
 *  - 'denied': no ad script is ever loaded; we do not re-ask on every visit
 *
 * This is deliberately conservative for EU (GDPR/ePrivacy): with no consent
 * there is no ad request, no cookie, no tracking — nothing to justify.
 */

const CONSENT_KEY = 'leagueforge-ads-consent'

export type AdConsent = 'granted' | 'denied' | null

export function getAdConsent(): AdConsent {
  const raw = localStorageAdapter.get(CONSENT_KEY)
  return raw === 'granted' || raw === 'denied' ? raw : null
}

export function setAdConsent(value: 'granted' | 'denied'): void {
  localStorageAdapter.set(CONSENT_KEY, value)
}
