import Link from "next/link";
import { leagueContext, parseGw } from "@/lib/context";
import { gameweekTable } from "@/lib/game";
import { euro } from "@/lib/scoring";
import { Avatar, Badge, Card, Crest, GwPager, PageTitle, SectionTitle } from "@/components/ui";
import { Podium } from "@/components/Podium";

function shameQuip(pred: { home: number; away: number }, actual: { home: number; away: number }, wildcard: boolean) {
  const predTotal = pred.home + pred.away, actualTotal = actual.home + actual.away;
  if (wildcard) return "And they did it on the wildcard. Twice the shame.";
  if (predTotal - actualTotal >= 3) return "Expected fireworks. Got a damp squib.";
  if (actualTotal - predTotal >= 3) return "Called a snoozefest. Missed a goal-fest.";
  if ((pred.home > pred.away) !== (actual.home > actual.away) && pred.home !== pred.away && actual.home !== actual.away)
    return "Backed the wrong team entirely. Bold. Wrong, but bold.";
  return "Not even close.";
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await leagueContext();
  const { league, data, user } = ctx;
  const latestComplete = (() => {
    for (let g = ctx.currentGw; g >= league.start_gw; g--) if (gameweekTable(data, g).started) return g;
    return league.start_gw;
  })();
  const gw = parseGw(sp.gw, latestComplete, league.start_gw, ctx.maxGw);
  const t = gameweekTable(data, gw);
  const prizeChip = (cents: number) =>
    cents ? <span className={`rounded-full px-2 py-0.5 text-xs font-black ${t.complete ? "bg-amber-400 text-slate-950" : "bg-amber-400/15 text-amber-300"}`}>{euro(cents)}</span> : null;

  return (
    <div>
      <PageTitle
        kicker="Weekly table"
        title={`Gameweek ${gw}`}
        subtitle={!t.complete && <Badge tone="amber">{t.started ? "⏱ In progress · prizes provisional" : "Not started"}</Badge>}
      >
        <GwPager gw={gw} min={league.start_gw} max={ctx.maxGw} base="/leaderboard" />
      </PageTitle>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Card className="p-3"><p className="font-display text-2xl font-extrabold text-amber-300">{euro(t.potCents)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">pot</p></Card>
        <Card className="p-3"><p className="font-display text-2xl font-extrabold text-white">40/20</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">% to 1st/2nd</p></Card>
        <Card className="p-3"><p className="font-display text-2xl font-extrabold text-lime-300">{euro(t.rolloverCents)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">to season pot</p></Card>
      </div>

      <Podium entries={t.rows.map((r) => ({ ...r, extra: prizeChip(r.prizeCents) }))} />

      <Card className="divide-y divide-white/5 p-0">
        {t.rows.map((r) => (
          <Link key={r.player.id} href={`/scouting/${r.player.id}`} className={`flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/5 ${r.player.id === user.id ? "bg-lime-400/[0.06]" : ""}`}>
            <span className="w-6 text-center font-display text-lg font-extrabold text-slate-400">{r.rank}</span>
            <Avatar id={r.player.id} name={r.player.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-white">{r.player.name}{r.player.id === user.id && <span className="ml-1 text-xs text-lime-300">(you)</span>}</span>
              <span className="block text-xs text-slate-400">{r.exacts} exact · {r.results} results</span>
            </span>
            {prizeChip(r.prizeCents)}
            <span className="w-10 text-right font-display text-2xl font-extrabold tabular-nums text-white">{r.points}</span>
          </Link>
        ))}
      </Card>
      <p className="mt-2 text-xs text-slate-500">Ties split the prize money for the places they share. Exact scores only break ties in the display order, not in prize money.</p>

      <SectionTitle>🤡 Hall of Shame</SectionTitle>
      {t.shame ? (
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/80 to-slate-950 p-5 shadow-xl shadow-rose-900/20">
          <span className="stamp absolute right-3 top-3 rounded-md px-1.5 py-0.5 font-display text-xs font-extrabold uppercase text-rose-400/80">Shameful</span>
          <div className="flex items-center gap-3 pr-20">
            <Avatar id={t.shame.player.id} name={t.shame.player.name} size="lg" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-300">Worst pick of GW{gw}{t.shame.wildcard && " · on the wildcard"}</p>
              <p className="font-display text-2xl font-extrabold text-white">{t.shame.player.name}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-black/30 p-3 text-center">
            <div className="flex flex-col items-center gap-1"><Crest code={t.shame.fixture.home_code} name={t.shame.fixture.home_name} size={32} /><span className="text-xs font-bold">{t.shame.fixture.home_short}</span></div>
            <div className="flex items-center gap-3">
              <div><p className="text-[10px] font-bold uppercase text-rose-300">Said</p><p className="font-display text-2xl font-extrabold text-rose-300 line-through decoration-2">{t.shame.pred.home}-{t.shame.pred.away}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Actual</p><p className="font-display text-2xl font-extrabold text-white">{t.shame.fixture.home_score}-{t.shame.fixture.away_score}</p></div>
            </div>
            <div className="flex flex-col items-center gap-1"><Crest code={t.shame.fixture.away_code} name={t.shame.fixture.away_name} size={32} /><span className="text-xs font-bold">{t.shame.fixture.away_short}</span></div>
          </div>
          <p className="mt-3 text-center text-sm font-semibold italic text-rose-200">
            &ldquo;{shameQuip(t.shame.pred, { home: t.shame.fixture.home_score!, away: t.shame.fixture.away_score! }, t.shame.wildcard)}&rdquo;
          </p>
        </div>
      ) : (
        <Card className="text-center text-sm text-slate-400">😇 No finished matches yet. Nobody has embarrassed themselves (yet).</Card>
      )}
    </div>
  );
}
