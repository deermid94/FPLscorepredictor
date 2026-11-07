import Link from "next/link";
import { leagueContext, parseGw } from "@/lib/context";
import { getWildcard, isFinal, isLocked } from "@/lib/game";
import { ensureGuesses } from "@/lib/predictor";
import { scorePrediction, euro } from "@/lib/scoring";
import { kickoffLabel, timeUntil } from "@/lib/format";
import { Avatar, Badge, Button, Card, Crest, Flash, GwPager } from "@/components/ui";
import { ScoreInput } from "@/components/ScoreInput";
import { savePicks } from "../actions";

function PointsPill({ points, exact, wildcard }: { points: number; exact: boolean; wildcard: boolean }) {
  if (!points) return <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-slate-400">0 pts</span>;
  return (
    <span className={`animate-pop rounded-full px-2 py-0.5 text-xs font-black ${exact ? "bg-lime-400 text-slate-950 shadow shadow-lime-400/40" : "bg-lime-400/20 text-lime-300"}`}>
      +{points} {exact ? "EXACT!" : "result"}{wildcard ? " ×2" : ""}
    </span>
  );
}

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
  const progress = openCount ? Math.round((pickedOpen / openCount) * 100) : 100;

  return (
    <div>
      {sp.saved && <Flash>{sp.saved}</Flash>}
      {sp.error && <Flash tone="error">{sp.error}</Flash>}

      <div className="relative mb-4 overflow-hidden rounded-3xl border border-lime-400/20 bg-gradient-to-br from-emerald-900/80 via-emerald-950 to-slate-950 p-5 shadow-2xl shadow-black/40">
        <div className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[9rem] font-extrabold leading-none text-white/[0.04]">{gw}</div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-400">Matchday</p>
            <h1 className="font-display text-3xl font-extrabold uppercase leading-none text-white sm:text-4xl">Gameweek {gw}</h1>
          </div>
          <GwPager gw={gw} min={league.start_gw} max={ctx.maxGw} base="/week" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-black/25 p-2">
            <p className="font-display text-2xl font-extrabold text-amber-300">{euro(participants.length * league.fee_cents)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">weekly pot</p>
          </div>
          <div className="rounded-2xl bg-black/25 p-2">
            <p className="font-display text-2xl font-extrabold text-lime-300">{myPoints}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">your pts</p>
          </div>
          <div className="rounded-2xl bg-black/25 p-2">
            <p className="font-display text-2xl font-extrabold text-white">{nextLock?.kickoff ? timeUntil(nextLock.kickoff, now) : "—"}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">next lock</p>
          </div>
        </div>
        {openCount > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span className="text-slate-300">{pickedOpen === openCount ? "All picks in. Nice." : `${pickedOpen}/${openCount} open matches picked`}</span>
              <span className="text-lime-300">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {wildcard && (
          <div className="wildcard-shine relative overflow-hidden rounded-2xl p-[2px] shadow-xl shadow-fuchsia-500/20">
            <div className="flex h-full items-center gap-3 rounded-[14px] bg-slate-950/90 p-4">
              <div className="wildcard-shine grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-2xl font-extrabold text-white">×2</div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-300">Wildcard match</p>
                <p className="flex items-center gap-1.5 font-display text-lg font-extrabold text-white">
                  <Crest code={wildcard.home_code} name={wildcard.home_name} size={20} />
                  {wildcard.home_short} v {wildcard.away_short}
                  <Crest code={wildcard.away_code} name={wildcard.away_name} size={20} />
                </p>
                <p className="text-xs text-slate-400">Drawn at random. Double points, double the shame.</p>
              </div>
            </div>
          </div>
        )}
        <Card className="flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-400/15 text-3xl ring-1 ring-sky-400/30">🤖</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Predict the Predictor</p>
            <p className="font-display text-lg font-extrabold text-white">
              {guessHits}/{judged.length} <span className="text-sm font-semibold text-slate-400">of your picks called exactly</span>
            </p>
            <p className="text-xs text-slate-400">The bot studies your history and guesses before you pick.</p>
          </div>
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
          const others = participants.map((p) => ({ p, pred: data.predByKey.get(`${p.id}:${f.id}`) }));
          const frame = isWild
            ? "border-fuchsia-400/60 bg-fuchsia-500/[0.07] shadow-fuchsia-500/10"
            : locked
              ? "border-white/5 bg-white/[0.025]"
              : "border-white/10 bg-white/[0.05]";
          return (
            <div key={f.id} className={`rounded-2xl border p-4 shadow-xl shadow-black/30 ${frame}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-400">{kickoffLabel(f.kickoff)}</span>
                <span className="flex flex-wrap gap-1">
                  {isWild && <Badge tone="purple">★ Wildcard ×2</Badge>}
                  {f.source === "manual" && <Badge tone="blue">Manual</Badge>}
                  {f.status === "live" && <Badge tone="red"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />Live {f.minutes ? `${f.minutes}'` : ""}</Badge>}
                  {final && <Badge>Full time</Badge>}
                  {f.status === "postponed" && <Badge tone="amber">Postponed</Badge>}
                  {!locked ? <Badge tone="green">🔓 {timeUntil(f.kickoff!, now)}</Badge> : !final && f.status !== "live" && <Badge tone="amber">🔒 Locked</Badge>}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Crest code={f.home_code} name={f.home_name} size={44} />
                  <span className="text-sm font-bold leading-tight text-white"><span className="hidden sm:inline">{f.home_name}</span><span className="sm:hidden">{f.home_short}</span></span>
                </div>
                {locked ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1 rounded-xl bg-black/50 px-3 py-1.5 font-display text-3xl font-extrabold tabular-nums text-white ring-1 ring-white/10">
                      <span>{f.home_score ?? "–"}</span>
                      <span className="text-slate-600">:</span>
                      <span>{f.away_score ?? "–"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>You: <b className="text-slate-200">{pick ? `${pick.home}-${pick.away}` : "no pick"}</b></span>
                    </div>
                    {pts && <PointsPill points={pts.points} exact={pts.exact} wildcard={isWild} />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ScoreInput name={`h_${f.id}`} label={`${f.home_name} score`} initial={pick?.home ?? null} />
                    <span className="font-display text-2xl font-extrabold text-slate-600">:</span>
                    <ScoreInput name={`a_${f.id}`} label={`${f.away_name} score`} initial={pick?.away ?? null} />
                  </div>
                )}
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Crest code={f.away_code} name={f.away_name} size={44} />
                  <span className="text-sm font-bold leading-tight text-white"><span className="hidden sm:inline">{f.away_name}</span><span className="sm:hidden">{f.away_short}</span></span>
                </div>
              </div>
              {!locked && guess && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                  <span className="rounded-full bg-sky-400/10 px-3 py-1 text-sky-200 ring-1 ring-sky-400/20">
                    🤖 Bot reckons you&apos;ll go <b className="text-white">{guess.home}-{guess.away}</b>
                    {pick && (pick.home === guess.home && pick.away === guess.away ? " · so far it's right 😬" : " · you're proving it wrong 😎")}
                  </span>
                </div>
              )}
              {locked && (
                <details className="group mt-3 text-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-xs font-bold uppercase tracking-wide text-lime-300">
                    <span className="flex -space-x-2">{others.slice(0, 6).map(({ p }) => <Avatar key={p.id} id={p.id} name={p.name} size="sm" />)}</span>
                    <span className="ml-1">Everyone&apos;s picks</span>
                    <span className="transition group-open:rotate-180">▾</span>
                  </summary>
                  <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {others.map(({ p, pred }) => {
                      const s = pred && final ? scorePrediction(pred, { home: f.home_score!, away: f.away_score! }, isWild) : null;
                      return (
                        <li key={p.id} className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 ${s?.exact ? "bg-lime-400/15 ring-1 ring-lime-400/30" : "bg-white/5"}`}>
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Avatar id={p.id} name={p.name} size="sm" />
                            <span className={`truncate ${p.id === user.id ? "font-bold text-white" : "text-slate-300"}`}>{p.name}</span>
                          </span>
                          <span className="whitespace-nowrap font-display font-extrabold tabular-nums text-white">
                            {pred ? `${pred.home}-${pred.away}` : "—"}
                            {s && <span className={`ml-1 text-xs ${s.points ? "text-lime-300" : "text-slate-500"}`}>+{s.points}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
        {openCount > 0 && (
          <div className="sticky bottom-24 z-10 sm:bottom-4">
            <Button className="w-full rounded-2xl py-4 font-display text-lg uppercase tracking-wide shadow-2xl shadow-lime-400/30">Save my picks ⚡</Button>
          </div>
        )}
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">
        Result 1 pt · Exact score 3 pts · Wildcard ×2 · Picks lock at each kick-off.{" "}
        <Link className="font-semibold text-lime-300 underline" href={`/leaderboard?gw=${gw}`}>GW{gw} table →</Link>
      </p>
    </div>
  );
}
