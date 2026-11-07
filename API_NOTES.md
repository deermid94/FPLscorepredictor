# FPL API notes (reverse-engineered)

The Fantasy Premier League site (https://fantasy.premierleague.com) is a single-page app that loads all of its data from an undocumented JSON API under `https://fantasy.premierleague.com/api/`. These notes come from watching the site's network traffic and probing the endpoints directly with `curl` (last checked 2026-11-07, during Gameweek 10 of the 2026/27 season).

Nothing here is official. The API has no versioning and can change between seasons without warning, so the app keeps a manual admin fallback (see "How the app uses it").

## General behaviour

| Thing | Observed |
|---|---|
| Auth | None for the public endpoints used here. `GET /api/me/` returns `{"player":null,...}` when you are not logged in. |
| Method | `GET` only (`allow: GET, HEAD, OPTIONS`). |
| CORS | **No `Access-Control-Allow-Origin` header**, even when the request sends an `Origin` header and on `OPTIONS` preflight. Browsers on another origin cannot read responses, so **the app calls the API server-side only**. |
| Caching headers | Most endpoints send `cache-control: max-age=0, no-cache, no-store, must-revalidate`, but they sit behind a CDN (`x-cache: HIT, HIT`, `age: 96`), so data can be a few minutes stale. |
| Rate limiting | Not documented. Heavy scraping is known to get IPs blocked, sometimes with a 403 or an HTML "The game is being updated" page during gameweek processing. The app caches responses and fetches at most once every 2 minutes (see below). |
| Timezone | All timestamps are ISO-8601 UTC with a `Z` suffix (e.g. `"2026-11-07T15:00:00Z"`). `bootstrap-static.game_settings.timezone` is `"UTC"`. |
| User-Agent | Requests with an empty User-Agent still return 200. The app sends a descriptive UA anyway. |
| Trailing slash | Paths end in `/`. Without it the server redirects. |

## Endpoints

### 1. `GET /api/bootstrap-static/`
A big (~1.8 MB) "everything" document that the site loads on startup. Top-level keys:
`chips, events, game_settings, game_config, phases, teams, total_players, element_stats, element_types, elements`.

The app uses only **`teams`** and **`events`**.

#### `teams[]` (20 entries): how teams are represented
```json
{"id": 6, "code": 8, "name": "Chelsea", "short_name": "CHE",
 "strength_overall_home": 4, "strength_overall_away": 4,
 "position": 4, "played": 0, "win": 0, "draw": 0, "loss": 0, "points": 0, "pulse_id": 4}
```
- **`id`** (1-20) is the key that fixtures use (`team_h` / `team_a`). It is assigned alphabetically **each season**, so it is *not* stable across seasons.
- **`code`** is the club's permanent ID (Arsenal = 3, Man Utd = 1). It is stable across seasons and is used for badge URLs: `https://resources.premierleague.com/premierleague/badges/70/t{code}.png`.
- `name` / `short_name` are display names (`"Chelsea"` / `"CHE"`).
- `played/win/draw/loss/points` were **all 0** mid-season, so the API does not keep them up to date. Don't use them for a league table; work one out from finished fixtures.
- `strength_*` are coarse ratings (1-5). The `strength_attack_*` / `strength_defence_*` fields were 0 this season.

#### `events[]` (38 entries): how gameweeks are represented
```json
{"id": 10, "name": "Gameweek 10", "deadline_time": "2026-11-06T18:30:00Z",
 "deadline_time_epoch": 1793989800, "finished": false, "data_checked": false,
 "is_previous": false, "is_current": true, "is_next": false, ...}
```
- **`id`** = gameweek number (1-38). Fixtures point to it through `fixture.event`.
- `deadline_time` is the **FPL transfer deadline**: 90 minutes before the first kick-off of the gameweek. It is *not* a kick-off time. We lock picks per match, so the app ignores it.
- `is_current` = the gameweek whose deadline has passed most recently. `is_next` = the next one. `is_previous` = the one before current.
- `finished` turns true once every match is over and FPL has processed points. `data_checked` turns true after FPL has validated the data.
- There are also lots of FPL-game stats (`average_entry_score`, `most_captained`, `chip_plays`, ...) that we don't use.

`phases[]` maps months to gameweek ranges (`{"name":"August","start_event":1,"stop_event":2}`). `elements[]` is the list of players (~700). Neither is used.

### 2. `GET /api/fixtures/`: the fixture/results feed
Returns an array of **all 380 fixtures** for the season (~325 KB with stats). Query parameters:
- `?event={gw}`: only that gameweek's fixtures (`/api/fixtures/?event=10`).
- `?future=1`: only fixtures that haven't been played yet.

One fixture:
```json
{"id": 94, "code": 2645288, "event": 10,
 "kickoff_time": "2026-11-06T20:00:00Z", "provisional_start_time": false,
 "started": true, "finished": false, "finished_provisional": true, "minutes": 90,
 "team_h": 9, "team_h_score": 3, "team_a": 7, "team_a_score": 1,
 "team_h_difficulty": 2, "team_a_difficulty": 4,
 "stats": [{"identifier": "goals_scored", "h": [{"value": 2, "element": 249}], "a": [...]}, ...],
 "pulse_id": 0}
```

| Concept | How it's represented |
|---|---|
| Identity | `id` (1-380, unique within the season). `code` is a global Opta-style ID. |
| Gameweek | `event` (1-38). **`null` means the match is postponed or not yet rescheduled.** It gets a new `event` once rescheduled. |
| Teams | `team_h` (home) and `team_a` (away) are `teams[].id` from bootstrap-static. |
| Kick-off | `kickoff_time` in UTC. Can be `null` for postponed or unscheduled matches. `provisional_start_time: true` means the date is a placeholder (e.g. before TV picks). |
| Status | Three booleans: `started` → `finished_provisional` → `finished` (see table below). `minutes` is the minutes played (0 before kick-off, live during the match, 90 after). |
| Score | `team_h_score` / `team_a_score`: **`null` before kick-off**, live integers during the match, final integers after full time. |
| Difficulty | `team_h_difficulty` / `team_a_difficulty` (FPL's 2-5 "FDR" rating for each side). A useful proxy for which team is favourite. |
| Stats | `stats[]` lists goals, assists, cards, bonus, BPS etc. by player (`element`). We ignore it, apart from noting that goals live here. |

**Match status state machine:**

| `started` | `finished_provisional` | `finished` | Meaning | App status |
|---|---|---|---|---|
| false | false | false | Not kicked off | `scheduled` |
| true | false | false | In play (score is live) | `live` |
| true | true | false | Full time. Score is final, FPL bonus points not yet confirmed (~1 hour) | `finished` |
| true | true | true | Fully processed | `finished` |

We count the result as final at **full time (`finished_provisional`)**. The bonus delay only affects FPL fantasy points, not the scoreline.

Observed at the time of writing: 90 fixtures were fully finished, 1 was `finished_provisional` only (GW10's Friday night match, about 16 hours after it ended), and 289 were unplayed.

### 3. `GET /api/event-status/`
Tells you what FPL's points processing is doing for the current gameweek:
```json
{"status": [{"bonus_added": false, "date": "2026-11-06", "event": 10, "points": "p"},
            {"bonus_added": false, "date": "2026-11-07", "event": 10, "points": ""}],
 "leagues": ""}
```
`points`: `""` = no matches yet that day, `"l"` = live, `"p"` = provisional, `"r"` = confirmed. The app doesn't need this because fixture flags are enough, but it's handy for debugging.

### 4. `GET /api/event/{gw}/live/`
Live stats for each player in a gameweek (`elements[].stats`, `elements[].explain[].fixture`). It's player-level only, with no fixture score field, so we don't use it.

### 5. Other endpoints seen in the site's traffic (not used)
- `/api/element-summary/{player_id}/`: a player's fixtures and history.
- `/api/entry/{team_id}/` (+ `/history/`, `/event/{gw}/picks/`): public data about an FPL manager's team.
- `/api/leagues-classic/{league_id}/standings/`: mini-league tables.
- `/api/team/set-piece-notes/`, `/api/regions/`, `/api/me/` (needs a login cookie).

## How the app uses it
- `src/lib/fpl.ts` fetches `bootstrap-static` (teams, events) and `fixtures` on the **server only**. Responses are cached in the `api_cache` DB table: bootstrap for 6 hours, fixtures for 2 minutes if a match is live or recently kicked off, otherwise 15 minutes. That keeps us well clear of rate limits and still works on serverless deployments, where in-memory caches don't persist.
- `syncFromFpl()` upserts teams and fixtures into our own `fixtures` table: status is derived from the flags above, and scores are copied once `finished_provisional` is true. Our predictions, scoring and locking only ever read **our** DB, never the API directly. So if FPL is down or changes shape, the app keeps working off the last good data.
- Sync runs lazily whenever a page loads (throttled by the cache TTL). There's also a Vercel cron hitting `/api/cron/sync` once a day as a backstop.
- Locking uses `kickoff_time` per fixture, never `events.deadline_time`.
- **Fallback:** admins can add fixtures and enter or override results by hand. A fixture with a manual result (`manual_result = 1`) is never overwritten by sync until the admin hands it back to the API.
- If the API can't be reached on first run, the app bootstraps from `data/fpl-snapshot.json`, a trimmed copy of bootstrap-static teams/events and fixtures captured on 2026-11-07.
