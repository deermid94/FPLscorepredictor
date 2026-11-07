import Link from "next/link";
import { leagueContext } from "@/lib/context";
import { seasonTable } from "@/lib/game";
import { euro } from "@/lib/scoring";
import { dateLabel, timeUntil } from "@/lib/format";
import { Avatar, Badge, Card, PageTitle } from "@/components/ui";
import { Podium } from "@/components/Podium";
import { Crown, Trophy } from "lucide-react";

export default async function SeasonPage() {
  const ctx = await leagueContext();
  const s = seasonTable(ctx.data, ctx.currentGw);
  const leaders = s.rows.filter((r) => r.rank === 1);
  const gws = s.counted.map((w) => w.gw);
  const best = Math.max(1, ...s.rows.flatMap((r) => gws.map((g) => r.byWeek[g] ?? 0)));
  const end = ctx.league.season_end_date;
  return (
    <div>
      <PageTitle kicker="The long game" title="Season" subtitle={`From GW${ctx.league.start_gw}. Includes provisional points from matches already played.`} />

      <div className="relative mb-5 overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-500/25 via-amber-900/30 to-slate-950 p-5 shadow-2xl shadow-amber-900/20">
        <Trophy aria-hidden size={84} strokeWidth={1.5} className="animate-float pointer-events-none absolute right-4 top-4 text-amber-300/70" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Season pot</p>
        <p className="font-display text-6xl font-extrabold tabular-nums text-white drop-shadow">{euro(s.potCents)}</p>
        <p className="mt-1 text-sm text-amber-100/80">
          {s.ended ? (
            <>Season over. Winner: <b className="text-white">{s.rows.filter((r) => r.potCents).map((r) => `${r.player.name} (${euro(r.potCents)})`).join(", ")}</b></>
          ) : end ? (
            <>Goes to the top scorer on <b className="text-white">{dateLabel(end)}</b> · {timeUntil(`${end}T23:59:59Z`)} to go</>
          ) : (
            "Admin hasn't set the season end date yet."
          )}
        </p>
        {!s.ended && leaders.length > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-sm">
            <Crown aria-hidden size={16} className="text-amber-300" /> <b className="text-white">{leaders.map((r) => r.player.name).join(" & ")}</b> <span className="text-amber-200">{leaders[0].points} pts</span>
          </p>
        )}
      </div>

      <Podium entries={s.rows.map((r) => ({ ...r, extra: r.potCents > 0 ? <Badge tone="amber">Pot winner</Badge> : null }))} />

      <Card className="divide-y divide-white/5 p-0">
        {s.rows.map((r) => (
          <Link key={r.player.id} href={`/scouting/${r.player.id}`} className={`flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/5 ${r.player.id === ctx.user.id ? "bg-lime-400/[0.06]" : ""}`}>
            <span className="w-6 text-center font-display text-lg font-extrabold text-slate-400">{r.rank}</span>
            <Avatar id={r.player.id} name={r.player.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-white">{r.player.name}</span>
              <span className="block text-xs text-slate-400">
                {r.weeklyWins} weekly win{r.weeklyWins === 1 ? "" : "s"} · won <b className="text-amber-300">{euro(r.winningsCents + r.potCents)}</b>
              </span>
            </span>
            <span className="hidden h-8 items-end gap-0.5 sm:flex" title="Points per gameweek">
              {gws.map((g) => (
                <span key={g} className="w-2 rounded-t bg-lime-400/70" style={{ height: `${Math.max(8, ((r.byWeek[g] ?? 0) / best) * 100)}%` }} title={`GW${g}: ${r.byWeek[g] ?? 0}`} />
              ))}
            </span>
            <span className="w-12 text-right font-display text-2xl font-extrabold tabular-nums text-white">{r.points}</span>
          </Link>
        ))}
      </Card>
      <p className="mt-2 text-xs text-slate-500">Wins = weekly 1st places (shared counts). Won = weekly prizes plus any season pot.</p>
    </div>
  );
}
