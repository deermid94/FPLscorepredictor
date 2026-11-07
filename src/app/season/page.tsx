import Link from "next/link";
import { leagueContext } from "@/lib/context";
import { seasonTable } from "@/lib/game";
import { euro } from "@/lib/scoring";
import { dateLabel } from "@/lib/format";
import { Badge, Card, PageTitle } from "@/components/ui";

export default async function SeasonPage() {
  const ctx = await leagueContext();
  const s = seasonTable(ctx.data, ctx.currentGw);
  const leader = s.rows[0];
  const gws = s.counted.map((w) => w.gw);
  return (
    <div>
      <PageTitle title="Season standings" subtitle={`From GW${ctx.league.start_gw}. Totals include provisional points from matches already played.`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
          <p className="text-sm font-semibold text-amber-900">Season pot</p>
          <p className="text-4xl font-bold tabular-nums">{euro(s.potCents)}</p>
          <p className="text-xs text-amber-900/70">40% of every completed gameweek rolls in here.</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold">{s.ended ? "Season over" : "Pot goes to the top scorer on"}</p>
          <p className="text-xl font-bold">{ctx.league.season_end_date ? dateLabel(ctx.league.season_end_date) : "Date not set by admin"}</p>
          {s.ended ? (
            <p className="mt-1 text-sm">
              Winner:{" "}
              {s.rows.filter((r) => r.potCents).map((r) => `${r.player.name} (${euro(r.potCents)})`).join(", ")}
            </p>
          ) : (
            leader && <p className="mt-1 text-sm text-slate-500">Currently: <b>{s.rows.filter((r) => r.rank === 1).map((r) => r.player.name).join(" & ")}</b> on {leader.points} pts</p>
          )}
        </Card>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-right">Pts</th>
              {gws.map((g) => <th key={g} className="hidden px-2 py-2 text-right sm:table-cell">GW{g}</th>)}
              <th className="px-3 py-2 text-right">Wins</th>
              <th className="px-3 py-2 text-right">Won</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.player.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{r.rank}</td>
                <td className="px-3 py-2">
                  <Link className="hover:underline" href={`/scouting/${r.player.id}`}>{r.player.name}</Link>
                  {r.potCents > 0 && <span className="ml-1"><Badge tone="amber">Pot winner</Badge></span>}
                </td>
                <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{r.points}</td>
                {gws.map((g) => <td key={g} className="hidden px-2 py-2 text-right tabular-nums text-slate-500 sm:table-cell">{r.byWeek[g] ?? "-"}</td>)}
                <td className="px-3 py-2 text-right tabular-nums">{r.weeklyWins}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">{euro(r.winningsCents + r.potCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-500">Wins = weekly 1st places (shared counts). Won = weekly prizes plus any season pot.</p>
    </div>
  );
}
