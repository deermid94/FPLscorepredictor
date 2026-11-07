import Link from "next/link";
import { leagueContext, parseGw } from "@/lib/context";
import { gameweekTable } from "@/lib/game";
import { euro } from "@/lib/scoring";
import { Badge, Card, Crest, GwPager, PageTitle } from "@/components/ui";

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
  const { league, data } = ctx;
  const latestComplete = (() => {
    for (let g = ctx.currentGw; g >= league.start_gw; g--) if (gameweekTable(data, g).started) return g;
    return league.start_gw;
  })();
  const gw = parseGw(sp.gw, latestComplete, league.start_gw, ctx.maxGw);
  const t = gameweekTable(data, gw);
  const prize = (cents: number) => (cents ? euro(cents) : "");

  return (
    <div>
      <PageTitle
        title={`GW${gw} leaderboard`}
        subtitle={
          <>
            Pot {euro(t.potCents)} · 1st 40% · 2nd 20% · {euro(t.rolloverCents)} to the season pot{" "}
            {!t.complete && <Badge tone="amber">{t.started ? "In progress: prizes are provisional" : "Not started"}</Badge>}
          </>
        }
      >
        <GwPager gw={gw} min={league.start_gw} max={ctx.maxGw} base="/leaderboard" />
      </PageTitle>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">Exact</th>
              <th className="px-3 py-2 text-right">Results</th>
              <th className="px-3 py-2 text-right">Prize</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.player.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{r.rank}</td>
                <td className="px-3 py-2"><Link className="hover:underline" href={`/scouting/${r.player.id}`}>{r.player.name}</Link></td>
                <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{r.points}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.exacts}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.results}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${t.complete ? "text-emerald-700" : "text-slate-400"}`}>{prize(r.prizeCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-500">Ties split the prize money for the places they share. Exact scores only break ties in the display order, not in prize money.</p>

      <h2 className="mb-2 mt-6 text-lg font-bold">Hall of Shame</h2>
      {t.shame ? (
        <Card className="border-rose-200 bg-rose-50">
          <div className="flex items-center gap-2">
            <Badge tone="red">Worst pick of GW{gw}</Badge>
            {t.shame.wildcard && <Badge tone="purple">on the WILDCARD</Badge>}
          </div>
          <p className="mt-2 text-lg font-bold">{t.shame.player.name}</p>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Crest code={t.shame.fixture.home_code} name={t.shame.fixture.home_name} />
            <span>{t.shame.fixture.home_name} v {t.shame.fixture.away_name}</span>
            <Crest code={t.shame.fixture.away_code} name={t.shame.fixture.away_name} />
          </div>
          <p className="mt-1 text-sm">
            Predicted <b>{t.shame.pred.home}-{t.shame.pred.away}</b>. It finished <b>{t.shame.fixture.home_score}-{t.shame.fixture.away_score}</b>.
          </p>
          <p className="mt-1 text-sm italic text-rose-800">
            {shameQuip(t.shame.pred, { home: t.shame.fixture.home_score!, away: t.shame.fixture.away_score! }, t.shame.wildcard)}
          </p>
        </Card>
      ) : (
        <Card className="text-sm text-slate-500">No finished matches yet. Nobody has embarrassed themselves (yet).</Card>
      )}
    </div>
  );
}
