import { all, batch } from "./db";
import { isLocked, type Fixture, type LeagueData } from "./game";
import { guessPick, type Pick } from "./scouting";

export function picksFor(data: LeagueData, userId: number, filter: (f: Fixture) => boolean = () => true): Pick[] {
  const byId = new Map(data.fixtures.map((f) => [f.id, f]));
  return data.predictions
    .filter((p) => p.user_id === userId && byId.has(p.fixture_id) && filter(byId.get(p.fixture_id)!))
    .map((p) => ({ home: p.home, away: p.away, fixture: byId.get(p.fixture_id)! }));
}

/** Snapshot the app's guess for each open fixture the player hasn't picked yet, so it can be scored later. */
export async function ensureGuesses(data: LeagueData, userId: number, gw: number) {
  const fixtures = data.fixtures.filter((f) => f.gameweek === gw && !isLocked(f));
  const have = new Set(data.guesses.filter((g) => g.user_id === userId).map((g) => g.fixture_id));
  const picked = new Set(data.predictions.filter((p) => p.user_id === userId).map((p) => p.fixture_id));
  const todo = fixtures.filter((f) => !have.has(f.id) && !picked.has(f.id));
  if (todo.length) {
    const history = picksFor(data, userId, (f) => f.gameweek !== gw);
    await batch(
      todo.map((f) => {
        const g = guessPick(history, f);
        return { sql: "INSERT OR IGNORE INTO predictor_guesses (user_id, fixture_id, home, away) VALUES (?, ?, ?, ?)", args: [userId, f.id, g.home, g.away] };
      }),
    );
  }
  return all<{ fixture_id: number; home: number; away: number }>(
    "SELECT fixture_id, home, away FROM predictor_guesses WHERE user_id = ?",
    [userId],
  );
}
