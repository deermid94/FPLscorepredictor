# Score Predictor League

Exact-score Premier League predictions for a group of mates. Fixtures and results come from the undocumented **Fantasy Premier League API**, which we reverse-engineered: see [API_NOTES.md](./API_NOTES.md).

Next.js 15 (App Router, server actions) · Tailwind · SQLite via libSQL (a local file in dev, free [Turso](https://turso.tech) DB in production) · deploys to Vercel's free tier.

## Rules
- **Points:** correct result (W/D/L) = 1, exact score = 3 (instead of 1). One random **wildcard** match each gameweek scores double.
- **Locking:** each pick locks at that match's kick-off, and the server enforces it.
- **Money (tracking only):** €5 per player per gameweek. 1st place gets 40%, 2nd gets 20%, and 40% rolls into the season pot. Tied players pool the prize places they occupy and split them equally (two tied for 1st get 30% each). The season pot goes to the top overall scorer (split on a tie) on the end date the admin sets.
- **Results** sync from FPL automatically once a match reaches full time (`finished_provisional`). Admins can enter or override results and add fixtures by hand.

## Screens
| Route | What |
|---|---|
| `/join` | Join with an invite code + name + PIN, or start a new league |
| `/week` | This gameweek: fixtures, wildcard badge, score inputs, lock status, everyone's picks after lock, the app's guess of your pick |
| `/leaderboard` | Weekly table with prize amounts + Hall of Shame (worst prediction of the week) |
| `/season` | Season table and pot |
| `/ledger` | Who has paid each week, winnings, balances, pot |
| `/scouting`, `/scouting/[id]` | Scouting reports: favourite scoreline, home/away bias, goals predicted vs actual, over-backed team, optimism score, cheeky profile, Predict-the-Predictor hit rate |
| `/admin` | Season end date, mark payments, manual fixtures/results, re-draw wildcard, force FPL sync, admin roles |

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # scoring / prize-split unit tests
```
On first request the app creates `local.db`, syncs from the FPL API (or falls back to `data/fpl-snapshot.json` if it can't reach it) and seeds a demo league:

- Invite code **`MATES26`**; every player's PIN is `DEMO_PIN` (put it in `.env.local`, e.g. `DEMO_PIN=4826`). If it's unset, a random 6-digit PIN is generated and printed in the server log.
- While `SEED_DEMO` isn't `false`, the join page has one-tap **Conor (admin)** and **Ollie (player)** buttons that log in to the demo without a PIN. Anyone with the URL can use them, but they only reach the demo league.
- Players: **Conor** (admin), Ollie (optimist), Dave (draw merchant), Niamh (pessimist), Barry (Man Utd fanboy), Aoife (contrarian)
- 4 completed gameweeks of predictions and payments, plus the current gameweek part-picked

Delete `local.db` to reseed, or use **Reset demo** in Admin (logged in as Conor). Admin also has **Simulate full time**, which gives the next unfinished match a random score in the demo league only. Both demo tools only appear in the demo league. Set `SEED_DEMO=false` to start empty.

Wrong PINs are rate limited: 5 per player name, or 30 per IP, within 15 minutes lock logins for 15 minutes.

## Deploy to Vercel (free)
1. Create a free Turso database: `turso db create spl`, then `turso db show spl --url` and `turso db tokens create spl`. You can also use the Turso integration in the Vercel marketplace.
2. Import this repo in Vercel and set these environment variables:
   | Var | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://...` |
   | `TURSO_AUTH_TOKEN` | token from step 1 |
   | `SESSION_SECRET` | **required**, 16+ characters (`openssl rand -hex 32`). The server refuses to start in production without it |
   | `CRON_SECRET` | random string; Vercel sends it to the cron route automatically. If unset, anyone can trigger a sync |
   | `SEED_DEMO` | `false` for a real league (default seeds the demo) |
   | `DEMO_PIN` | 4-8 digit PIN for the demo players (random if unset). Applied to the six demo players on every server start, so change it and redeploy to reset their PIN |
   | `DISPLAY_TIMEZONE` | optional, default `Europe/London` |
3. Deploy. Tables are created automatically on first request.

Without `TURSO_DATABASE_URL` the app still runs on Vercel, but with a throwaway DB in `/tmp` that resets on every cold start. That's fine for a demo and useless for a real league.

`vercel.json` sets up a daily cron (`/api/cron/sync`) as a backstop. Normal syncing happens lazily on page loads: every 2 minutes while matches are live, otherwise every 15 minutes.

## Code map
- `src/lib/fpl.ts`: server-side FPL client, DB-backed response cache, sync into our tables
- `src/lib/db.ts`: libSQL client + schema
- `src/lib/scoring.ts`: points, prize splitting, Hall of Shame "wrongness" (pure functions, unit tested)
- `src/lib/game.ts`: fixtures, wildcard draw, weekly/season tables, ledger
- `src/lib/scouting.ts`: scouting report stats, profile lines, Predict-the-Predictor model
- `src/lib/seed.ts`: demo league with persona-driven predictions
- `src/app/actions.ts`: server actions (auth, picks, admin)
