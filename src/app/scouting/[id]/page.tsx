import Link from "next/link";
import { notFound } from "next/navigation";
import { leagueContext } from "@/lib/context";
import { optimismLabel, reportFor } from "@/lib/report";
import { Avatar, Card, SectionTitle } from "@/components/ui";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

function Stat({ icon, label, value, hint }: { icon: string; label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span className="text-base">{icon}</span>{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold leading-tight text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

export default async function ScoutingReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await leagueContext();
  const player = data.players.find((p) => p.id === Number(id));
  if (!player) notFound();
  const r = reportFor(data, player.id);
  const opt = optimismLabel(r.optimism);
  const labels = { H: "Home win", D: "Draw", A: "Away win" } as const;

  return (
    <div>
      <Link href="/scouting" className="mb-3 inline-block text-sm font-semibold text-lime-300">← All players</Link>
      <div className="relative mb-4 overflow-hidden rounded-3xl border border-lime-400/20 bg-gradient-to-br from-emerald-900/70 via-slate-950 to-slate-950 p-5 shadow-2xl shadow-black/40">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-400">Scouting report</p>
        <div className="mt-2 flex items-center gap-4">
          <Avatar id={player.id} name={player.name} size="xl" />
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-white">{player.name}</h1>
            <p className="mt-1 text-sm text-slate-400">{r.n} locked picks · {r.finished} with a final score</p>
          </div>
        </div>
        <p className="mt-4 rounded-2xl bg-black/30 p-4 text-lg font-semibold italic leading-snug text-white">&ldquo;{r.profile}&rdquo;</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon="🎯" label="Fave scoreline" value={r.favourite?.key ?? "-"} hint={r.favourite ? `Picked ${r.favourite.count}× (${pct(r.favourite.count / r.n)})` : undefined} />
        <Stat icon={opt.emoji} label="Optimism" value={<span className={opt.tone}>{r.optimism}</span>} hint="Predicted goals as % of actual. 100 = realistic." />
        <Stat icon="⚽" label="Goals / game" value={`${r.avgPred.toFixed(1)} v ${r.avgActual.toFixed(1)}`} hint="Predicted v reality" />
        <Stat
          icon="❤️"
          label="Over-backs"
          value={r.overBacked?.name ?? "Nobody"}
          hint={r.overBacked ? `Tipped them ${r.overBacked.predictedWins}/${r.overBacked.matches}; they won ${r.overBacked.actualWins}` : "No obvious soft spot"}
        />
        <Stat icon="✅" label="Results right" value={<span className="text-lime-300">{pct(r.resultRate)}</span>} hint={`${r.exactCount} exact scores`} />
        <Stat
          icon="🤖"
          label="Bot hit rate"
          value={<span className="text-sky-300">{r.predictor.judged ? pct(r.predictor.exact / r.predictor.judged) : "-"}</span>}
          hint={`Called ${r.predictor.exact}/${r.predictor.judged} exactly, ${r.predictor.result}/${r.predictor.judged} on result`}
        />
      </div>

      <SectionTitle>Home / away bias</SectionTitle>
      <Card>
        <div className="space-y-4">
          {r.outcomes.map((o) => (
            <div key={o.o}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-bold text-white">{labels[o.o]}</span>
                <span className="tabular-nums text-slate-400">
                  {pct(o.predicted)} v {pct(o.actual)}{" "}
                  <b className={o.predicted - o.actual > 0.05 ? "text-amber-300" : o.predicted - o.actual < -0.05 ? "text-sky-300" : "text-slate-300"}>({signed(o.predicted - o.actual)})</b>
                </span>
              </div>
              <div className="relative h-3.5 rounded-full bg-black/40">
                <div className="absolute h-3.5 rounded-full bg-gradient-to-r from-lime-400 to-emerald-400" style={{ width: pct(o.predicted) }} />
                <div className="absolute -top-1 h-5.5 w-1 rounded bg-white shadow" style={{ left: pct(o.actual) }} title="Reality" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Green bar = how often they predict it. White marker = how often it actually happened.</p>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat icon="🥱" label="0-0s predicted" value={r.zeroZero} />
        <Stat icon="🤝" label="Draws predicted" value={`${r.draws} (${pct(r.drawRate)})`} />
      </div>
    </div>
  );
}
