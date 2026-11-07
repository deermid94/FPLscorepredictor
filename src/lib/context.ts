import { requireUser } from "./auth";
import { currentGw, getLeague, loadLeagueData, maxGw } from "./game";

export async function pageContext() {
  const user = await requireUser();
  const league = await getLeague(user.league_id);
  const [cur, max] = await Promise.all([currentGw(league), maxGw()]);
  return { user, league, currentGw: cur, maxGw: max };
}

export async function leagueContext() {
  const ctx = await pageContext();
  const data = await loadLeagueData(ctx.league);
  return { ...ctx, data };
}

export function parseGw(raw: string | string[] | undefined, fallback: number, min: number, max: number) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
