# LeagueForge — Product Specification

## Vision

LeagueForge is a premium mobile application: the definitive platform for creating,
managing, and competing in long-term leagues. It should feel like a professional league
management system used by sports organizations, but be simple enough for friends, schools,
companies, and local communities.

Unlike simple score-tracking apps, LeagueForge is built around **trust, competition, and
league integrity**. Every score, ranking, and championship must be verifiable, transparent,
and resistant to manipulation.

Leagues can last a weekend tournament, one season (2–6 months), a full year, or multiple
years with historical records.

Supported sports: football (soccer), basketball, volleyball, cricket, baseball, hockey,
rugby, tennis, pickleball, esports, chess, and fully custom sports.

## Core principles

1. Every league should feel real.
2. Every player should have an identity.
3. Every result should be verified.
4. Every championship should be earned.

## User roles

| Role | Permissions |
| --- | --- |
| **Commissioner** | Creates and owns the league. Configure rules, approve teams, schedule matches, review disputes, approve scores, manage playoffs, remove teams, view analytics, manage payments, assign referees. |
| **Team Captain** | One per team. Create a pending team, invite players, manage roster, submit scores, confirm scores, chat with teammates. |
| **Player** | Join teams, view standings, RSVP, upload evidence, track career statistics, earn achievements. |
| **Referee** (optional) | Verify matches, enter official scores, record statistics, resolve disputes. |

## League creation

Required fields: league name, sport, logo, banner, description, country, city, season
start/end, maximum/minimum teams, maximum/minimum players per team, playoff format,
scoring rules, tie rules, and privacy (**public / private / invite-only**).

## Team creation — the Pending Team system (mandatory)

A team **does not** exist in the league immediately after creation. Teams go through a
**Pending** stage:

1. **Create Team** — a captain enters team name, logo, primary/secondary color, and bio.
   The team status becomes **Pending**: it is not part of the league, cannot play matches,
   and does not appear in standings.
2. **Invites** — the app generates a unique invite link
   (`leagueforge.app/join/ABC12345`), an 8-character invite code (`ABC12345`), and a QR
   code. The captain shares these.
3. **Players join** — each player must create an account, verify their email, verify their
   phone number, choose a username, and optionally verify identity. They join with the
   invite code, link, or QR scan. The **captain approves** new players.

### Team activation rule

A team remains **Pending** until it reaches the required number of players
(**default minimum: 11**). Example: a captain plus 8 teammates = 9 players → still pending,
cannot compete, cannot schedule games, does not appear in standings.

Once player #11 joins and is approved, the team **automatically** becomes an **Official
Team**: the app congratulates the team, the commissioner is notified, the team enters the
league, the schedule updates, standings include the team, and the roster locks for the
season (unless league rules allow transfers).

Commissioners may raise the minimum roster requirement above 11 for sports that require
larger squads, but it can **never** be lower than the platform minimum.

### Roster rules

Each league defines minimum and maximum players (e.g. 11–25). A team cannot play matches
below the minimum roster, register with fewer than the minimum, or delete players below
the minimum.

### Anti-fake-player system

Verified email, verified phone, unique account, optional government ID verification,
device fingerprinting, duplicate detection, suspicious activity monitoring. One account
cannot join multiple teams in the same league unless explicitly allowed.

## Scheduling

After official teams exist, fixtures are generated automatically. Supported formats:
round robin, double round robin, knockout, Swiss, ladder, groups, playoffs, custom.

## Match page

Date, time, venue, officials, weather, lineups, live score, statistics, timeline, photos,
videos, attendance, comments, evidence, verification status.

## Match verification

No score immediately changes standings — every score enters verification:

1. Captain A submits a score.
2. Captain B is notified and chooses **confirm**, **dispute**, or **suggest correction**.
3. If both confirm → official result, standings update.
4. If disputed → standings freeze, commissioner notified, evidence requested.

**Accepted evidence:** photos, videos, official score sheet, GPS attendance, QR check-in,
referee report, witness confirmation.

**QR check-in:** before a match the captain generates a QR; players scan it, recording
time, attendance, team, and match. Optional GPS validation ensures players were at the venue.

## Immutable audit log

Every action is permanent — nothing can be deleted, only appended. Example:

> 7:00 PM Match created · 7:45 PM Captain submitted lineup · 9:02 PM Score submitted ·
> 9:03 PM Opponent disputed · 9:08 PM Photo uploaded · 9:11 PM Commissioner approved.

## Standings & statistics

- **Standings:** wins, losses, draws, points, goal difference, goals for/against,
  head-to-head, win %, strength of schedule, custom formulas.
- **Player statistics:** games, minutes, goals, assists, cards, clean sheets, MVPs, wins,
  losses, win %, custom statistics.
- **Team statistics:** win %, goals, goals against, home/away record, longest winning
  streak, biggest victory, historical performance.

## Career profiles, Hall of Fame, achievements

Every player has a career record, championships, awards, leagues played, season history,
achievements, verified badge, and reputation score. The Hall of Fame is automatically
generated (most championships, most goals/assists/appearances, best defender, longest
streak, league legends). Achievements include Champion, Perfect Season, Golden Boot, Top
Defender, Most Assists, Iron Man, Captain, Dynasty, Comeback King, and Underdog; rare
achievements include animations.

## Monetization

| Tier | Price | Includes |
| --- | --- | --- |
| Free | — | One league, basic standings/statistics, one active team |
| Commissioner Pro | $9.99/mo | Unlimited leagues & teams, custom branding, playoffs, advanced analytics, exports, cloud backups, sponsor management, priority support |
| Team Pro | $3.99/mo | Training planner, private team media, video library, advanced statistics, scouting reports, premium customization |
| League Pass | $29.99/yr | Everything unlocked, historical archives, AI season summaries, premium themes, power rankings, advanced reports, exclusive commissioner tools |

Additional revenue: marketplace (premium logos, scoreboard themes, animations, trophies,
award packs, rulebook/commissioner templates), sponsor integrations, merchandise store,
ticketing, league websites.

## Security

Two-factor authentication, end-to-end encrypted chats, immutable audit logs, cloud
backups, role-based permissions, fraud detection, device fingerprinting, spam prevention,
bot detection, account reputation.

## User experience / onboarding

1. Commissioner creates a league.
2. Captains create Pending Teams.
3. Invite links, QR codes, or join codes are shared.
4. Players join and are approved.
5. Once 11 verified players are on a roster, the team is automatically activated.
6. Activated teams are registered in the league, included in the schedule, and eligible for standings.
7. Scores require confirmation from both teams (or a referee) before affecting rankings.
8. Every action is logged, creating a trusted, professional competition platform.

The overall experience should feel premium, polished, fast, and trustworthy — more like
professional league management software than a casual scorekeeping app.
