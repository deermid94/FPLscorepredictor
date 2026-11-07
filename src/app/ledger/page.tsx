import { leagueContext } from "@/lib/context";
import { ledger } from "@/lib/game";
import { euro } from "@/lib/scoring";
import { Avatar, Card, PageTitle, SectionTitle, tableCls as T } from "@/components/ui";

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="p-3">
      <p className={`font-display text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </Card>
  );
}

export default async function LedgerPage() {
  const ctx = await leagueContext();
  const l = ledger(ctx.data, ctx.currentGw);
  const weeks = l.season.weeks;
  const totalOwed = l.rows.reduce((s, r) => s + r.owedCents, 0);
  const totalPaid = l.rows.reduce((s, r) => s + r.paidCents, 0);
  const totalWon = l.rows.reduce((s, r) => s + r.wonCents, 0);
  return (
    <div>
      <PageTitle kicker="Show me the money" title="Ledger" subtitle={`${euro(ctx.league.fee_cents)} per player per gameweek. Tracking only: settle up in the pub. 🍺`} />
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Season pot" value={euro(l.season.potCents)} tone="text-amber-300" />
        <Tile label="Collected" value={euro(totalPaid)} tone="text-white" />
        <Tile label="Outstanding" value={euro(totalOwed - totalPaid)} tone="text-rose-300" />
        <Tile label="Paid out (weekly)" value={euro(totalWon)} tone="text-lime-300" />
      </div>

      <SectionTitle>Who&apos;s paid</SectionTitle>
      <Card className={T.wrap}>
        <table className={T.table}>
          <thead className={T.thead}>
            <tr>
              <th className={`${T.th} sticky left-0 bg-[#0b1913]`}>Player</th>
              {weeks.map((w) => <th key={w.gw} className="px-2 py-2.5 text-center">GW{w.gw}</th>)}
            </tr>
          </thead>
          <tbody>
            {l.rows.map((r) => (
              <tr key={r.player.id} className={T.tr}>
                <td className={`${T.td} sticky left-0 bg-[#0b1913]`}>
                  <span className="flex items-center gap-2 whitespace-nowrap font-semibold text-white"><Avatar id={r.player.id} name={r.player.name} size="sm" />{r.player.name}</span>
                </td>
                {weeks.map((w) => {
                  const wk = r.weeks.find((x) => x.gw === w.gw);
                  return (
                    <td key={w.gw} className="px-2 py-2 text-center">
                      {!wk ? (
                        <span className="text-slate-600">·</span>
                      ) : wk.paid ? (
                        <span title="Paid" className="inline-grid h-7 w-7 place-items-center rounded-full bg-lime-400 text-sm font-black text-slate-950">✓</span>
                      ) : (
                        <span title="Owes" className="inline-grid h-7 w-7 place-items-center rounded-full bg-rose-500/20 text-sm font-black text-rose-300 ring-1 ring-rose-500/40">✗</span>
                      )}
                      {wk && wk.wonCents > 0 && <div className="mt-0.5 text-[11px] font-black text-amber-300">+{euro(wk.wonCents)}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-500"><span className="font-bold text-lime-300">✓</span> paid · <span className="font-bold text-rose-300">✗</span> owes · gold = weekly winnings</p>

      <SectionTitle>Balances</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {l.rows.map((r) => (
          <Card key={r.player.id} className="flex items-center gap-3 p-3">
            <Avatar id={r.player.id} name={r.player.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">{r.player.name}</p>
              <p className="text-xs text-slate-400 tabular-nums">
                Stake {euro(r.owedCents)} · Paid {euro(r.paidCents)} · Won <span className="text-amber-300">{euro(r.wonCents)}</span>
              </p>
              {r.outstandingCents > 0 && <p className="text-xs font-bold text-rose-300">Owes {euro(r.outstandingCents)}</p>}
            </div>
            <div className="text-right">
              <p className={`font-display text-xl font-extrabold tabular-nums ${r.netCents >= 0 ? "text-lime-300" : "text-rose-300"}`}>{r.netCents >= 0 ? "+" : "-"}{euro(Math.abs(r.netCents))}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">net</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">Stake counts every gameweek since the player joined, including the current one. Weekly winnings are added once every match in the gameweek is finished.</p>
    </div>
  );
}
