import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Button, Card, inputCls } from "@/components/ui";
import { createLeague, joinLeague } from "../actions";

export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentUser()) redirect("/week");
  const sp = await searchParams;
  const create = sp.tab === "create";
  const demo = process.env.SEED_DEMO !== "false";
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Predict. Gloat. Repeat.</h1>
        <p className="mt-1 text-slate-500">Exact-score Premier League predictions for you and your mates.</p>
      </div>
      <div className="grid grid-cols-2 rounded-lg bg-slate-200 p-1 text-sm font-semibold">
        <Link href="/join" className={`rounded-md py-2 text-center ${!create ? "bg-white shadow" : "text-slate-600"}`}>Join a league</Link>
        <Link href="/join?tab=create" className={`rounded-md py-2 text-center ${create ? "bg-white shadow" : "text-slate-600"}`}>Start a league</Link>
      </div>
      {sp.error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{sp.error}</p>}
      <Card>
        {!create ? (
          <form action={joinLeague} className="space-y-3">
            <label className="block text-sm font-medium">Invite code
              <input name="invite" required autoCapitalize="characters" className={`${inputCls} mt-1 uppercase`} placeholder="e.g. MATES26" />
            </label>
            <label className="block text-sm font-medium">Your name
              <input name="name" required maxLength={24} className={`${inputCls} mt-1`} placeholder="What the lads call you" />
            </label>
            <label className="block text-sm font-medium">PIN (4-8 digits)
              <input name="pin" required inputMode="numeric" pattern="\d{4,8}" type="password" className={`${inputCls} mt-1`} />
            </label>
            <p className="text-xs text-slate-500">New name = new player. Existing name = log back in with your PIN.</p>
            <Button className="w-full">Let me in</Button>
          </form>
        ) : (
          <form action={createLeague} className="space-y-3">
            <label className="block text-sm font-medium">League name
              <input name="league" required maxLength={24} className={`${inputCls} mt-1`} placeholder="Sunday League Legends" />
            </label>
            <label className="block text-sm font-medium">Your name
              <input name="name" required maxLength={24} className={`${inputCls} mt-1`} />
            </label>
            <label className="block text-sm font-medium">PIN (4-8 digits)
              <input name="pin" required inputMode="numeric" pattern="\d{4,8}" type="password" className={`${inputCls} mt-1`} />
            </label>
            <p className="text-xs text-slate-500">You&apos;ll be the league admin and get an invite code to share.</p>
            <Button className="w-full">Create league</Button>
          </form>
        )}
      </Card>
      {demo && (
        <Card className="bg-amber-50 text-sm">
          <p className="font-semibold">Demo league</p>
          <p className="text-slate-600">
            Invite code <code className="font-mono font-bold">MATES26</code>, PIN <code className="font-mono font-bold">1234</code>. Log in as{" "}
            <b>Conor</b> (admin), Ollie, Dave, Niamh, Barry or Aoife.
          </p>
        </Card>
      )}
    </div>
  );
}
