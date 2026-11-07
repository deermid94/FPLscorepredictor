import { headers } from "next/headers";

export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export const joinUrl = (origin: string, invite?: string) => `${origin}/join${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`;
