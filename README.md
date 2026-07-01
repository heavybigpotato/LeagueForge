# LeagueForge

**The definitive platform for creating, managing, and competing in long-term leagues.**

LeagueForge is built around trust, competition, and league integrity: every player has a
verified identity, every team is earned, every result is verified, and every action is
recorded in an immutable audit log. It aims to feel like professional league management
software while staying simple enough for friends, schools, companies, and local communities.

The full product specification lives in [`docs/SPEC.md`](docs/SPEC.md).

## What's implemented

This repository contains the LeagueForge core engine and a premium, mobile-first client:

- **Core domain engine** (`src/core/`) — pure, fully unit-tested TypeScript:
  - `league.ts` — league creation with commissioner role, scoring rules, tie-breakers,
    privacy, and validation (the roster minimum can be raised but never drops below the
    platform floor of **11 verified players**).
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
    points and tie-breakers (goal difference, goals for, head-to-head, win %).
  - `audit.ts` — append-only, frozen audit entries; there is deliberately no edit/delete API.
  - `achievements.ts` — season awards (Champion, Perfect Season, Top Defense) derived from
    verified results.
- **Mobile-first app** (`src/ui/`, `src/store/`) — a React client styled like a premium
  native app: league dashboard (standings / schedule / teams / audit log), team pages with
  activation progress and invite codes, match pages with score submission, confirmation,
  disputes, evidence, and check-ins, plus a career profile. A demo identity switcher lets
  you experience the commissioner, captain, and player roles against the same league.

State persists to `localStorage`; the app ships with a seeded demo league so it feels alive
on first launch (three official teams, one team pending at 9/11, a verified result, a score
awaiting confirmation, and an open dispute with evidence).

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
