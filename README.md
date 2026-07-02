# LeagueForge

**The definitive platform for creating, managing, and competing in long-term leagues.**

**▶ Live app: https://heavybigpotato.github.io/LeagueForge/**

On iPhone: open that link in Safari, tap **Share → Add to Home Screen**, and LeagueForge
installs as a full-screen app with its own icon and offline support (it's a PWA — no App
Store, no setup).

LeagueForge is built around trust, competition, and league integrity: every player has a
verified identity, every team is earned, every result is verified, and every action is
recorded in an immutable audit log. It aims to feel like professional league management
software while staying simple enough for friends, schools, companies, and local communities.

The full product specification lives in [`docs/SPEC.md`](docs/SPEC.md).

## What's implemented

This repository contains the LeagueForge core engine and a premium, mobile-first client:

- **Core domain engine** (`src/core/`) — pure, fully unit-tested TypeScript:
  - `account.ts` — real account creation with **password login** (salted iterated hashes,
    sign-in required to switch identities) plus identity verification: unique usernames,
    email/phone validation, and 6-digit verification codes that gate every roster action.
    Nothing ships pre-loaded — every user is created through this flow.
  - `seasons.ts` — a full **multi-season lifecycle**: every match is stamped with its
    season; ending a season freezes the final table, table leaders, and playoff champion
    into permanent league history, unlocks rosters, and starts the next campaign with
    clean standings and a fresh bracket.
  - `league.ts` — league creation with commissioner role, **custom scoring rules**,
    tie-breakers, privacy, configurable home venue, and validation (the roster minimum can
    be raised but never drops below the platform floor of **11 verified players**) — plus
    commissioner tools: post-creation settings edits, **league announcements**, and
    **referee assignment** (referees can resolve disputes).
  - **Knockout Cup format** — beyond round robin and double round robin, a league's whole
    season can be a single-elimination bracket: drawn from the official teams, no table,
    same two-captain verification on every tie.
  - `team.ts` — the mandatory **Pending Team** lifecycle: teams are created pending,
    players join via an 8-character invite code / link / QR, captains approve joins, and
    the team **automatically activates** the moment the roster reaches the league minimum.
    Official teams can never drop below the minimum; one account cannot join two teams in
    the same league.
  - `match.ts` — the **match verification state machine**:
    `scheduled → awaiting-confirmation → official`, with a `disputed` branch that freezes
    standings until the commissioner or an assigned referee resolves it. Includes evidence
    uploads and QR/GPS check-ins.
  - `schedule.ts` — round-robin / double round-robin fixture generation for official teams only.
  - `standings.ts` — standings derived exclusively from verified results, with configurable
    points and tie-breakers (goal difference, goals for, head-to-head, win %), plus a
    last-5 form guide.
  - `playoffs.ts` — single-elimination playoffs seeded from the verified standings
    (1v4/2v3 bracket order), stored as ordinary matches so every playoff result goes
    through the same two-captain verification; winners auto-advance when results are
    verified, playoff matches can never end in a draw or touch the standings, and the
    champion is crowned when the final is verified.
  - `teamStats.ts` — team-level season statistics (record, home/away splits, streaks,
    clean sheets, biggest win). LeagueForge deliberately tracks the club, not individuals.
  - `powerRankings.ts` — weekly Power Rankings that go beyond the table: form, capped
    margin of victory, strength of opponent, and recency weighting, with movement arrows
    since the last round. Verified regular-season results only.
  - RSVP availability in `match.ts` — rostered players answer In/Out per fixture and
    captains see the headcount, with every answer in the audit log.
  - `audit.ts` — append-only, frozen audit entries; there is deliberately no edit/delete API.
  - `achievements.ts` — season awards (Champion, Perfect Season, Top Defense) derived from
    verified results.
- **Mobile-first app** (`src/ui/`, `src/store/`) — a React client with a native-app feel
  and its own design system: bundled Outfit typography, a hand-tuned SVG icon set,
  generated team crests (built from each team's colors and monogram — no uploads, no
  emoji), and a volt-on-charcoal athletic theme. The home screen is a dashboard that
  surfaces what needs you right now (scores to confirm, disputes to resolve, join requests,
  activation progress), plus a league hub (standings with form guide / schedule / teams /
  audit log), ticket-style invite cards, match pages covering the full verification flow,
  and a career profile. A demo identity switcher lets you experience the commissioner,
  captain, and player roles against the same league.

  The league hub adds a **Playoffs tab with a live bracket view** (ties, auto-advancing
  winners, a gold champions card, and season honors), the standings mark the playoff
  qualification zone, match pages show team-level head-to-head history, and invite
  tickets render a **real scannable QR code** that deep-links into the join flow.
- **Match Day Live** — a full-screen courtside scoreboard for competing captains: running
  clock, big tap targets per side, undo, and a full-time button that hands the score
  straight to the two-captain verification pipeline (the live board never edits standings
  directly).
- **Shareable graphics** — verified results and standings export as polished 1080×1350
  cards (crests, score, venue, verification ribbon, LeagueForge mark) via the native share
  sheet, so every result can go straight to the group chat or a story.
- **Power Rankings** on the standings tab with per-round movement, and **RSVP
  availability** on every upcoming fixture so captains know their headcount before
  kickoff. Team pages show championship honors won through the playoffs.
- **Installable PWA** — web app manifest, generated app icons, iOS home-screen support,
  and a service worker (network-first navigations, cache-first hashed assets) so the
  installed app launches instantly and works offline. Deployed to GitHub Pages on every
  push to `main` (`.github/workflows/deploy.yml`).

The app starts **completely empty** — first launch is a real onboarding: create an
account, verify your email, verify your phone (codes are generated locally and shown
inline, clearly labelled as demo delivery, since the local build has no mail/SMS gateway).
Multiple accounts can live on one device and be switched from the Profile tab, which is
also how invite → approve → activate flows are exercised end-to-end. There is no
pre-loaded or generated sample data of any kind. State persists to `localStorage`.

## Getting started

```bash
npm install
npm run dev        # start the app
npm test           # run the core engine test suite (vitest)
npm run build      # typecheck + production build
```

## Project layout

```
src/
  core/       pure domain engine (no React) + tests
  store/      app state, persistence, demo seed
  ui/         screens and shared components
docs/SPEC.md  full product specification
```
