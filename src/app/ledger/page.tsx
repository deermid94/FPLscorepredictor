import { leagueContext } from "@/lib/context";
import { ledger } from "@/lib/game";
import { euro } from "@/lib/scoring";
import { Badge, Card, PageTitle } from "@/components/ui";

export default async function LedgerPage() {
  const ctx = await leagueContext();
  const l = ledger(ctx.data, ctx.currentGw);
  const weeks = l.season.weeks;
  const totalOwed = l.rows.reduce((s, r) => s + r.owedCents, 0);
  const totalPaid = l.rows.reduce((s, r) => s + r.paidCents, 0);
  const totalWon = l.rows.reduce((s, r) => s + r.wonCents, 0);
  return (
    <div>
      <PageTitle title="Ledger" subtitle={`${euro(ctx.league.fee_cents)} per player per gameweek. Tracking only: settle up in the pub.`} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-slate-500">Season pot</p><p className="text-2xl font-bold">{euro(l.season.potCents)}</p></Card>
        <Card><p className="text-xs text-slate-500">Collected</p><p className="text-2xl font-bold">{euro(totalPaid)}</p></Card>
        <Card><p className="text-xs text-slate-500">Outstanding</p><p className="text-2xl font-bold text-rose-700">{euro(totalOwed - totalPaid)}</p></Card>
        <Card><p className="text-xs text-slate-500">Paid out (weekly)</p><p className="text-2xl font-bold text-emerald-700">{euro(totalWon)}</p></Card>
      </div>

      <h2 className="mb-2 text-lg font-bold">Who&apos;s paid</h2>
      <Card className="mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-2 py-2 sm:px-3 text-left">Player</th>
              {weeks.map((w) => <th key={w.gw} className="px-2 py-2 text-center">GW{w.gw}</th>)}
            </tr>
          </thead>
          <tbody>
            {l.rows.map((r) => (
              <tr key={r.player.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-2 py-2 sm:px-3 font-medium">{r.player.name}</td>
                {weeks.map((w) => {
                  const wk = r.weeks.find((x) => x.gw === w.gw);
                  return (
                    <td key={w.gw} className="px-2 py-2 text-center">
                      {!wk ? <span className="text-slate-300">n/a</span> : wk.paid ? <Badge tone="green">Paid</Badge> : <Badge tone="red">Owes</Badge>}
                      {wk && wk.wonCents > 0 && <div className="mt-0.5 text-xs font-semibold text-emerald-700">+{euro(wk.wonCents)}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-2 text-lg font-bold">Balances</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-2 py-2 sm:px-3 text-left">Player</th>
              <th className="whitespace-nowrap px-2 py-2 sm:px-3 text-right">Stake</th>
              <th className="whitespace-nowrap px-2 py-2 sm:px-3 text-right">Paid</th>
              <th className="whitespace-nowrap px-2 py-2 sm:px-3 text-right">Owes</th>
              <th className="whitespace-nowrap px-2 py-2 sm:px-3 text-right">Won</th>
              <th className="whitespace-nowrap px-2 py-2 sm:px-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {l.rows.map((r) => (
              <tr key={r.player.id} className="border-t border-slate-100 tabular-nums">
                <td className="whitespace-nowrap px-2 py-2 sm:px-3 font-medium">{r.player.name}</td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3 text-right">{euro(r.owedCents)}</td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3 text-right">{euro(r.paidCents)}</td>
                <td className={`whitespace-nowrap px-2 py-2 sm:px-3 text-right ${r.outstandingCents ? "font-semibold text-rose-700" : "text-slate-400"}`}>{euro(r.outstandingCents)}</td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3 text-right text-emerald-700">{euro(r.wonCents)}</td>
                <td className={`whitespace-nowrap px-2 py-2 sm:px-3 text-right font-bold ${r.netCents >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{r.netCents >= 0 ? "+" : "-"}{euro(Math.abs(r.netCents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-500">Stake counts every gameweek since the player joined, including the current one. Weekly winnings are added once every match in the gameweek is finished.</p>
    </div>
  );
}
