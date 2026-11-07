import type { LeagueData } from "./game";
import { isLocked } from "./game";
import { picksFor } from "./predictor";
import { scoutingReport } from "./scouting";

export function reportFor(data: LeagueData, userId: number) {
  // Only locked picks: never leak a mate's open predictions through their scouting report.
  const picks = picksFor(data, userId, (f) => isLocked(f));
  const lockedIds = new Set(picks.map((p) => p.fixture.id));
  const guesses = data.guesses.filter((g) => g.user_id === userId && lockedIds.has(g.fixture_id));
  const predictions = data.predictions.filter((p) => p.user_id === userId && lockedIds.has(p.fixture_id));
  return scoutingReport(picks, guesses, predictions);
}

export function optimismLabel(o: number) {
  if (o >= 140) return { emoji: "🚀", tone: "text-fuchsia-300" };
  if (o >= 110) return { emoji: "😁", tone: "text-lime-300" };
  if (o >= 90) return { emoji: "🙂", tone: "text-sky-300" };
  if (o >= 60) return { emoji: "😐", tone: "text-amber-300" };
  return { emoji: "🌧️", tone: "text-slate-300" };
}
