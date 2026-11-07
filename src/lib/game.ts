import crypto from "node:crypto";
import { all, get, run } from "./db";
import { rank, scorePrediction, splitPot, splitPrizes, wrongness } from "./scoring";

export type League = {
  id: number;
  name: string;
  invite_code: string;
  start_gw: number;
  season_end_date: string | null;
  fee_cents: number;
};
export type Player = { id: number; name: string; is_admin: number; joined_gw: number };
export type Fixture = {
  id: number;
  fpl_id: number | null;
  gameweek: number | null;
  kickoff: string | null;
  home_team: number;
  away_team: number;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  minutes: number;
  home_difficulty: number | null;
  away_difficulty: number | null;
  /** 1 when this league's admin has overridden the result. */
  manual_result: number;
  source: string;
  /** Owning league for manually added fixtures; null for shared FPL fixtures. */
  league_id: number | null;
  home_name: string;
  home_short: string;
  home_code: number | null;
  away_name: string;
  away_short: string;
  away_code: number | null;
};
export type Prediction = { user_id: number; fixture_id: number; home: number; away: number; updated_at: string };

/**
 * FPL fixtures are shared by every league; manual fixtures and manual results are per-league.
 * Takes the league id twice as its first two args.
 */
const FIXTURE_SELECT = `
  SELECT f.id, f.fpl_id, f.gameweek, f.kickoff, f.home_team, f.away_team,
         COALESCE(o.home, f.home_score) AS home_score, COALESCE(o.away, f.away_score) AS away_score,
         CASE WHEN o.fixture_id IS NULL THEN f.status ELSE 'finished' END AS status,
         f.minutes, f.home_difficulty, f.away_difficulty,
         CASE WHEN o.fixture_id IS NULL THEN 0 ELSE 1 END AS manual_result,
         f.source, f.league_id, f.updated_at,
         h.name AS home_name, h.short_name AS home_short, h.code AS home_code,
         a.name AS away_name, a.short_name AS away_short, a.code AS away_code
  FROM fixtures f JOIN teams h ON h.id = f.home_team JOIN teams a ON a.id = f.away_team
  LEFT JOIN result_overrides o ON o.fixture_id = f.id AND o.league_id = ?
  WHERE (f.league_id IS NULL OR f.league_id = ?)`;

export const isLocked = (f: Pick<Fixture, "status" | "kickoff">, now = new Date()) =>
  f.status !== "scheduled" || !f.kickoff || new Date(f.kickoff) <= now;

export const isFinal = (f: Fixture) => f.status === "finished" && f.home_score != null && f.away_score != null;

export async function getLeague(id: number) {
  return (await get<League>("SELECT * FROM leagues WHERE id = ?", [id]))!;
}

export async function getPlayers(leagueId: number) {
  return all<Player>("SELECT id, name, is_admin, joined_gw FROM users WHERE league_id = ? ORDER BY name", [leagueId]);
}

export async function getTeams() {
  return all<{ id: number; name: string; short_name: string }>("SELECT id, name, short_name FROM teams ORDER BY name");
}

export async function fixturesForGw(leagueId: number, gw: number) {
  return all<Fixture>(`${FIXTURE_SELECT} AND f.gameweek = ? ORDER BY f.kickoff, f.id`, [leagueId, leagueId, gw]);
}

export async function getFixture(leagueId: number, id: number) {
  return get<Fixture>(`${FIXTURE_SELECT} AND f.id = ?`, [leagueId, leagueId, id]);
}

/** The earliest gameweek (from the league's start) that still has matches to play. */
export async function currentGw(league: League) {
  const row = await get<{ gw: number | null }>(
    `SELECT MIN(gameweek) AS gw FROM fixtures
     WHERE gameweek >= ? AND status NOT IN ('finished', 'postponed') AND (league_id IS NULL OR league_id = ?)
       AND id NOT IN (SELECT fixture_id FROM result_overrides WHERE league_id = ?)`,
    [league.start_gw, league.id, league.id],
  );
  if (row?.gw) return row.gw;
  const last = await get<{ gw: number | null }>("SELECT MAX(gameweek) AS gw FROM fixtures");
  return Math.max(league.start_gw, last?.gw ?? league.start_gw);
}

export async function maxGw() {
  const row = await get<{ gw: number | null }>("SELECT MAX(gameweek) AS gw FROM fixtures");
  return row?.gw ?? 38;
}

/** Wildcard is drawn at random the first time a gameweek's picks are opened, preferring unlocked matches. */
export async function getWildcard(leagueId: number, gw: number, create = true): Promise<number | null> {
  const existing = await get<{ fixture_id: number }>(
    "SELECT fixture_id FROM wildcards WHERE league_id = ? AND gameweek = ?",
    [leagueId, gw],
  );
  if (existing || !create) return existing?.fixture_id ?? null;
  const fixtures = await fixturesForGw(leagueId, gw);
  if (!fixtures.length) return null;
  const open = fixtures.filter((f) => !isLocked(f));
  const pool = open.length ? open : fixtures;
  const pick = pool[crypto.randomInt(pool.length)];
  await run("INSERT OR IGNORE INTO wildcards (league_id, gameweek, fixture_id) VALUES (?, ?, ?)", [leagueId, gw, pick.id]);
  return getWildcard(leagueId, gw, false);
}

export type LeagueData = Awaited<ReturnType<typeof loadLeagueData>>;

export async function loadLeagueData(league: League) {
  const [players, fixtures, predictions, wildcardRows, payments, guesses] = await Promise.all([
    getPlayers(league.id),
    all<Fixture>(`${FIXTURE_SELECT} AND f.gameweek >= ? ORDER BY f.kickoff, f.id`, [league.id, league.id, league.start_gw]),
    all<Prediction>(
      "SELECT p.* FROM predictions p JOIN users u ON u.id = p.user_id WHERE u.league_id = ?",
      [league.id],
    ),
    all<{ gameweek: number; fixture_id: number }>("SELECT gameweek, fixture_id FROM wildcards WHERE league_id = ?", [league.id]),
    all<{ user_id: number; gameweek: number; paid: number }>(
      "SELECT pm.* FROM payments pm JOIN users u ON u.id = pm.user_id WHERE u.league_id = ?",
      [league.id],
    ),
    all<{ user_id: number; fixture_id: number; home: number; away: number }>(
      "SELECT g.* FROM predictor_guesses g JOIN users u ON u.id = g.user_id WHERE u.league_id = ?",
      [league.id],
    ),
  ]);
  const wildcards = new Map(wildcardRows.map((w) => [w.gameweek, w.fixture_id]));
  const predByKey = new Map(predictions.map((p) => [`${p.user_id}:${p.fixture_id}`, p]));
  return { league, players, fixtures, predictions, predByKey, wildcards, payments, guesses };
}

export type ShameEntry = { player: Player; fixture: Fixture; pred: Prediction; wildcard: boolean; score: number };

export function gameweekTable(data: LeagueData, gw: number) {
  const { league, players, predByKey, wildcards } = data;
  const fixtures = data.fixtures.filter((f) => f.gameweek === gw);
  const participants = players.filter((p) => p.joined_gw <= gw);
  const wildcardId = wildcards.get(gw) ?? null;
  const complete = fixtures.length > 0 && fixtures.every(isFinal);
  const started = fixtures.some((f) => isLocked(f));

  let shame: ShameEntry | null = null;
  const rows = participants.map((player) => {
    let points = 0;
    let exacts = 0;
    let results = 0;
    let predicted = 0;
    for (const f of fixtures) {
      const pred = predByKey.get(`${player.id}:${f.id}`);
      if (!pred) continue;
      predicted++;
      if (!isFinal(f)) continue;
      const actual = { home: f.home_score!, away: f.away_score! };
      const s = scorePrediction(pred, actual, f.id === wildcardId);
      points += s.points;
      if (s.exact) exacts++;
      if (s.result) results++;
      const w = wrongness(pred, actual) * (f.id === wildcardId ? 1.5 : 1);
      if (w > 0 && (!shame || w > shame.score)) shame = { player, fixture: f, pred, wildcard: f.id === wildcardId, score: w };
    }
    return { player, points, exacts, results, predicted };
  });

  const potCents = participants.length * league.fee_cents;
  const { awards, rolloverCents } = splitPrizes(
    rows.map((r) => ({ userId: r.player.id, points: r.points })),
    potCents,
  );
  const ranked = rank(rows, (r) => r.points * 1000 + r.exacts).map((r) => ({
    ...r,
    rank: rank(rows, (x) => x.points).find((x) => x.player.id === r.player.id)!.rank,
    prizeCents: awards.get(r.player.id) ?? 0,
  }));
  return {
    gw,
    fixtures,
    wildcardId,
    complete,
    started,
    potCents,
    rolloverCents,
    rows: ranked,
    shame: shame as ShameEntry | null,
  };
}

export function seasonEnded(league: League, now = new Date()) {
  return !!league.season_end_date && now >= new Date(`${league.season_end_date}T23:59:59Z`);
}

export function seasonTable(data: LeagueData, uptoGw: number) {
  const { league, players } = data;
  const end = league.season_end_date ? new Date(`${league.season_end_date}T23:59:59Z`) : null;
  const weeks = [];
  for (let gw = league.start_gw; gw <= uptoGw; gw++) weeks.push(gameweekTable(data, gw));

  // Gameweeks fully played before the season end date count towards the pot and the title.
  const counted = weeks.filter((w) => {
    if (!end) return true;
    const last = w.fixtures.reduce((m, f) => (f.kickoff && f.kickoff > m ? f.kickoff : m), "");
    return !last || new Date(last) <= end;
  });
  const potCents = counted.filter((w) => w.complete).reduce((s, w) => s + w.rolloverCents, 0);

  const totals = players.map((player) => {
    let points = 0, exacts = 0, results = 0, winningsCents = 0, weeklyWins = 0;
    const byWeek: Record<number, number> = {};
    for (const w of counted) {
      const r = w.rows.find((x) => x.player.id === player.id);
      if (!r) continue;
      points += r.points;
      exacts += r.exacts;
      results += r.results;
      byWeek[w.gw] = r.points;
      if (w.complete) {
        winningsCents += r.prizeCents;
        if (r.rank === 1) weeklyWins++;
      }
    }
    return { player, points, exacts, results, winningsCents, weeklyWins, byWeek };
  });

  const ended = seasonEnded(league);
  const potAwards = ended ? splitPot(totals.map((t) => ({ userId: t.player.id, points: t.points })), potCents) : new Map();
  const ranked = rank(totals, (t) => t.points).map((t) => ({ ...t, potCents: potAwards.get(t.player.id) ?? 0 }));
  return { weeks, counted, potCents, ended, rows: ranked };
}

export function ledger(data: LeagueData, uptoGw: number) {
  const season = seasonTable(data, uptoGw);
  const paid = new Map(data.payments.map((p) => [`${p.user_id}:${p.gameweek}`, !!p.paid]));
  const rows = season.rows.map((r) => {
    const weeks = season.weeks
      .filter((w) => r.player.joined_gw <= w.gw)
      .map((w) => ({
        gw: w.gw,
        paid: paid.get(`${r.player.id}:${w.gw}`) ?? false,
        wonCents: w.complete ? (w.rows.find((x) => x.player.id === r.player.id)?.prizeCents ?? 0) : 0,
        complete: w.complete,
      }));
    const owedCents = weeks.length * data.league.fee_cents;
    const paidCents = weeks.filter((w) => w.paid).length * data.league.fee_cents;
    const wonCents = r.winningsCents + r.potCents;
    return { player: r.player, weeks, owedCents, paidCents, outstandingCents: owedCents - paidCents, wonCents, netCents: wonCents - owedCents };
  });
  return { season, rows };
}
