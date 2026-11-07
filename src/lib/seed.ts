import crypto from "node:crypto";
import { all, batch, get, run } from "./db";
import { hashPin } from "./auth";
import { isLocked, type Fixture } from "./game";
import { guessPick, homeEdge, type Pick } from "./scouting";
import { outcome, type Outcome } from "./scoring";

export const DEMO_INVITE = "MATES26";
export const DEMO_LEAGUE_NAME = "The Group Chat League";

/** True when demo seeding is on and this is the seeded demo league (real invite codes are 6 chars, so they can't collide). */
export const isDemoLeague = (league: { invite_code: string }) => process.env.SEED_DEMO !== "false" && league.invite_code === DEMO_INVITE;

function demoPin() {
  const pin = process.env.DEMO_PIN?.trim();
  if (pin && /^\d{4,8}$/.test(pin)) return { pin, fromEnv: true };
  return { pin: String(crypto.randomInt(100000, 1000000)), fromEnv: false };
}

/** DEMO_PIN is the source of truth for the seeded demo players, so changing it and redeploying takes effect without a reset. */
/** Login fallback for the seeded demo players, so DEMO_PIN works even if the stored hash is stale. */
export function matchesDemoPin(league: { invite_code: string }, name: string, pin: string) {
  const envPin = process.env.DEMO_PIN?.trim();
  if (!envPin || !/^\d{4,8}$/.test(envPin) || !isDemoLeague(league)) return false;
  if (!isDemoPersona(name)) return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(envPin);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const isDemoPersona = (name: string) => PERSONAS.some((p) => p.name.toLowerCase() === name.toLowerCase());

export async function applyDemoPin() {
  const raw = process.env.DEMO_PIN;
  const pin = raw?.trim();
  if (!pin || !/^\d{4,8}$/.test(pin)) {
    console.warn(`[demo] DEMO_PIN ${raw === undefined ? "is not set" : `is not 4-8 digits (${raw.length} chars)`}; demo PINs unchanged`);
    return;
  }
  const res = await run(
    `UPDATE users SET pin_hash = ? WHERE league_id = (SELECT id FROM leagues WHERE invite_code = ?) AND name IN (${PERSONAS.map(() => "?").join(", ")})`,
    [hashPin(pin), DEMO_INVITE, ...PERSONAS.map((p) => p.name)],
  );
  console.log(`[demo] DEMO_PIN applied to ${res.rowsAffected} demo players`);
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Persona = {
  name: string;
  insight: number; // chance they read the actual result
  exact: number; // chance they nail the exact score
  outcome: (f: Fixture, r: () => number) => Outcome;
  win: number[][];
  draw: number[];
};

const fav = (f: Fixture): Outcome => (homeEdge(f) > 0 ? "H" : "A");
const MUN = "MUN";

const PERSONAS: Persona[] = [
  { name: "Conor", insight: 0.5, exact: 0.12, win: [[1, 0], [2, 1], [2, 0], [2, 1]], draw: [1, 1, 0],
    outcome: (f, r) => (Math.abs(homeEdge(f)) < 1 && r() < 0.3 ? "D" : fav(f)) },
  { name: "Ollie", insight: 0.35, exact: 0.04, win: [[3, 1], [3, 2], [4, 2], [2, 1], [4, 1]], draw: [2, 2, 3],
    outcome: (f, r) => (r() < 0.12 ? "D" : fav(f)) },
  { name: "Dave", insight: 0.25, exact: 0.08, win: [[2, 1], [1, 0]], draw: [1, 1, 1, 0, 2],
    outcome: (f, r) => (r() < 0.5 ? "D" : fav(f)) },
  { name: "Niamh", insight: 0.35, exact: 0.1, win: [[1, 0], [1, 0], [2, 0]], draw: [0, 0, 1],
    outcome: (f, r) => (r() < 0.35 ? "D" : fav(f)) },
  { name: "Barry", insight: 0.3, exact: 0.06, win: [[2, 0], [2, 1], [3, 1], [3, 0]], draw: [1],
    outcome: (f, r) => (f.home_short === MUN ? "H" : f.away_short === MUN ? "A" : r() < 0.75 ? "H" : r() < 0.5 ? "D" : "A") },
  { name: "Aoife", insight: 0.3, exact: 0.06, win: [[2, 1], [1, 0], [3, 1]], draw: [1, 2],
    outcome: (f, r) => (r() < 0.5 ? "A" : r() < 0.3 ? "D" : fav(f)) },
];

function pickFor(p: Persona, f: Fixture, r: () => number) {
  const known = f.status === "finished" && f.home_score != null;
  if (known && r() < p.exact) return { home: f.home_score!, away: f.away_score! };
  const o: Outcome = known && r() < p.insight ? outcome(f.home_score!, f.away_score!) : p.outcome(f, r);
  if (o === "D") {
    const g = p.draw[Math.floor(r() * p.draw.length)];
    return { home: g, away: g };
  }
  const [hi, lo] = p.win[Math.floor(r() * p.win.length)];
  return o === "H" ? { home: hi, away: lo } : { home: lo, away: hi };
}

export async function seedDemo() {
  const r = rng(20261107);
  const cur = await get<{ gw: number | null }>(
    "SELECT MIN(gameweek) AS gw FROM fixtures WHERE league_id IS NULL AND status NOT IN ('finished', 'postponed')",
  );
  const currentGw = Math.max(5, cur?.gw ?? 5);
  const startGw = currentGw - 4;

  const { pin, fromEnv } = demoPin();
  const pinHash = hashPin(pin);
  // Everything goes in one atomic batch, so concurrent cold starts never see a half-seeded league.
  const LEAGUE = "(SELECT id FROM leagues WHERE invite_code = ?)";
  const USER = "(SELECT u.id FROM users u JOIN leagues l ON l.id = u.league_id WHERE l.invite_code = ? AND u.name = ?)";
  const stmts: { sql: string; args: (number | string)[] }[] = [
    {
      sql: "INSERT INTO leagues (name, invite_code, start_gw, season_end_date, fee_cents) VALUES (?, ?, ?, ?, 500)",
      args: [DEMO_LEAGUE_NAME, DEMO_INVITE, startGw, "2027-05-23"],
    },
    ...PERSONAS.map((p) => ({
      sql: `INSERT INTO users (league_id, name, pin_hash, is_admin, joined_gw) VALUES (${LEAGUE}, ?, ?, ?, ?)`,
      args: [DEMO_INVITE, p.name, pinHash, p.name === "Conor" ? 1 : 0, startGw],
    })),
  ];

  const fixtures = await all<Fixture>(
    `SELECT f.*, h.name AS home_name, h.short_name AS home_short, a.name AS away_name, a.short_name AS away_short
     FROM fixtures f JOIN teams h ON h.id = f.home_team JOIN teams a ON a.id = f.away_team
     WHERE f.league_id IS NULL AND f.gameweek BETWEEN ? AND ? ORDER BY f.gameweek, f.kickoff`,
    [startGw, currentGw],
  );

  const history = new Map<string, Pick[]>();
  for (let gw = startGw; gw <= currentGw; gw++) {
    const gwFixtures = fixtures.filter((f) => f.gameweek === gw);
    if (!gwFixtures.length) continue;
    const wildcard = gwFixtures[Math.floor(r() * gwFixtures.length)];
    stmts.push({ sql: `INSERT INTO wildcards (league_id, gameweek, fixture_id) VALUES (${LEAGUE}, ?, ?)`, args: [DEMO_INVITE, gw, wildcard.id] });

    const newPicks: [string, Pick][] = [];
    for (const persona of PERSONAS) {
      const user = [DEMO_INVITE, persona.name];
      // Current gameweek: everyone has picked the locked matches; a few have got their open picks in early.
      if (gw === currentGw && persona.name === "Conor") {
        if (!gwFixtures.some((f) => isLocked(f))) continue;
      }
      for (const f of gwFixtures) {
        if (gw === currentGw && !isLocked(f) && (persona.name === "Conor" || persona.name === "Ollie" || r() < 0.4)) continue;
        const pick = pickFor(persona, f, r);
        const guess = guessPick(history.get(persona.name) ?? [], f);
        stmts.push({ sql: `INSERT INTO predictor_guesses (user_id, fixture_id, home, away) VALUES (${USER}, ?, ?, ?)`, args: [...user, f.id, guess.home, guess.away] });
        stmts.push({ sql: `INSERT INTO predictions (user_id, fixture_id, home, away) VALUES (${USER}, ?, ?, ?)`, args: [...user, f.id, pick.home, pick.away] });
        newPicks.push([persona.name, { ...pick, fixture: f }]);
      }
      const unpaid =
        (persona.name === "Ollie" && gw >= currentGw - 2) ||
        (persona.name === "Barry" && gw === currentGw - 1) ||
        (gw === currentGw && ["Aoife", "Barry"].includes(persona.name));
      stmts.push({ sql: `INSERT INTO payments (user_id, gameweek, paid) VALUES (${USER}, ?, ?)`, args: [...user, gw, unpaid ? 0 : 1] });
    }
    for (const [name, pick] of newPicks) history.set(name, [...(history.get(name) ?? []), pick]);
  }
  try {
    await batch(stmts);
  } catch (e) {
    // Another instance seeded it first; its batch won and ours rolled back.
    if (await get("SELECT id FROM leagues WHERE invite_code = ?", [DEMO_INVITE])) return;
    throw e;
  }
  console.log(`[seed] Demo league "${DEMO_INVITE}" created: GW${startGw}-${currentGw}, ${PERSONAS.length} players, PIN ${fromEnv ? "from DEMO_PIN" : `${pin} (random; set DEMO_PIN to choose one)`}`);
}
