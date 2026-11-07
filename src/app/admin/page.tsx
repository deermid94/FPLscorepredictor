import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { cacheInfo, lastSync } from "@/lib/fpl";
import { currentGw, fixturesForGw, getLeague, getPlayers, getTeams, getWildcard, maxGw } from "@/lib/game";
import { parseGw } from "@/lib/context";
import { dateLabel, kickoffLabel, utcToLocalInput } from "@/lib/format";
import { Avatar, Badge, Button, Card, Flash, PageTitle, inputCls } from "@/components/ui";
import { addFixture, clearManualResult, deleteFixture, forceSync, promote, rerollWildcard, resetDemo, setResult, setSeasonEnd, simulateFullTime, togglePayment } from "../actions";
import { QrCode } from "@/components/QrCode";
import { joinUrl, siteOrigin } from "@/lib/origin";
import { isDemoLeague } from "@/lib/seed";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireAdmin();
  const league = await getLeague(user.league_id);
  const cur = await currentGw(league);
  const max = await maxGw();
  const pgw = parseGw(sp.pgw, cur, league.start_gw, max);
  const rgw = parseGw(sp.rgw, cur, 1, 38);
  const [players, teams, fixtures, payments, sync, cache, wildcardId] = await Promise.all([
    getPlayers(league.id),
    getTeams(),
    fixturesForGw(league.id, rgw),
    all<{ user_id: number; paid: number }>("SELECT user_id, paid FROM payments WHERE gameweek = ?", [pgw]),
    lastSync(),
    cacheInfo(),
    getWildcard(league.id, cur, false),
  ]);
  const paid = new Set(payments.filter((p) => p.paid).map((p) => p.user_id));
  const wildcard = (await fixturesForGw(league.id, cur)).find((f) => f.id === wildcardId);
  const back = `/admin?rgw=${rgw}`;
  const inviteUrl = joinUrl(await siteOrigin(), league.invite_code);
  const demo = isDemoLeague(league);
  const gwOptions = Array.from({ length: max - league.start_gw + 1 }, (_, i) => league.start_gw + i);

  return (
    <div className="space-y-6">
      <PageTitle kicker="Gaffer's office" title="Admin" subtitle={<>Invite code <code className="rounded-lg bg-lime-400 px-2 py-0.5 font-mono text-base font-black tracking-widest text-slate-950">{league.invite_code}</code> Share it with the lads.</>} />
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash tone="error">{sp.error}</Flash>}
      {sp.created && <Flash>League created! Share the invite code above.</Flash>}

      <Card className="flex items-center gap-4">
        <QrCode url={inviteUrl} size={112} />
        <div className="min-w-0 text-sm">
          <p className="font-display text-lg font-extrabold uppercase leading-tight text-white">Invite by QR</p>
          <p className="mt-1 text-slate-400">Mates scan this to open the join page with <b className="font-mono text-lime-300">{league.invite_code}</b> filled in.</p>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">{inviteUrl}</p>
        </div>
      </Card>

      {demo && (
        <section id="demo">
          <h2 className="mb-2 font-display text-xl font-extrabold uppercase text-white">🎬 Demo tools</h2>
          <Card className="space-y-4 border-fuchsia-400/30">
            <form action={simulateFullTime} className="space-y-2">
              <p className="text-sm text-slate-300">Blow the final whistle on the next GW{cur} match without a result. It gets a random realistic score (this league only) and points update at once. Undo it with &ldquo;Hand back to API&rdquo; under Fixtures &amp; results.</p>
              <Button className="w-full">⏱️ Simulate full time</Button>
            </form>
            <form action={resetDemo} className="space-y-2 border-t border-white/10 pt-4">
              <p className="text-sm text-slate-300">Wipe this league&apos;s picks, payments, results and players, and reseed the demo from scratch. Everyone gets logged out.</p>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <input type="checkbox" name="confirm" value="yes" required className="h-4 w-4 accent-rose-500" /> Yes, reset the demo league
              </label>
              <Button variant="danger" className="w-full">♻️ Reset demo</Button>
            </form>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl font-extrabold uppercase text-white">📅 Season end date</h2>
        <Card>
          <form action={setSeasonEnd} className="flex flex-wrap items-end gap-2">
            <label className="text-sm font-medium">Season pot is awarded to the top scorer at the end of
              <input type="date" name="date" defaultValue={league.season_end_date ?? ""} className={`${inputCls} mt-1`} />
            </label>
            <Button>Save</Button>
          </form>
          <p className="mt-2 text-xs text-slate-400">
            {league.season_end_date ? `Currently ${dateLabel(league.season_end_date)}.` : "Not set."} Only gameweeks whose matches all finish by this date count towards the pot and the title.
          </p>
        </Card>
      </section>

      <section id="payments">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold uppercase text-white">💶 Payments</h2>
          <form className="flex items-center gap-2 text-sm">
            <select name="pgw" defaultValue={pgw} className="rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-white">
              {gwOptions.map((g) => <option key={g} value={g}>GW{g}</option>)}
            </select>
            <Button variant="ghost" className="py-1">Show</Button>
          </form>
        </div>
        <Card className="divide-y divide-white/5 p-0">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2">
              <span className="flex items-center gap-2 font-semibold text-white"><Avatar id={p.id} name={p.name} size="sm" />{p.name}{p.joined_gw > pgw && <span className="ml-2 text-xs text-slate-400">(joined GW{p.joined_gw})</span>}</span>
              {p.joined_gw <= pgw && (
                <form action={togglePayment} className="flex items-center gap-2">
                  <input type="hidden" name="user" value={p.id} />
                  <input type="hidden" name="gw" value={pgw} />
                  {paid.has(p.id) ? <Badge tone="green">Paid</Badge> : <Badge tone="red">Owes</Badge>}
                  <Button variant="ghost" className="py-1 text-xs">{paid.has(p.id) ? "Mark unpaid" : "Mark paid"}</Button>
                </form>
              )}
            </div>
          ))}
        </Card>
      </section>

      <section id="results">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold uppercase text-white">⚽ Fixtures & results</h2>
          <form className="flex items-center gap-2 text-sm">
            <select name="rgw" defaultValue={rgw} className="rounded-lg border border-white/15 bg-slate-950/70 px-2 py-1 text-white">
              {Array.from({ length: 38 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>GW{g}</option>)}
            </select>
            <Button variant="ghost" className="py-1">Show</Button>
          </form>
        </div>
        <p className="mb-2 text-xs text-slate-400">Results come from the FPL API automatically. Enter a score here to override it, or for a manual fixture. Manual results are never overwritten by the API until you hand them back.</p>
        <div className="space-y-2">
          {fixtures.map((f) => (
            <Card key={f.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold text-white">{f.home_name} v {f.away_name}</span>
                <span className="flex gap-1 text-xs">
                  <span className="text-slate-400">{kickoffLabel(f.kickoff)}</span>
                  <Badge tone={f.status === "finished" ? "slate" : f.status === "live" ? "red" : "green"}>{f.status}</Badge>
                  {f.manual_result ? <Badge tone="amber">manual result</Badge> : null}
                  {f.source === "manual" && <Badge tone="blue">manual fixture</Badge>}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <form key={`${f.home_score}-${f.away_score}-${f.manual_result}`} action={setResult} className="flex items-center gap-1">
                  <input type="hidden" name="fixture" value={f.id} />
                  <input type="hidden" name="back" value={back} />
                  <input name="home" type="number" min={0} max={20} defaultValue={f.home_score ?? ""} className="h-9 w-12 rounded-lg border border-white/15 bg-slate-950/70 text-center font-display font-extrabold text-white" aria-label="Home score" />
                  <span>:</span>
                  <input name="away" type="number" min={0} max={20} defaultValue={f.away_score ?? ""} className="h-9 w-12 rounded-lg border border-white/15 bg-slate-950/70 text-center font-display font-extrabold text-white" aria-label="Away score" />
                  <Button className="py-1.5 text-xs">Set final</Button>
                </form>
                {f.manual_result ? (
                  <form action={clearManualResult}>
                    <input type="hidden" name="fixture" value={f.id} />
                    <input type="hidden" name="back" value={back} />
                    <Button variant="ghost" className="py-1.5 text-xs">{f.source === "fpl" ? "Hand back to API" : "Clear result"}</Button>
                  </form>
                ) : null}
                {f.source === "manual" && (
                  <form action={deleteFixture}>
                    <input type="hidden" name="fixture" value={f.id} />
                    <Button variant="danger" className="py-1.5 text-xs">Delete</Button>
                  </form>
                )}
              </div>
            </Card>
          ))}
          {!fixtures.length && <Card className="text-sm text-slate-400">No fixtures in GW{rgw}.</Card>}
        </div>

        <Card className="mt-3">
          <p className="mb-2 font-display text-lg font-extrabold uppercase text-white">➕ Add a fixture manually</p>
          <form action={addFixture} className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">Gameweek
              <input name="gw" type="number" min={1} max={38} defaultValue={rgw} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-sm">Kick-off (UK time)
              <input name="kickoff" type="datetime-local" required defaultValue={utcToLocalInput(new Date(Date.now() + 86400000).toISOString()).slice(0, 11) + "15:00"} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-sm">Home
              <select name="home" className={`${inputCls} mt-1`}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <label className="text-sm">Away
              <select name="away" className={`${inputCls} mt-1`} defaultValue={teams[1]?.id}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <Button className="sm:col-span-2">Add fixture</Button>
          </form>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl font-extrabold uppercase text-white">★ Wildcard</h2>
        <Card className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">GW{cur}: <b>{wildcard ? `${wildcard.home_name} v ${wildcard.away_name}` : "not drawn yet (drawn when someone opens the week)"}</b></p>
          <form action={rerollWildcard}>
            <input type="hidden" name="gw" value={cur} />
            <Button variant="ghost" className="text-xs">Re-draw from unplayed matches</Button>
          </form>
        </Card>
      </section>

      <section id="players">
        <h2 className="mb-2 font-display text-xl font-extrabold uppercase text-white">👥 Players</h2>
        <Card className="divide-y divide-white/5 p-0">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="flex items-center gap-2 font-semibold text-white"><Avatar id={p.id} name={p.name} size="sm" />{p.name} {p.is_admin ? <Badge tone="blue">admin</Badge> : null}</span>
              {p.id !== user.id && (
                <form action={promote}>
                  <input type="hidden" name="user" value={p.id} />
                  <Button variant="ghost" className="py-1 text-xs">{p.is_admin ? "Remove admin" : "Make admin"}</Button>
                </form>
              )}
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl font-extrabold uppercase text-white">📡 FPL data feed</h2>
        <Card className="text-sm">
          <p>Last successful sync: <b>{sync ? kickoffLabel(sync) : "never (using bundled snapshot)"}</b></p>
          <ul className="mt-1 text-xs text-slate-400">
            {cache.map((c) => <li key={c.key}><code>{c.key}</code> cached {Math.round((Date.now() - c.fetched_at) / 60000)} min ago</li>)}
          </ul>
          <form action={forceSync} className="mt-2"><Button variant="ghost" className="text-xs">Sync now</Button></form>
        </Card>
      </section>
    </div>
  );
}
