import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureDb, get } from "./db";
import { syncFromFpl } from "./fpl";

const COOKIE = "spl_session";
const SECRET = process.env.SESSION_SECRET || "dev-only-secret-set-SESSION_SECRET-in-production";

export type User = { id: number; league_id: number; name: string; is_admin: number; joined_gw: number };

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function hashPin(pin: string) {
  const salt = crypto.randomBytes(8).toString("hex");
  return `${salt}:${crypto.scryptSync(pin, salt, 32).toString("hex")}`;
}

export function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(pin, salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export async function setSession(userId: number) {
  const value = String(userId);
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  await ensureDb();
  await syncFromFpl();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [value, mac] = raw.split(".");
  if (!mac || sign(value) !== mac) return null;
  return (await get<User>("SELECT id, league_id, name, is_admin, joined_gw FROM users WHERE id = ?", [Number(value)])) ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/join");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.is_admin) redirect("/week");
  return user;
}
