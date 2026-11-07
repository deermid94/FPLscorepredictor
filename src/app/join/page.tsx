import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Button, Card, Flash, inputCls } from "@/components/ui";
import { createLeague, demoGuest, demoLogin, joinLeague } from "../actions";
import { Goal } from "lucide-react";
import { QrCode } from "@/components/QrCode";
import { joinUrl, siteOrigin } from "@/lib/origin";
import { DEMO_INVITE } from "@/lib/seed";

const label = "block text-xs font-bold uppercase tracking-wide text-slate-400";

export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentUser()) redirect("/week");
  const sp = await searchParams;
  const create = sp.tab === "create";
  const demo = process.env.SEED_DEMO !== "false";
  const invite = (sp.invite ?? "").trim().toUpperCase().slice(0, 12);
  const qrInvite = invite || (demo ? DEMO_INVITE : "");
  const qrUrl = joinUrl(await siteOrigin(), qrInvite);
  return (
    <div className="mx-auto max-w-md space-y-5 pt-4">
      <div className="text-center">
        <div className="animate-float mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-lime-400 text-slate-950 shadow-2xl shadow-lime-400/40"><Goal size={44} strokeWidth={2.25} aria-hidden /></div>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-tight text-white">
          Predict.<br /><span className="text-lime-400">Gloat.</span><br />Repeat.
        </h1>
        <p className="mt-3 text-slate-400">Exact-score Premier League predictions for you and your mates. €5 a week, bragging rights forever.</p>
        <div className="mt-4 flex justify-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">🎯 Exact = 3 pts</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">✅ Result = 1</span>
          <span className="wildcard-shine rounded-full px-3 py-1 text-white">★ Wildcard ×2</span>
        </div>
      </div>
      {demo && (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm">
          <p className="font-bold text-amber-200">Just looking? Play the demo</p>
          <p className="mt-1 text-amber-100/80">Pop in your name and you&apos;re in a league with dummy players and past results. No PIN needed; use the same name to get back in.</p>
          <form action={demoGuest} className="mt-3 flex gap-2">
            <input name="name" required maxLength={24} aria-label="Your name for the demo" className={`${inputCls} min-w-0 flex-1`} placeholder="Your name" />
            <Button className="shrink-0 rounded-xl px-4 text-sm">Play demo →</Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-amber-100/70">
            <span>Or look around as</span>
            <form action={demoLogin}>
              <input type="hidden" name="name" value="Conor" />
              <Button variant="ghost" className="rounded-lg px-2.5 py-1 text-xs">Conor (admin)</Button>
            </form>
            <form action={demoLogin}>
              <input type="hidden" name="name" value="Ollie" />
              <Button variant="ghost" className="rounded-lg px-2.5 py-1 text-xs">Ollie (player)</Button>
            </form>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1 text-sm font-bold">
        <Link href="/join" className={`rounded-xl py-2.5 text-center transition ${!create ? "bg-lime-400 text-slate-950" : "text-slate-400"}`}>Join a league</Link>
        <Link href="/join?tab=create" className={`rounded-xl py-2.5 text-center transition ${create ? "bg-lime-400 text-slate-950" : "text-slate-400"}`}>Start a league</Link>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash tone="error">{sp.error}</Flash>}
      <Card className="p-5">
        {!create ? (
          <form key="join" action={joinLeague} className="space-y-4">
            <label className={label}>Invite code
              <input name="invite" required defaultValue={invite} autoCapitalize="characters" className={`${inputCls} mt-1 font-mono text-lg uppercase tracking-[0.2em]`} placeholder="MATES26" />
            </label>
            <label className={label}>Your name
              <input name="name" required maxLength={24} className={`${inputCls} mt-1`} placeholder="What your friends call you" />
            </label>
            <label className={label}>PIN (4-8 digits)
              <input name="pin" required inputMode="numeric" pattern="\d{4,8}" type="password" className={`${inputCls} mt-1 tracking-[0.3em]`} placeholder="••••" />
            </label>
            <p className="text-xs text-slate-500">New name = new player. Existing name = log back in with your PIN.</p>
            <Button className="w-full rounded-2xl py-3.5 font-display text-lg uppercase">Let me in →</Button>
          </form>
        ) : (
          <form key="create" action={createLeague} className="space-y-4">
            <label className={label}>League name
              <input name="league" required maxLength={24} className={`${inputCls} mt-1`} placeholder="Sunday League Legends" />
            </label>
            <label className={label}>Your name
              <input name="name" required maxLength={24} className={`${inputCls} mt-1`} />
            </label>
            <label className={label}>PIN (4-8 digits)
              <input name="pin" required inputMode="numeric" pattern="\d{4,8}" type="password" className={`${inputCls} mt-1 tracking-[0.3em]`} placeholder="••••" />
            </label>
            <p className="text-xs text-slate-500">You&apos;ll be the league admin and get an invite code to share.</p>
            <Button className="w-full rounded-2xl py-3.5 font-display text-lg uppercase">Create league 🏁</Button>
          </form>
        )}
      </Card>
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <QrCode url={qrUrl} size={120} />
        <div className="min-w-0 text-sm">
          <p className="font-display text-lg font-extrabold uppercase leading-tight text-white">Scan to play on your phone</p>
          <p className="mt-1 text-slate-400">{qrInvite ? <>Opens this page with invite code <b className="font-mono text-lime-300">{qrInvite}</b> filled in.</> : "Opens this page on your phone."}</p>
        </div>
      </div>
    </div>
  );
}
