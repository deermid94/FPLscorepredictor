import { createClient, type Client, type InStatement, type InValue } from "@libsql/client";

let client: Client | null = null;

function databaseUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  // Vercel's filesystem is read-only except /tmp: an ephemeral demo DB that reseeds on cold start.
  if (process.env.VERCEL) return "file:/tmp/score-predictor.db";
  return "file:local.db";
}

export function db(): Client {
  if (!client) {
    client = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

export type Row = Record<string, InValue>;

export async function all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const res = await db().execute({ sql, args });
  return res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]]))) as T[];
}

export async function get<T = Row>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InValue[] = []) {
  return db().execute({ sql, args });
}

export async function batch(stmts: InStatement[]) {
  if (stmts.length) await db().batch(stmts, "write");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  start_gw INTEGER NOT NULL,
  season_end_date TEXT,
  fee_cents INTEGER NOT NULL DEFAULT 500,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  name TEXT NOT NULL COLLATE NOCASE,
  pin_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  joined_gw INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (league_id, name)
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY,
  code INTEGER,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gameweeks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  deadline TEXT
);
CREATE TABLE IF NOT EXISTS fixtures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fpl_id INTEGER UNIQUE,
  gameweek INTEGER,
  kickoff TEXT,
  home_team INTEGER NOT NULL REFERENCES teams(id),
  away_team INTEGER NOT NULL REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  minutes INTEGER NOT NULL DEFAULT 0,
  home_difficulty INTEGER,
  away_difficulty INTEGER,
  manual_result INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'fpl',
  league_id INTEGER REFERENCES leagues(id),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS fixtures_gw ON fixtures(gameweek);
CREATE TABLE IF NOT EXISTS result_overrides (
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  home INTEGER NOT NULL,
  away INTEGER NOT NULL,
  updated_at TEXT,
  PRIMARY KEY (league_id, fixture_id)
);
CREATE TABLE IF NOT EXISTS predictions (
  user_id INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  home INTEGER NOT NULL,
  away INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, fixture_id)
);
CREATE TABLE IF NOT EXISTS predictor_guesses (
  user_id INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  home INTEGER NOT NULL,
  away INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, fixture_id)
);
CREATE TABLE IF NOT EXISTS wildcards (
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  gameweek INTEGER NOT NULL,
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  PRIMARY KEY (league_id, gameweek)
);
CREATE TABLE IF NOT EXISTS payments (
  user_id INTEGER NOT NULL REFERENCES users(id),
  gameweek INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, gameweek)
);
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

/** Upgrade DBs created before manual results/fixtures became league-scoped. */
async function migrate() {
  const cols = await all<{ name: string }>("PRAGMA table_info(fixtures)");
  if (cols.some((c) => c.name === "league_id")) return;
  await batch([
    "ALTER TABLE fixtures ADD COLUMN league_id INTEGER REFERENCES leagues(id)",
    `INSERT OR IGNORE INTO result_overrides (league_id, fixture_id, home, away, updated_at)
       SELECT l.id, f.id, f.home_score, f.away_score, f.updated_at FROM fixtures f, leagues l
       WHERE f.manual_result = 1 AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL`,
    "UPDATE fixtures SET home_score = NULL, away_score = NULL, status = 'scheduled' WHERE manual_result = 1 AND source = 'manual'",
    "UPDATE fixtures SET manual_result = 0, updated_at = NULL WHERE manual_result = 1",
    "DELETE FROM api_cache WHERE key = '/fixtures/'",
  ]);
}

let ready: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db().executeMultiple(SCHEMA);
      await migrate();
      const { syncFromFpl } = await import("./fpl");
      await syncFromFpl();
      if (process.env.SEED_DEMO !== "false") {
        const { DEMO_INVITE, seedDemo } = await import("./seed");
        if (!(await get("SELECT id FROM leagues WHERE invite_code = ?", [DEMO_INVITE]))) await seedDemo();
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
