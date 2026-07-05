# LeagueForge

**The definitive platform for creating, managing, and competing in long-term leagues.**

**▶ Live app: https://heavybigpotato.github.io/LeagueForge/**

On iPhone: open that link in Safari, tap **Share → Add to Home Screen**, and LeagueForge
installs as a full-screen app with its own icon and offline support (it's a PWA — no App
Store, no setup).

LeagueForge is built around trust, competition, and league integrity: every team is
earned, every result is verified by both captains (or a referee), and every action is
recorded in an immutable audit log. It aims to feel like professional league management
software while staying simple enough for friends, schools, companies, and local communities.

The full product specification lives in [`docs/SPEC.md`](docs/SPEC.md).

## What's implemented

This repository contains the LeagueForge core engine and a premium, mobile-first client:

- **Core domain engine** (`src/core/`) — pure, fully unit-tested TypeScript:
  - `account.ts` — real account creation with **password login** (salted iterated hashes,
    sign-in required to switch identities): unique usernames, validated email, optional
    phone. Nothing ships pre-loaded and nothing is simulated — every user is created
    through this flow, and there is no fake verification step.
  - `seasons.ts` — a full **multi-season lifecycle**: every match is stamped with its
    season; ending a season freezes the final table, table leaders, and champion into
    permanent league history, unlocks rosters, and starts the next campaign with clean
    standings.
  - `league.ts` — league creation with commissioner role, **custom scoring rules**,
    tie-breakers, privacy, configurable home venue, a **league join code** for team
    entry, and validation (the roster minimum can be raised but never drops below the
    platform floor of **11 players**) — plus commissioner tools: settings edits,
    **league announcements**, and **referee assignment** (referees resolve disputes).
  - `team.ts` — teams are **first-class and league-independent**: anyone founds a team,
    players join via an 8-character invite code / link / QR into the captain's approval
    queue, and the team **automatically goes official** at the roster minimum. Teams
    register into leagues (even while still recruiting), leave between seasons, and
    survive their league being deleted. One account cannot join two teams in one league.
  - `knockout.ts` — the **Knockout Cup** format: a league's season can be a
    single-elimination bracket (2/4/8/16 teams, no draws), drawn from the official teams,
    with winners auto-advancing as ties are verified and the champion crowned at the final.
  - `match.ts` — the **match verification state machine**:
    `scheduled → awaiting-confirmation → official`, with a `disputed` branch that freezes
    standings until the commissioner or a referee resolves it. Evidence photo uploads,
    RSVPs, and check-ins included.
  - `schedule.ts` — round-robin fixture generation for official teams only, launched
    explicitly by the commissioner once the league hits its minimum team count.
  - `standings.ts` — standings derived exclusively from verified results, with
    configurable points and tie-breakers, plus a last-5 form guide.
  - `clubStats.ts` / `leagueStats.ts` / `teamStats.ts` / `powerRankings.ts` — trophy
    cabinets, all-time club records, league season stats, and weekly power rankings, all
    derived from verified results only.
  - `audit.ts` — append-only, frozen audit entries; deliberately no edit/delete API.
  - `invariants.ts` — a whole-state integrity checker (pending teams never scheduled, no
    result without verification, no cup draws, roster minimums, referential integrity)
    that runs in the Data Center health panel and in tests.
- **Mobile-first app** (`src/ui/`, `src/store/`) — a React client with a native-app feel
  and its own design system: bundled Outfit typography, a hand-tuned SVG icon set,
  generated team crests, and a volt-on-charcoal athletic theme. The home screen surfaces
  what needs you right now (scores to confirm, disputes, join requests, a live countdown
  to your next fixture), plus a league hub, ticket-style invite cards with real QR codes,
  full match pages, **Match Day Live** (a courtside scoreboard feeding the verification
  pipeline), shareable result graphics, club pages with trophy cabinets, and a career
  profile with password-checked identity switching.
- **Installable PWA** — web app manifest, generated app icons, iOS home-screen support,
  and a service worker (network-first navigations, cache-first hashed assets) so the
  installed app launches instantly and works offline. Deployed to GitHub Pages on every
  push to `main` (`.github/workflows/deploy.yml`).
- **Legal, honestly** — in-app [Privacy Policy](https://heavybigpotato.github.io/LeagueForge/#/privacy)
  and [Terms of Use](https://heavybigpotato.github.io/LeagueForge/#/terms) that describe
  the local-first reality (your data never leaves the device, no ads, no trackers), a
  proprietary LICENSE, and THIRD-PARTY-NOTICES for the open-source pieces.
- **Monetization: LeagueForge Pro** — one honest, one-time in-app purchase (accent theme
  packs + Supporter badge) sold through a hosted checkout and delivered as an offline
  license key (`npm run pro:key`). Fully off until the operator configures a checkout
  link — no teaser, no dead buttons. Core features stay free. Setup:
  [`docs/MONETIZATION.md`](docs/MONETIZATION.md) · launch legalities:
  [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md).

The app starts **completely empty** — first launch is a landing screen (create account
first, sign-in below it) into a real multi-step signup. No verification-code theater: the
local build has no mail/SMS gateway and never pretends otherwise (real email/SMS
verification, sync, and hosted leagues are backend features — see the launch checklist).
Multiple accounts can live on one device; switching requires the account password.

**Local-first, honestly**: persistence is a versioned envelope in browser storage
(schema-checked, with migrations from every older version and export-before-reset if a
payload is ever unreadable). The **Data Center** (`/data`) is the portability hub: full
JSON export, a system health panel running the invariant checker, and device reset.

## Getting started

```bash
npm install
npm run dev        # start the app
npm test           # run the test suite (engine + persistence/backup/invariants)
npm run lint       # eslint
npm run typecheck  # tsc
npm run build      # typecheck + production build
```

## Project layout

```
src/
  core/       pure domain engine + config + invariants + tests (no React)
  adapters/   local-first seams: clock, storage (auth/notify/upload plug in later)
  store/      app state, versioned persistence + migrations, backup export, Pro unlock
  ui/         screens and shared components (incl. ProCard.tsx + LegalScreens.tsx)
scripts/      pro-key.mjs — mint LeagueForge Pro license keys (npm run pro:key)
docs/         SPEC.md · MONETIZATION.md · LAUNCH-CHECKLIST.md
```
