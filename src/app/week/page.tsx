import Link from "next/link";
import { leagueContext, parseGw } from "@/lib/context";
import { getWildcard, isFinal, isLocked } from "@/lib/game";
import { ensureGuesses } from "@/lib/predictor";
import { scorePrediction, euro } from "@/lib/scoring";
import { kickoffLabel, timeUntil } from "@/lib/format";
import { Badge, Button, Card, Crest, GwPager, PageTitle } from "@/components/ui";
import { savePicks } from "../actions";

export default async function WeekPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await leagueContext();
  const { user, league, data } = ctx;
  const gw = parseGw(sp.gw, ctx.currentGw, league.start_gw, ctx.maxGw);
  const wildcardId = await getWildcard(league.id, gw);
  data.wildcards.set(gw, wildcardId!);
  const guesses = await ensureGuesses(data, user.id, gw);
  const guessBy = new Map(guesses.map((g) => [g.fixture_id, g]));

  const now = new Date();
  const fixtures = data.fixtures.filter((f) => f.gameweek === gw);
  const mine = new Map(data.predictions.filter((p) => p.user_id === user.id).map((p) => [p.fixture_id, p]));
  const openCount = fixtures.filter((f) => !isLocked(f, now)).length;
  const pickedOpen = fixtures.filter((f) => !isLocked(f, now) && mine.has(f.id)).length;
  const wildcard = fixtures.find((f) => f.id === wildcardId);
  const participants = data.players.filter((p) => p.joined_gw <= gw);
  const nextLock = fixtures.find((f) => !isLocked(f, now));

  const judged = guesses.filter((g) => mine.has(g.fixture_id) && isLocked(data.fixtures.find((f) => f.id === g.fixture_id) ?? { status: "finished", kickoff: null }, now));
  const guessHits = judged.filter((g) => mine.get(g.fixture_id)!.home === g.home && mine.get(g.fixture_id)!.away === g.away).length;

  let myPoints = 0;
  for (const f of fixtures) {
    const p = mine.get(f.id);
    if (p && isFinal(f)) myPoints += scorePrediction(p, { home: f.home_score!, away: f.away_score! }, f.id === wildcardId).points;
  }

  return (
    <div>
      <PageTitle
        title={`Gameweek ${gw}`}
        subtitle={<>{participants.length} players · {euro(participants.length * league.fee_cents)} in the weekly pot · you&apos;ve got {myPoints} pt{myPoints === 1 ? "" : "s"} so far</>}
      >
        <GwPager gw={gw} min={league.start_gw} max={ctx.maxGw} base="/week" />
      </PageTitle>

      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.saved}</p>}
      {sp.error && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{sp.error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {wildcard && (
          <Card className="border-fuchsia-200 bg-fuchsia-50">
            <div className="flex items-center gap-2"><Badge tone="purple">WILDCARD x2</Badge></div>
            <p className="mt-2 font-semibold">{wildcard.home_name} v {wildcard.away_name}</p>
            <p className="text-xs text-slate-500">Drawn at random when picks opened. Double points on this one.</p>
          </Card>
        )}
        <Card>
          <p className="text-sm font-semibold">Predict the Predictor</p>
          <p className="mt-1 text-xs text-slate-500">
            Before you pick, the app guesses your score from your history. So far it has called{" "}
            <b className="text-slate-800">{guessHits}/{judged.length}</b> of your locked-in picks exactly.
          </p>
          {openCount > 0 && <p className="mt-1 text-xs text-slate-500">{pickedOpen}/{openCount} open matches picked{nextLock?.kickoff && <> · next lock in <b>{timeUntil(nextLock.kickoff, now)}</b></>}</p>}
        </Card>
      </div>

      {!fixtures.length && <Card>No fixtures for this gameweek yet.</Card>}

      <form action={savePicks} className="space-y-3">
        <input type="hidden" name="gw" value={gw} />
        {fixtures.map((f) => {
          const locked = isLocked(f, now);
          const pick = mine.get(f.id);
          const guess = guessBy.get(f.id);
          const isWild = f.id === wildcardId;
          const final = isFinal(f);
          const pts = pick && final ? scorePrediction(pick, { home: f.home_score!, away: f.away_score! }, isWild) : null;
          const others = data.players
            .filter((p) => p.joined_gw <= gw)
            .map((p) => ({ p, pred: data.predByKey.get(`${p.id}:${f.id}`) }));
          return (
            <Card key={f.id} className={isWild ? "ring-2 ring-fuchsia-400" : ""}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{kickoffLabel(f.kickoff)}</span>
                <span className="flex flex-wrap gap-1">
                  {isWild && <Badge tone="purple">WILDCARD x2</Badge>}
                  {f.source === "manual" && <Badge tone="blue">Manual</Badge>}
                  {f.status === "live" && <Badge tone="red">LIVE {f.minutes ? `${f.minutes}'` : ""}</Badge>}
                  {final && <Badge>FT</Badge>}
                  {f.status === "postponed" && <Badge tone="amber">Postponed</Badge>}
                  {!locked ? <Badge tone="green">Open · locks in {timeUntil(f.kickoff!, now)}</Badge> : <Badge tone="amber">Locked</Badge>}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex items-center justify-end gap-2 text-right">
                  <span className="font-semibold"><span className="hidden sm:inline">{f.home_name}</span><span className="sm:hidden">{f.home_short}</span></span>
                  <Crest code={f.home_code} name={f.home_name} />
                </div>
                {locked ? (
                  <div className="text-center">
                    <div className="text-2xl font-bold tabular-nums">
                      {f.home_score ?? "-"} <span className="text-slate-300">:</span> {f.away_score ?? "-"}
                    </div>
                    <div className="text-xs text-slate-500">
                      You: {pick ? `${pick.home}-${pick.away}` : "no pick"}
                      {pts && <b className={pts.points ? "ml-1 text-emerald-700" : "ml-1 text-slate-400"}>+{pts.points}</b>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <input aria-label={`${f.home_name} score`} name={`h_${f.id}`} type="number" inputMode="numeric" min={0} max={20} defaultValue={pick?.home ?? ""} className="h-12 w-12 rounded-lg border border-slate-300 text-center text-xl font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                    <span className="text-slate-300">:</span>
                    <input aria-label={`${f.away_name} score`} name={`a_${f.id}`} type="number" inputMode="numeric" min={0} max={20} defaultValue={pick?.away ?? ""} className="h-12 w-12 rounded-lg border border-slate-300 text-center text-xl font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Crest code={f.away_code} name={f.away_name} />
                  <span className="font-semibold"><span className="hidden sm:inline">{f.away_name}</span><span className="sm:hidden">{f.away_short}</span></span>
                </div>
              </div>
              {!locked && guess && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  The app reckons you&apos;ll go <b className="text-slate-800">{guess.home}-{guess.away}</b>
                  {pick && (pick.home === guess.home && pick.away === guess.away ? " (and so far it's right)" : " (you're proving it wrong)")}
                </p>
              )}
              {locked && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-emerald-700">Everyone&apos;s picks</summary>
                  <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {others.map(({ p, pred }) => {
                      const s = pred && final ? scorePrediction(pred, { home: f.home_score!, away: f.away_score! }, isWild) : null;
                      return (
                        <li key={p.id} className="flex justify-between rounded bg-slate-50 px-2 py-1">
                          <span className={p.id === user.id ? "font-semibold" : ""}>{p.name}</span>
                          <span className="tabular-nums">
                            {pred ? `${pred.home}-${pred.away}` : "—"}
                            {s && <b className={s.points ? "ml-1 text-emerald-700" : "ml-1 text-slate-400"}>+{s.points}</b>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </Card>
          );
        })}
        {openCount > 0 && (
          <div className="sticky bottom-3 z-10">
            <Button className="w-full py-3 text-base shadow-lg">Save picks</Button>
          </div>
        )}
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">
        Scoring: correct result 1 pt · exact score 3 pts · wildcard x2. Picks lock at each match&apos;s kick-off.{" "}
        <Link className="underline" href={`/leaderboard?gw=${gw}`}>See the GW{gw} table</Link>
      </p>
    </div>
  );
}
