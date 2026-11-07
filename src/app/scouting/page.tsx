import Link from "next/link";
import { leagueContext } from "@/lib/context";
import { reportFor } from "@/lib/report";
import { Card, PageTitle } from "@/components/ui";

export default async function ScoutingIndex() {
  const { data } = await leagueContext();
  return (
    <div>
      <PageTitle title="Scouting reports" subtitle="We've reverse-engineered your mates. Built only from picks that have locked." />
      <div className="grid gap-3 sm:grid-cols-2">
        {data.players.map((p) => {
          const r = reportFor(data, p.id);
          return (
            <Link key={p.id} href={`/scouting/${p.id}`}>
              <Card className="h-full transition hover:border-emerald-300 hover:shadow">
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold">{p.name}</p>
                  <p className="text-xs text-slate-500">{r.n} picks</p>
                </div>
                <p className="mt-1 text-sm italic text-slate-700">&ldquo;{r.profile}&rdquo;</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded bg-slate-50 p-2"><div className="text-base font-bold">{r.favourite?.key ?? "-"}</div>fave score</div>
                  <div className="rounded bg-slate-50 p-2"><div className="text-base font-bold">{r.optimism}</div>optimism</div>
                  <div className="rounded bg-slate-50 p-2"><div className="text-base font-bold">{Math.round(r.resultRate * 100)}%</div>results right</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
