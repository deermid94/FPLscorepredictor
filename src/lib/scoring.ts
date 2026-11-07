export type Outcome = "H" | "D" | "A";

export const outcome = (h: number, a: number): Outcome => (h > a ? "H" : h < a ? "A" : "D");

export const RESULT_POINTS = 1;
export const EXACT_POINTS = 3;
export const WILDCARD_MULTIPLIER = 2;
export const PRIZE_SLOTS = [0.4, 0.2]; // 1st, 2nd. Remainder rolls into the season pot.

export function scorePrediction(
  pred: { home: number; away: number },
  actual: { home: number; away: number },
  wildcard: boolean,
) {
  const exact = pred.home === actual.home && pred.away === actual.away;
  const result = outcome(pred.home, pred.away) === outcome(actual.home, actual.away);
  const base = exact ? EXACT_POINTS : result ? RESULT_POINTS : 0;
  return { points: wildcard ? base * WILDCARD_MULTIPLIER : base, exact, result };
}

/** Standard competition ranking: 1, 2, 2, 4. */
export function rank<T>(rows: T[], score: (r: T) => number): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => score(b) - score(a));
  return sorted.map((r, i) => ({
    ...r,
    rank: sorted.findIndex((x) => score(x) === score(r)) + 1 || i + 1,
  }));
}

/**
 * Weekly prize split. Tied players pool the prize slots they occupy and split equally,
 * e.g. two tied for 1st share (40% + 20%) / 2 = 30% each. Rounding pennies roll into the pot.
 */
export function splitPrizes(rows: { userId: number; points: number }[], potCents: number) {
  const awards = new Map<number, number>();
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  let pos = 0;
  let distributed = 0;
  while (pos < sorted.length && pos < PRIZE_SLOTS.length) {
    const group = sorted.filter((r) => r.points === sorted[pos].points);
    const share = PRIZE_SLOTS.slice(pos, pos + group.length).reduce((a, b) => a + b, 0);
    const each = Math.floor(Math.floor(potCents * share) / group.length);
    for (const r of group) awards.set(r.userId, each);
    distributed += each * group.length;
    pos += group.length;
  }
  return { awards, rolloverCents: potCents - distributed };
}

/** Season pot: shared equally between everyone tied on the top total. */
export function splitPot(rows: { userId: number; points: number }[], potCents: number) {
  const awards = new Map<number, number>();
  if (!rows.length) return awards;
  const top = Math.max(...rows.map((r) => r.points));
  const winners = rows.filter((r) => r.points === top);
  for (const w of winners) awards.set(w.userId, Math.floor(potCents / winners.length));
  return awards;
}

/** How badly wrong a prediction was. Only wrong-result picks qualify for the Hall of Shame. */
export function wrongness(pred: { home: number; away: number }, actual: { home: number; away: number }) {
  if (outcome(pred.home, pred.away) === outcome(actual.home, actual.away)) return 0;
  const goalMiss = Math.abs(pred.home - actual.home) + Math.abs(pred.away - actual.away);
  const flipped = outcome(pred.home, pred.away) !== "D" && outcome(actual.home, actual.away) !== "D" ? 2 : 0;
  return goalMiss + flipped;
}

export const euro = (cents: number) =>
  `€${(cents / 100).toLocaleString("en-IE", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
