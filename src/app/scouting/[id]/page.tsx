import Link from "next/link";
import { notFound } from "next/navigation";
import { leagueContext } from "@/lib/context";
import { reportFor } from "@/lib/report";
import { Card, PageTitle } from "@/components/ui";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export default async function ScoutingReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await leagueContext();
  const player = data.players.find((p) => p.id === Number(id));
  if (!player) notFound();
  const r = reportFor(data, player.id);
  const labels = { H: "Home win", D: "Draw", A: "Away win" } as const;

  return (
    <div>
      <PageTitle title={`Scouting report: ${player.name}`} subtitle={`${r.n} locked picks, ${r.finished} with a final score`}>
        <Link href="/scouting" className="text-sm text-emerald-700 underline">All players</Link>
      </PageTitle>
      <Card className="mb-4 border-emerald-200 bg-emerald-50">
        <p className="text-xs font-semibold uppercase text-emerald-800">Profile</p>
        <p className="mt-1 text-lg font-semibold italic">&ldquo;{r.profile}&rdquo;</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Favourite scoreline" value={r.favourite?.key ?? "-"} hint={r.favourite ? `Picked ${r.favourite.count} times (${pct(r.favourite.count / r.n)})` : undefined} />
        <Stat label="Optimism score" value={r.optimism} hint="Predicted goals as a % of actual goals. 100 = realistic." />
        <Stat label="Goals per game" value={`${r.avgPred.toFixed(1)} v ${r.avgActual.toFixed(1)}`} hint="Predicted v what actually happened" />
        <Stat
          label="Team they over-back"
          value={r.overBacked?.name ?? "None"}
          hint={r.overBacked ? `Tipped them to win ${r.overBacked.predictedWins}/${r.overBacked.matches}; they won ${r.overBacked.actualWins}` : "No obvious soft spot"}
        />
        <Stat label="Results right" value={pct(r.resultRate)} hint={`${r.exactCount} exact scores`} />
        <Stat
          label="Predict the Predictor"
          value={r.predictor.judged ? pct(r.predictor.exact / r.predictor.judged) : "-"}
          hint={`App called ${r.predictor.exact}/${r.predictor.judged} picks exactly, ${r.predictor.result}/${r.predictor.judged} on result`}
        />
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold">Home / away bias</h2>
      <Card>
        <div className="space-y-3">
          {r.outcomes.map((o) => (
            <div key={o.o}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{labels[o.o]}</span>
                <span className="tabular-nums text-slate-500">
                  predicts {pct(o.predicted)} · reality {pct(o.actual)} <b className={o.predicted - o.actual > 0.05 ? "text-amber-700" : o.predicted - o.actual < -0.05 ? "text-sky-700" : ""}>({signed(o.predicted - o.actual)})</b>
                </span>
              </div>
              <div className="relative h-3 rounded bg-slate-100">
                <div className="absolute h-3 rounded bg-emerald-500" style={{ width: pct(o.predicted) }} />
                <div className="absolute top-0 h-3 w-0.5 bg-slate-900" style={{ left: pct(o.actual) }} title="Reality" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Green bar = how often they predict it. Black line = how often it actually happened in those matches.</p>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="0-0s predicted" value={r.zeroZero} />
        <Stat label="Draws predicted" value={`${r.draws} (${pct(r.drawRate)})`} />
      </div>
    </div>
  );
}
