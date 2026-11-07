"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, hashPin, requireAdmin, requireUser, setSession, verifyPin } from "@/lib/auth";
import { batch, ensureDb, get, run } from "@/lib/db";
import { syncFromFpl } from "@/lib/fpl";
import { currentGw, fixturesForGw, getFixture, getLeague, isFinal, isLocked, type League } from "@/lib/game";
import { attemptKeys, clearFailures, lockoutMessage, recordFailure } from "@/lib/loginGuard";
import { DEMO_INVITE, isDemoLeague, matchesDemoPin, seedDemo } from "@/lib/seed";
import { localToUtc } from "@/lib/format";

const err = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`);

function cleanName(raw: FormDataEntryValue | null) {
  return String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function cleanPin(raw: FormDataEntryValue | null) {
  const pin = String(raw ?? "").trim();
  return /^\d{4,8}$/.test(pin) ? pin : null;
}

export async function joinLeague(formData: FormData) {
  await ensureDb();
  const code = String(formData.get("invite") ?? "").trim().toUpperCase();
  const name = cleanName(formData.get("name"));
  const pin = cleanPin(formData.get("pin"));
  if (!code || !name) err("/join", "Invite code and name are required");
  if (!pin) err("/join", "PIN must be 4-8 digits");
  const league = await get<League>("SELECT * FROM leagues WHERE invite_code = ?", [code]);
  if (!league) err("/join", "No league with that invite code");
  const existing = await get<{ id: number; pin_hash: string }>(
    "SELECT id, pin_hash FROM users WHERE league_id = ? AND name = ?",
    [league!.id, name],
  );
  if (existing) {
    const keys = await attemptKeys(league!.id, name);
    const locked = await lockoutMessage(keys);
    if (locked) err("/join", locked);
    if (!verifyPin(pin!, existing.pin_hash) && !matchesDemoPin(league!, name!, pin!)) {
      await recordFailure(keys);
      err("/join", "Wrong PIN for that name (or pick a different name)");
    }
    await clearFailures(keys);
    await setSession(existing.id);
  } else {
    const gw = await currentGw(league!);
    const res = await run("INSERT INTO users (league_id, name, pin_hash, is_admin, joined_gw) VALUES (?, ?, ?, 0, ?)", [
      league!.id, name, hashPin(pin!), gw,
    ]);
    await setSession(Number(res.lastInsertRowid));
  }
  redirect("/week");
}

const DEMO_LOGINS = ["Conor", "Ollie"];

export async function demoLogin(formData: FormData) {
  await ensureDb();
  const name = String(formData.get("name") ?? "");
  if (process.env.SEED_DEMO === "false" || !DEMO_LOGINS.includes(name)) err("/join", "Demo login isn't available");
  const user = await get<{ id: number }>(
    "SELECT u.id FROM users u JOIN leagues l ON l.id = u.league_id WHERE l.invite_code = ? AND u.name = ?",
    [DEMO_INVITE, name],
  );
  if (!user) err("/join", "Demo league isn't ready yet; reload and try again");
  await setSession(user!.id);
  redirect("/week");
}

export async function createLeague(formData: FormData) {
  await ensureDb();
  const leagueName = cleanName(formData.get("league")) || "Score Predictor League";
  const name = cleanName(formData.get("name"));
  const pin = cleanPin(formData.get("pin"));
  if (!name) err("/join?tab=create", "Your name is required");
  if (!pin) err("/join?tab=create", "PIN must be 4-8 digits");
  const code = crypto.randomBytes(4).toString("base64url").replace(/[^A-Za-z0-9]/g, "X").slice(0, 6).toUpperCase();
  const startRow = await get<{ gw: number | null }>("SELECT MIN(gameweek) AS gw FROM fixtures WHERE status NOT IN ('finished','postponed')");
  const startGw = startRow?.gw ?? 1;
  const res = await run("INSERT INTO leagues (name, invite_code, start_gw, fee_cents) VALUES (?, ?, ?, 500)", [leagueName, code, startGw]);
  const leagueId = Number(res.lastInsertRowid);
  const user = await run("INSERT INTO users (league_id, name, pin_hash, is_admin, joined_gw) VALUES (?, ?, ?, 1, ?)", [
    leagueId, name, hashPin(pin!), startGw,
  ]);
  await setSession(Number(user.lastInsertRowid));
  redirect("/admin?created=1");
}

export async function logout() {
  await clearSession();
  redirect("/join");
}

const score = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : NaN;
};

export async function savePicks(formData: FormData) {
  const user = await requireUser();
  const league = await getLeague(user.league_id);
  const gw = Number(formData.get("gw"));
  const back = `/week?gw=${gw}`;
  if (gw < league.start_gw) err(back, "This gameweek is before your league started");
  const fixtures = await fixturesForGw(league.id, gw);
  const now = new Date();
  let saved = 0, locked = 0, invalid = 0;
  const stmts = [];
  for (const f of fixtures) {
    const h = score(formData.get(`h_${f.id}`));
    const a = score(formData.get(`a_${f.id}`));
    if (h === null && a === null) continue;
    if (isLocked(f, now)) { locked++; continue; } // server-side lock: kick-off has passed
    if (h === null || a === null || Number.isNaN(h) || Number.isNaN(a)) { invalid++; continue; }
    stmts.push({
      sql: `INSERT INTO predictions (user_id, fixture_id, home, away, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, fixture_id) DO UPDATE SET home = excluded.home, away = excluded.away, updated_at = excluded.updated_at`,
      args: [user.id, f.id, h, a, now.toISOString()],
    });
    saved++;
  }
  await batch(stmts);
  revalidatePath("/week");
  const msg = [`Saved ${saved} pick${saved === 1 ? "" : "s"}`, locked && `${locked} locked (kicked off)`, invalid && `${invalid} incomplete`]
    .filter(Boolean)
    .join(" · ");
  redirect(`${back}&saved=${encodeURIComponent(msg)}`);
}

/* ---------- admin ---------- */

async function adminLeague() {
  const user = await requireAdmin();
  return { user, league: await getLeague(user.league_id) };
}

export async function setSeasonEnd(formData: FormData) {
  const { league } = await adminLeague();
  const date = String(formData.get("date") ?? "");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) err("/admin", "Invalid date");
  await run("UPDATE leagues SET season_end_date = ? WHERE id = ?", [date || null, league.id]);
  redirect("/admin?ok=Season+end+date+saved");
}

export async function togglePayment(formData: FormData) {
  const { league } = await adminLeague();
  const userId = Number(formData.get("user"));
  const gw = Number(formData.get("gw"));
  const member = await get("SELECT 1 FROM users WHERE id = ? AND league_id = ?", [userId, league.id]);
  if (!member) err("/admin", "Unknown player");
  await run(
    `INSERT INTO payments (user_id, gameweek, paid) VALUES (?, ?, 1)
     ON CONFLICT(user_id, gameweek) DO UPDATE SET paid = 1 - payments.paid`,
    [userId, gw],
  );
  revalidatePath("/ledger");
  redirect(`/admin?pgw=${gw}#payments`);
}

export async function setResult(formData: FormData) {
  const { league } = await adminLeague();
  const id = Number(formData.get("fixture"));
  const h = score(formData.get("home"));
  const a = score(formData.get("away"));
  const back = String(formData.get("back") || "/admin");
  if (h === null || a === null || Number.isNaN(h) || Number.isNaN(a)) err(back, "Enter both scores (0-20)");
  if (!(await getFixture(league.id, id))) err(back, "Unknown fixture");
  await run(
    `INSERT INTO result_overrides (league_id, fixture_id, home, away, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(league_id, fixture_id) DO UPDATE SET home = excluded.home, away = excluded.away, updated_at = excluded.updated_at`,
    [league.id, id, h, a, new Date().toISOString()],
  );
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=Result+saved#results`);
}

export async function clearManualResult(formData: FormData) {
  const { league } = await adminLeague();
  const id = Number(formData.get("fixture"));
  const back = String(formData.get("back") || "/admin");
  await run("DELETE FROM result_overrides WHERE league_id = ? AND fixture_id = ?", [league.id, id]);
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=Result+handed+back+to+API#results`);
}

export async function addFixture(formData: FormData) {
  const { league } = await adminLeague();
  const gw = Number(formData.get("gw"));
  const home = Number(formData.get("home"));
  const away = Number(formData.get("away"));
  const kickoff = String(formData.get("kickoff") ?? "");
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) err("/admin", "Gameweek must be 1-38");
  if (!home || !away || home === away) err("/admin", "Pick two different teams");
  let iso = "";
  try { iso = localToUtc(kickoff); } catch { err("/admin", "Invalid kick-off time"); }
  await run(
    "INSERT INTO fixtures (fpl_id, gameweek, kickoff, home_team, away_team, status, source, league_id, updated_at) VALUES (NULL, ?, ?, ?, ?, 'scheduled', 'manual', ?, ?)",
    [gw, iso, home, away, league.id, new Date().toISOString()],
  );
  redirect(`/admin?ok=Fixture+added&rgw=${gw}#results`);
}

export async function deleteFixture(formData: FormData) {
  const { league } = await adminLeague();
  const id = Number(formData.get("fixture"));
  const f = await getFixture(league.id, id);
  if (!f || f.source !== "manual" || f.league_id !== league.id) err("/admin", "Only your league's manually added fixtures can be deleted");
  await batch([
    { sql: "DELETE FROM result_overrides WHERE fixture_id = ?", args: [id] },
    { sql: "DELETE FROM predictions WHERE fixture_id = ?", args: [id] },
    { sql: "DELETE FROM predictor_guesses WHERE fixture_id = ?", args: [id] },
    { sql: "DELETE FROM wildcards WHERE fixture_id = ?", args: [id] },
    { sql: "DELETE FROM fixtures WHERE id = ?", args: [id] },
  ]);
  redirect(`/admin?ok=Fixture+deleted&rgw=${f!.gameweek}#results`);
}

export async function rerollWildcard(formData: FormData) {
  const { league } = await adminLeague();
  const gw = Number(formData.get("gw"));
  const fixtures = (await fixturesForGw(league.id, gw)).filter((f) => !isLocked(f));
  if (!fixtures.length) err("/admin", "Every match this gameweek has kicked off; the wildcard can't change now");
  const pick = fixtures[crypto.randomInt(fixtures.length)];
  await run(
    "INSERT INTO wildcards (league_id, gameweek, fixture_id) VALUES (?, ?, ?) ON CONFLICT(league_id, gameweek) DO UPDATE SET fixture_id = excluded.fixture_id",
    [league.id, gw, pick.id],
  );
  redirect(`/admin?ok=Wildcard+re-drawn+for+GW${gw}`);
}

export async function forceSync() {
  await adminLeague();
  await syncFromFpl(true);
  redirect("/admin?ok=Synced+from+FPL");
}

export async function promote(formData: FormData) {
  const { league, user } = await adminLeague();
  const target = Number(formData.get("user"));
  if (target === user.id) err("/admin", "You can't change your own admin status");
  await run("UPDATE users SET is_admin = 1 - is_admin WHERE id = ? AND league_id = ?", [target, league.id]);
  redirect("/admin?ok=Admin+updated#players");
}

async function demoAdmin() {
  const ctx = await adminLeague();
  if (!isDemoLeague(ctx.league)) err("/admin", "Demo tools only work in the demo league");
  return ctx;
}

const SIM_SCORES: [number, number][] = [
  [1, 0], [1, 0], [2, 1], [2, 1], [1, 1], [1, 1], [2, 0], [0, 0], [0, 1], [1, 2], [3, 1], [2, 2], [0, 2], [3, 0], [3, 2], [4, 1],
];

export async function simulateFullTime() {
  const { league } = await demoAdmin();
  const gw = await currentGw(league);
  const next = (await fixturesForGw(league.id, gw))
    .filter((f) => !isFinal(f))
    .sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""))[0];
  if (!next) err("/admin", `Every GW${gw} match already has a result`);
  const [h, a] = SIM_SCORES[crypto.randomInt(SIM_SCORES.length)];
  await run(
    `INSERT INTO result_overrides (league_id, fixture_id, home, away, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(league_id, fixture_id) DO UPDATE SET home = excluded.home, away = excluded.away, updated_at = excluded.updated_at`,
    [league.id, next!.id, h, a, new Date().toISOString()],
  );
  revalidatePath("/", "layout");
  redirect(`/week?gw=${gw}&saved=${encodeURIComponent(`Full time (simulated): ${next!.home_short} ${h}-${a} ${next!.away_short}`)}`);
}

export async function resetDemo(formData: FormData) {
  const { league } = await demoAdmin();
  if (formData.get("confirm") !== "yes") err("/admin", "Tick the box to confirm the reset");
  const users = "SELECT id FROM users WHERE league_id = ?";
  const fixtures = "SELECT id FROM fixtures WHERE league_id = ?";
  const id = league.id;
  await batch([
    { sql: `DELETE FROM predictions WHERE user_id IN (${users}) OR fixture_id IN (${fixtures})`, args: [id, id] },
    { sql: `DELETE FROM predictor_guesses WHERE user_id IN (${users}) OR fixture_id IN (${fixtures})`, args: [id, id] },
    { sql: `DELETE FROM payments WHERE user_id IN (${users})`, args: [id] },
    { sql: "DELETE FROM wildcards WHERE league_id = ?", args: [id] },
    { sql: "DELETE FROM result_overrides WHERE league_id = ?", args: [id] },
    { sql: "DELETE FROM fixtures WHERE league_id = ?", args: [id] },
    { sql: "DELETE FROM login_attempts WHERE key LIKE ?", args: [`name:${id}:%`] },
    { sql: "DELETE FROM users WHERE league_id = ?", args: [id] },
    { sql: "DELETE FROM leagues WHERE id = ?", args: [id] },
  ]);
  try {
    await seedDemo();
  } catch (e) {
    console.error("[resetDemo] reseed failed", e);
    err("/admin", "Demo wiped but reseeding failed. It will reseed on the next server start");
  }
  await clearSession();
  revalidatePath("/", "layout");
  redirect(`/join?invite=${DEMO_INVITE}&ok=${encodeURIComponent("Demo league reset. Log back in with the demo PIN.")}`);
}
