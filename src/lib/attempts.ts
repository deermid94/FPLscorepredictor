const MIN = 60_000;

export type Limit = { max: number; windowMs: number; lockMs: number };
export type AttemptRow = { fails: number; window_start: number; locked_until: number };

/** Wrong PINs allowed per player name, and per IP across all names, before a temporary lockout. */
export const LIMITS: { name: Limit; ip: Limit } = {
  name: { max: 5, windowMs: 15 * MIN, lockMs: 15 * MIN },
  ip: { max: 30, windowMs: 15 * MIN, lockMs: 15 * MIN },
};

export function lockedFor(row: AttemptRow | undefined | null, now: number) {
  return row ? Math.max(0, row.locked_until - now) : 0;
}

export function afterFailure(row: AttemptRow | undefined | null, now: number, limit: Limit): AttemptRow {
  const fresh = !row || now - row.window_start >= limit.windowMs;
  const fails = fresh ? 1 : row.fails + 1;
  return {
    fails,
    window_start: fresh ? now : row.window_start,
    locked_until: fails >= limit.max ? now + limit.lockMs : (row?.locked_until ?? 0),
  };
}
