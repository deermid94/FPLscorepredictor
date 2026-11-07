import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { cacheInfo, lastSync, syncFromFpl } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureDb();
  await syncFromFpl(true);
  return NextResponse.json({ ok: true, lastSync: await lastSync(), cache: await cacheInfo() });
}
