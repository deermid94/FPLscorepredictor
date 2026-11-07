import type { Fixture, Prediction } from "./game";
import { isFinal } from "./game";
import { outcome, type Outcome } from "./scoring";

export type Pick = { home: number; away: number; fixture: Fixture };

/** Positive = home side favoured. Uses FPL difficulty (lower = easier game) plus half a point home advantage. */
export function homeEdge(f: Pick["fixture"] | Fixture) {
  return (f.away_difficulty ?? 3) - (f.home_difficulty ?? 3) + 0.5;
}

function mode<T>(items: T[], key: (t: T) => string): { key: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1);
  let best: { key: string; count: number } | null = null;
  for (const [k, c] of counts) if (!best || c > best.count) best = { key: k, count: c };
  return best;
}

function teamWinBias(picks: Pick[]) {
  const teams = new Map<number, { name: string; matches: number; predictedWins: number; actualWins: number }>();
  for (const p of picks.filter((x) => isFinal(x.fixture))) {
    const f = p.fixture;
    for (const side of ["home", "away"] as const) {
      const id = side === "home" ? f.home_team : f.away_team;
      const name = side === "home" ? f.home_name : f.away_name;
      const t = teams.get(id) ?? { name, matches: 0, predictedWins: 0, actualWins: 0 };
      const want: Outcome = side === "home" ? "H" : "A";
      t.matches++;
      if (outcome(p.home, p.away) === want) t.predictedWins++;
      if (outcome(f.home_score!, f.away_score!) === want) t.actualWins++;
      teams.set(id, t);
    }
  }
  return [...teams.entries()]
    .map(([id, t]) => ({ id, ...t, bias: (t.predictedWins - t.actualWins) / t.matches }))
    .filter((t) => t.matches >= 2 && t.predictedWins - t.actualWins >= 2)
    .sort((a, b) => b.bias - a.bias || b.predictedWins - a.predictedWins);
}

/** "Predict the Predictor": guess a player's next pick from their history. */
export function guessPick(history: Pick[], f: Fixture): { home: number; away: number } {
  const edge = homeEdge(f);
  const close = Math.abs(edge) < 1;
  const orient = (winner: Outcome, [hi, lo]: number[]) =>
    winner === "H" ? { home: hi, away: lo } : winner === "A" ? { home: lo, away: hi } : { home: hi, away: hi };

  if (!history.length) return close ? { home: 1, away: 1 } : orient(edge > 0 ? "H" : "A", [2, 1]);

  const draws = history.filter((p) => p.home === p.away);
  const wins = history.filter((p) => p.home !== p.away);
  const drawRate = draws.length / history.length;
  const winScore = (mode(wins, (p) => `${Math.max(p.home, p.away)}-${Math.min(p.home, p.away)}`)?.key ?? "2-1")
    .split("-")
    .map(Number);
  const drawGoals = Number(mode(draws, (p) => String(p.home))?.key ?? 1);

  const backed = teamWinBias(history)[0];
  if (backed && backed.predictedWins / backed.matches >= 0.75) {
    if (f.home_team === backed.id) return orient("H", winScore);
    if (f.away_team === backed.id) return orient("A", winScore);
  }
  if (drawRate >= 0.4 || (close && drawRate >= 0.25)) return { home: drawGoals, away: drawGoals };

  const decisive = history.filter((p) => Math.abs(homeEdge(p.fixture)) >= 1 && p.home !== p.away);
  const underdogPicks = decisive.filter((p) => (homeEdge(p.fixture) > 0 ? p.away > p.home : p.home > p.away)).length;
  const homePicks = wins.filter((p) => p.home > p.away).length;
  let winner: Outcome = edge > 0 ? "H" : "A";
  if (decisive.length >= 4 && underdogPicks / decisive.length > 0.5) winner = winner === "H" ? "A" : "H";
  else if (close && wins.length >= 4) winner = homePicks / wins.length >= 0.5 ? "H" : "A";
  return orient(winner, winScore);
}

export function scoutingReport(
  picks: Pick[],
  guesses: { fixture_id: number; home: number; away: number }[],
  predictions: Prediction[],
) {
  const n = picks.length;
  const finished = picks.filter((p) => isFinal(p.fixture));
  const fav = mode(picks, (p) => `${p.home}-${p.away}`);

  const rate = (list: { o: Outcome }[], o: Outcome) => (list.length ? list.filter((x) => x.o === o).length / list.length : 0);
  const predO = finished.map((p) => ({ o: outcome(p.home, p.away) }));
  const actO = finished.map((p) => ({ o: outcome(p.fixture.home_score!, p.fixture.away_score!) }));
  const outcomes = (["H", "D", "A"] as Outcome[]).map((o) => ({ o, predicted: rate(predO, o), actual: rate(actO, o) }));

  const avgPred = finished.length ? finished.reduce((s, p) => s + p.home + p.away, 0) / finished.length : 0;
  const avgActual = finished.length
    ? finished.reduce((s, p) => s + p.fixture.home_score! + p.fixture.away_score!, 0) / finished.length
    : 0;
  const optimism = avgActual ? Math.round((avgPred / avgActual) * 100) : 100;
  const zeroZero = picks.filter((p) => p.home === 0 && p.away === 0).length;
  const draws = picks.filter((p) => p.home === p.away).length;
  const correct = finished.filter((p) => outcome(p.home, p.away) === outcome(p.fixture.home_score!, p.fixture.away_score!));
  const exact = finished.filter((p) => p.home === p.fixture.home_score && p.away === p.fixture.away_score);
  const overBacked = teamWinBias(picks)[0] ?? null;

  const predMap = new Map(predictions.map((p) => [p.fixture_id, p]));
  const judged = guesses.filter((g) => predMap.has(g.fixture_id));
  const guessExact = judged.filter((g) => predMap.get(g.fixture_id)!.home === g.home && predMap.get(g.fixture_id)!.away === g.away);
  const guessResult = judged.filter(
    (g) => outcome(g.home, g.away) === outcome(predMap.get(g.fixture_id)!.home, predMap.get(g.fixture_id)!.away),
  );

  const stats: Stats = {
    n,
    finished: finished.length,
    favourite: fav,
    outcomes,
    homeBias: outcomes[0].predicted - outcomes[0].actual,
    awayBias: outcomes[2].predicted - outcomes[2].actual,
    drawBias: outcomes[1].predicted - outcomes[1].actual,
    avgPred,
    avgActual,
    optimism,
    zeroZero,
    draws,
    drawRate: n ? draws / n : 0,
    resultRate: finished.length ? correct.length / finished.length : 0,
    exactCount: exact.length,
    overBacked,
    predictor: { judged: judged.length, exact: guessExact.length, result: guessResult.length },
  };
  return { ...stats, profile: profileLine(stats) };
}

type Stats = {
  n: number;
  finished: number;
  favourite: { key: string; count: number } | null;
  outcomes: { o: Outcome; predicted: number; actual: number }[];
  homeBias: number;
  awayBias: number;
  drawBias: number;
  avgPred: number;
  avgActual: number;
  optimism: number;
  zeroZero: number;
  draws: number;
  drawRate: number;
  resultRate: number;
  exactCount: number;
  overBacked: ReturnType<typeof teamWinBias>[number] | null;
  predictor: { judged: number; exact: number; result: number };
};

function profileLine(s: Stats): string {
  if (s.n < 3) return "Mystery signing. Not enough picks to read them yet.";
  const traits: { weight: number; line: string }[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (s.optimism >= 120) traits.push({ weight: s.optimism - 100, line: `Chronic optimist. Expects ${s.avgPred.toFixed(1)} goals a game; reality serves ${s.avgActual.toFixed(1)}.` });
  if (s.optimism <= 80) traits.push({ weight: 100 - s.optimism, line: "Pessimist. Treats every fixture like a wet Tuesday in Stoke." });
  if (s.drawBias >= 0.15) traits.push({ weight: s.drawBias * 100, line: `Fence-sitter. Calls ${pct(s.drawRate)} of games a draw.` });
  if (s.overBacked && s.overBacked.bias >= 0.6 && s.overBacked.predictedWins - s.overBacked.actualWins >= 3)
    traits.push({ weight: s.overBacked.bias * 60, line: `Wears ${s.overBacked.name}-tinted glasses. Backed them to win ${s.overBacked.predictedWins} of ${s.overBacked.matches}; they won ${s.overBacked.actualWins}.` });
  if (s.homeBias >= 0.2) traits.push({ weight: s.homeBias * 100, line: "Home banker. Thinks away teams should stay on the bus." });
  if (s.awayBias >= 0.15) traits.push({ weight: s.awayBias * 100, line: "Contrarian. Lives for an away-day smash and grab." });
  if (s.finished >= 8 && s.exactCount / s.finished >= 0.15) traits.push({ weight: (s.exactCount / s.finished - 0.1) * 100, line: "Spooky. Nails exact scores like they've seen the tape." });
  if (s.finished >= 8 && s.resultRate < 0.4) traits.push({ weight: (0.5 - s.resultRate) * 100, line: `A coin would do better. Gets the result right ${pct(s.resultRate)} of the time.` });
  if (s.predictor.judged >= 8 && s.predictor.result / s.predictor.judged >= 0.7) traits.push({ weight: 20, line: `Painfully predictable. The app calls their result ${pct(s.predictor.result / s.predictor.judged)} of the time.` });
  traits.sort((a, b) => b.weight - a.weight);
  let line = traits[0]?.line ?? "Steady Eddie. Sensible to the point of boring.";
  if (s.zeroZero === 0 && s.n >= 10) line += " Has never predicted a 0-0.";
  else if (s.favourite && s.favourite.count / s.n >= 0.3) line += ` Reaches for ${s.favourite.key} like a comfort blanket.`;
  return line;
}
