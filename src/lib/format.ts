export const TZ = process.env.DISPLAY_TIMEZONE || "Europe/London";

export function kickoffLabel(iso: string | null) {
  if (!iso) return "TBC";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  }).format(new Date(iso));
}

export function dateLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(new Date(iso));
}

export function timeUntil(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function tzOffsetMs(utcMs: number, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - utcMs;
}

/** Convert a `datetime-local` value entered in the display timezone into a UTC ISO string. */
export function localToUtc(local: string, tz = TZ) {
  const guess = Date.parse(local.length === 16 ? `${local}:00Z` : `${local}Z`);
  if (Number.isNaN(guess)) throw new Error("Invalid date");
  return new Date(guess - tzOffsetMs(guess, tz)).toISOString().replace(".000Z", "Z");
}

/** Inverse of localToUtc, for prefilling `datetime-local` inputs. */
export function utcToLocalInput(iso: string | null, tz = TZ) {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return new Date(ms + tzOffsetMs(ms, tz)).toISOString().slice(0, 16);
}
