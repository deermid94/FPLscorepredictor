import Link from "next/link";
import { leagueContext } from "@/lib/context";
import { optimismLabel, reportFor } from "@/lib/report";
import { Avatar, PageTitle } from "@/components/ui";

export default async function ScoutingIndex() {
  const { data } = await leagueContext();
  return (
    <div>
      <PageTitle kicker="Reverse-engineering your mates" title="Scouting" subtitle="Built only from picks that have locked, so no peeking at open picks." />
      <div className="grid gap-3 sm:grid-cols-2">
        {data.players.map((p) => {
          const r = reportFor(data, p.id);
          const opt = optimismLabel(r.optimism);
          return (
            <Link key={p.id} href={`/scouting/${p.id}`} className="group">
              <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 shadow-xl shadow-black/30 transition group-hover:-translate-y-0.5 group-hover:border-lime-400/40">
                <div className="flex items-center gap-3">
                  <Avatar id={p.id} name={p.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-2xl font-extrabold text-white">{p.name}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{r.n} picks scouted</p>
                  </div>
                  <span className="text-3xl" title="Optimism">{opt.emoji}</span>
                </div>
                <p className="mt-3 rounded-xl bg-black/25 p-3 text-sm font-medium italic text-slate-200">&ldquo;{r.profile}&rdquo;</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/5 p-2"><div className="font-display text-xl font-extrabold text-white">{r.favourite?.key ?? "-"}</div><div className="text-[10px] font-bold uppercase text-slate-400">fave score</div></div>
                  <div className="rounded-xl bg-white/5 p-2"><div className={`font-display text-xl font-extrabold ${opt.tone}`}>{r.optimism}</div><div className="text-[10px] font-bold uppercase text-slate-400">optimism</div></div>
                  <div className="rounded-xl bg-white/5 p-2"><div className="font-display text-xl font-extrabold text-lime-300">{Math.round(r.resultRate * 100)}%</div><div className="text-[10px] font-bold uppercase text-slate-400">results right</div></div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
