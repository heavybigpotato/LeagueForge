# Launch checklist — Europe & US

What's already handled in the app, and what only you (the operator) can do.

## Already built in ✅

- **Privacy Policy & Terms of Use** — in-app at `#/privacy` and `#/terms`,
  linked from the sign-up screen ("By continuing you agree…") and Profile.
  They honestly describe the local-first architecture: no server, no data
  collection, no analytics.
- **GDPR (EU)** — the app is about as GDPR-friendly as software gets: all
  personal data stays on the user's device. Access/portability = Export
  (Data Center); erasure = Erase device. No processor agreements needed
  because nothing is processed server-side.
- **ePrivacy / cookie rules (EU)** — no cookies, no trackers by default. If
  ads are enabled, an explicit opt-in consent gate blocks ALL ad code until
  the user agrees (see docs/MONETIZATION.md §6 for the certified-CMP upgrade).
- **CCPA (US/California)** — nothing is collected or sold; the privacy policy
  says so plainly.
- **COPPA (US)** — terms set a 13+ age requirement; the app collects nothing
  server-side either way.
- **Licensing** — LICENSE (all rights reserved, you own it) +
  THIRD-PARTY-NOTICES.md covering the open-source pieces (React MIT, Outfit
  font OFL, etc.). All compatible with commercial/ad-supported use.
- **PWA install** — manifest + icons + service worker; users can "Add to Home
  Screen" on iPhone/Android and it behaves like an app, offline included.

## You must do (can't be done from code) ⚠️

1. **Custom domain** (~€10/yr) — needed for AdSense approval and looks right
   on a store listing. Point it at GitHub Pages in repo Settings → Pages.
2. **AdSense account + payout details** — docs/MONETIZATION.md. Your IBAN goes
   in AdSense → Payments, never in the repo.
3. **Operator identity in the legal pages** — EU consumer law expects an
   identifiable operator ("mentions légales" in France). When you're serious,
   put a name/entity + contact email into `src/ui/LegalScreens.tsx` (currently
   it points to the GitHub project page).
4. **Taxes** — AdSense income is taxable income in France (micro-entrepreneur
   / BNC etc.). Google will also make you fill W-8BEN-type tax forms in the
   AdSense dashboard for US-sourced revenue.

## If you want real app stores later 📱

The web app installs today as a PWA (free, no store review). For the actual
stores:

- **Google Play**: package the PWA as a TWA (e.g. Bubblewrap) — $25 one-time
  developer fee. Ads: AdSense stays fine inside a TWA.
- **Apple App Store**: needs an Apple Developer account ($99/yr) and a native
  wrapper (Capacitor). Apple requires App Tracking Transparency prompts for
  personalized ads and its own review of ad behavior; ad SDKs usually switch
  to AdMob (Google's in-app sibling of AdSense — same account family, same
  payout details).

## What would need a backend (deliberately not faked)

Real email/SMS verification, cross-device sync, hosted leagues, and account
recovery all need a server. The app says so honestly in the UI instead of
simulating them. When you're ready, Firebase Auth (free tier) or Supabase are
the smallest real steps — but they're a product decision, not a checkbox.
