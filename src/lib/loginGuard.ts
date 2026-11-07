import { headers } from "next/headers";
import { get, run } from "./db";
import { LIMITS, afterFailure, lockedFor, type AttemptRow, type Limit } from "./attempts";

export type AttemptKeys = { name: string; ip: string };

export async function attemptKeys(leagueId: number, name: string): Promise<AttemptKeys> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return { name: `name:${leagueId}:${name.toLowerCase()}`, ip: `ip:${ip}` };
}

const read = (key: string) =>
  get<AttemptRow>("SELECT fails, window_start, locked_until FROM login_attempts WHERE key = ?", [key]);

export async function lockoutMessage(keys: AttemptKeys, now = Date.now()) {
  for (const key of [keys.name, keys.ip]) {
    const ms = lockedFor(await read(key), now);
    if (ms > 0) return `Too many wrong PINs. Try again in ${Math.ceil(ms / 60_000)} min.`;
  }
  return null;
}

export async function recordFailure(keys: AttemptKeys, now = Date.now()) {
  const pairs: [string, Limit][] = [[keys.name, LIMITS.name], [keys.ip, LIMITS.ip]];
  for (const [key, limit] of pairs) {
    const next = afterFailure(await read(key), now, limit);
    await run(
      `INSERT INTO login_attempts (key, fails, window_start, locked_until) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET fails = excluded.fails, window_start = excluded.window_start, locked_until = excluded.locked_until`,
      [key, next.fails, next.window_start, next.locked_until],
    );
  }
}

export async function clearFailures(keys: AttemptKeys) {
  await run("DELETE FROM login_attempts WHERE key = ?", [keys.name]);
}
