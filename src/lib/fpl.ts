import { all, batch, get, run } from "./db";
import snapshot from "../../data/fpl-snapshot.json";

const BASE = "https://fantasy.premierleague.com/api";
const MIN = 60_000;

type FplTeam = { id: number; code: number; name: string; short_name: string };
type FplEvent = { id: number; name: string; deadline_time: string | null };
type FplFixture = {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  started: boolean | null;
  finished: boolean;
  finished_provisional: boolean;
  minutes: number;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  team_h_difficulty?: number;
  team_a_difficulty?: number;
};
type Bootstrap = { teams: FplTeam[]; events: FplEvent[] };

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "ScorePredictorLeague/1.0 (server-side, cached)", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`FPL ${path} -> HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error(`FPL ${path} returned ${type} (game updating?)`);
  return (await res.json()) as T;
}

/** DB-backed cache: survives serverless cold starts. Returns fetched=true only when we hit the network. */
async function cached<T>(path: string, ttlMs: number, force: boolean): Promise<{ data: T | null; fetched: boolean }> {
  const row = await get<{ body: string; fetched_at: number }>("SELECT body, fetched_at FROM api_cache WHERE key = ?", [path]);
  if (row && !force && Date.now() - row.fetched_at < ttlMs) return { data: null, fetched: false };
  try {
    const data = await fetchJson<T>(path);
    await run(
      "INSERT INTO api_cache (key, body, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at",
      [path, JSON.stringify(data), Date.now()],
    );
    return { data, fetched: true };
  } catch (e) {
    console.warn("[fpl] fetch failed, using cached data:", (e as Error).message);
    // Back off for a minute before retrying so a blocked/slow API doesn't stall every request.
    await run(
      "INSERT INTO api_cache (key, body, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET fetched_at = excluded.fetched_at",
      [path, row?.body ?? "null", Date.now() - ttlMs + MIN],
    );
    return { data: null, fetched: false };
  }
}

export function fplStatus(f: Pick<FplFixture, "event" | "started" | "finished" | "finished_provisional">) {
  if (f.event == null) return "postponed";
  if (f.finished || f.finished_provisional) return "finished";
  if (f.started) return "live";
  return "scheduled";
}

async function fixturesTtl() {
  const now = new Date();
  const since = new Date(now.getTime() - 3 * 60 * MIN).toISOString();
  const hot = await get(
    "SELECT 1 FROM fixtures WHERE status != 'finished' AND kickoff IS NOT NULL AND kickoff <= ? AND kickoff >= ? LIMIT 1",
    [now.toISOString(), since],
  );
  return hot ? 2 * MIN : 15 * MIN;
}

async function saveBootstrap(b: Bootstrap) {
  await batch([
    ...b.teams.map((t) => ({
      sql: "INSERT INTO teams (id, code, name, short_name) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name, short_name = excluded.short_name",
      args: [t.id, t.code, t.name, t.short_name],
    })),
    ...b.events.map((e) => ({
      sql: "INSERT INTO gameweeks (id, name, deadline) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, deadline = excluded.deadline",
      args: [e.id, e.name, e.deadline_time],
    })),
  ]);
}

async function saveFixtures(fixtures: FplFixture[]) {
  const now = new Date().toISOString();
  await batch(
    fixtures.map((f) => ({
      sql: `INSERT INTO fixtures (fpl_id, gameweek, kickoff, home_team, away_team, home_score, away_score, status, minutes, home_difficulty, away_difficulty, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fpl', ?)
            ON CONFLICT(fpl_id) DO UPDATE SET
              gameweek = excluded.gameweek, kickoff = excluded.kickoff,
              home_team = excluded.home_team, away_team = excluded.away_team,
              minutes = excluded.minutes, home_difficulty = excluded.home_difficulty, away_difficulty = excluded.away_difficulty,
              home_score = CASE WHEN fixtures.manual_result = 1 THEN fixtures.home_score ELSE excluded.home_score END,
              away_score = CASE WHEN fixtures.manual_result = 1 THEN fixtures.away_score ELSE excluded.away_score END,
              status = CASE WHEN fixtures.manual_result = 1 THEN fixtures.status ELSE excluded.status END,
              updated_at = excluded.updated_at`,
      args: [
        f.id, f.event, f.kickoff_time, f.team_h, f.team_a, f.team_h_score, f.team_a_score, fplStatus(f), f.minutes ?? 0,
        f.team_h_difficulty ?? null, f.team_a_difficulty ?? null, now,
      ],
    })),
  );
}

let inflight: Promise<void> | null = null;

/** Pull teams/gameweeks/fixtures from FPL into our DB, throttled by the cache TTLs. */
export function syncFromFpl(force = false): Promise<void> {
  if (!inflight) {
    inflight = doSync(force).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function doSync(force: boolean) {
  const boot = await cached<Bootstrap>("/bootstrap-static/", 6 * 60 * MIN, force);
  if (boot.data) await saveBootstrap(boot.data);
  const fx = await cached<FplFixture[]>("/fixtures/", await fixturesTtl(), force);
  if (fx.data) await saveFixtures(fx.data);

  const haveTeams = await get("SELECT 1 FROM teams LIMIT 1");
  const haveFixtures = await get("SELECT 1 FROM fixtures WHERE source = 'fpl' LIMIT 1");
  if (!haveTeams) await saveBootstrap(snapshot.bootstrap as Bootstrap);
  if (!haveFixtures) await saveFixtures(snapshot.fixtures as FplFixture[]);
  if (boot.data || fx.data) await run("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)", [new Date().toISOString()]);
}

export async function lastSync(): Promise<string | null> {
  const row = await get<{ value: string }>("SELECT value FROM meta WHERE key = 'last_sync'");
  return row?.value ?? null;
}

export async function cacheInfo() {
  return all<{ key: string; fetched_at: number }>("SELECT key, fetched_at FROM api_cache ORDER BY key");
}
