# Launch checklist — Europe & US

What's already handled in the app, and what only you (the operator) can do.

## Already built in ✅

- **Privacy Policy & Terms of Use** — in-app at `#/privacy` and `#/terms`,
  linked from the sign-up screen ("By continuing you agree…") and Profile.
  They honestly describe the local-first architecture: no server, no data
  collection, no analytics, **no ads, no trackers, no cookies**.
- **GDPR (EU)** — the app is about as GDPR-friendly as software gets: all
  personal data stays on the user's device. Access/portability = Export
  (Data Center); erasure = Erase device. No processor agreements needed
  because nothing is processed server-side.
- **ePrivacy / cookie rules (EU)** — nothing to consent to: the app loads no
  third-party scripts and sets no tracking cookies at all.
- **CCPA (US/California)** — nothing is collected or sold; the privacy policy
  says so plainly.
- **COPPA (US)** — terms set a 13+ age requirement; the app collects nothing
  server-side either way.
- **In-app purchase (LeagueForge Pro)** — hosted checkout (the app never
  touches payment data), license-key delivery, cosmetic-only entitlements,
  and terms covering digital-content delivery under EU consumer rules. Off
  by default until you configure it: docs/MONETIZATION.md.
- **Licensing** — LICENSE (all rights reserved, you own it) +
  THIRD-PARTY-NOTICES.md covering the open-source pieces (React MIT, Outfit
  font OFL, etc.). All compatible with commercial use.
- **PWA install** — manifest + icons + service worker; users can "Add to Home
  Screen" on iPhone/Android and it behaves like an app, offline included.

## You must do (can't be done from code) ⚠️

1. **Payment provider account** (~15 min, free) — Gumroad or Lemon Squeezy as
   merchant of record (they handle EU VAT / US sales tax, invoices, and
   chargebacks for you). Your IBAN goes in **their** payout settings, never
   in the repo. Then paste the checkout link + a fresh key secret into
   `src/core/config.ts` — full walkthrough in docs/MONETIZATION.md.
2. **Operator identity in the legal pages** — EU consumer law expects an
   identifiable seller ("mentions légales" in France). Before selling, put a
   name/entity + contact email into `src/ui/LegalScreens.tsx` (currently it
   points to the GitHub project page).
3. **Taxes** — sale proceeds are taxable income in France
   (micro-entrepreneur / BNC etc.). The merchant-of-record model means the
   provider handles VAT; you declare what they pay out to you.
4. **Custom domain** (optional, ~€10/yr) — not required for purchases; nice
   for branding and a future store listing.

## If you want real app stores later 📱

The web app installs today as a PWA (free, no store review). For the actual
stores:

- **Google Play**: package the PWA as a TWA (e.g. Bubblewrap) — $25 one-time
  developer fee. Note: Play requires digital goods to use **Google Play
  Billing** (15–30% cut) instead of your web checkout.
- **Apple App Store**: needs an Apple Developer account ($99/yr) and a native
  wrapper (Capacitor). Same rule: digital goods must use Apple's in-app
  purchase (15–30% cut). The web/PWA version keeps 100% minus the payment
  provider's fee — which is why web-first is the better deal here.

## What would need a backend (deliberately not faked)

Real email/SMS verification, cross-device sync, hosted leagues, server-side
entitlement checks, and account recovery all need a server. The app says so
honestly in the UI instead of simulating them. When you're ready, Firebase
Auth (free tier) or Supabase are the smallest real steps — but they're a
product decision, not a checkbox.
