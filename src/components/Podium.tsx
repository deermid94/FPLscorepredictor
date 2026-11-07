import Link from "next/link";
import { Avatar } from "./ui";

type Entry = { player: { id: number; name: string }; rank: number; points: number; extra?: React.ReactNode };

const STYLES = [
  { h: "h-28", bar: "from-amber-300 to-amber-500", medal: "🥇", ring: "ring-amber-300" },
  { h: "h-20", bar: "from-slate-200 to-slate-400", medal: "🥈", ring: "ring-slate-300" },
  { h: "h-14", bar: "from-orange-300 to-orange-600", medal: "🥉", ring: "ring-orange-400" },
];

export function Podium({ entries }: { entries: Entry[] }) {
  const top = entries.slice(0, 3);
  if (!top.length) return null;
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : [top[0]];
  return (
    <div className="mb-4 flex items-end justify-center gap-2 pt-2">
      {order.map((e) => {
        const s = STYLES[Math.min(e.rank, 3) - 1];
        return (
          <Link key={e.player.id} href={`/scouting/${e.player.id}`} className="animate-pop flex w-28 flex-col items-center">
            <span className="text-2xl">{s.medal}</span>
            <span className={`rounded-full ring-2 ${s.ring}`}><Avatar id={e.player.id} name={e.player.name} size={e.rank === 1 ? "lg" : "md"} /></span>
            <span className="mt-1 max-w-full truncate text-sm font-bold text-white">{e.player.name}</span>
            <span className="font-display text-xl font-extrabold text-lime-300">{e.points} <span className="text-xs text-slate-400">pts</span></span>
            {e.extra}
            <div className={`mt-1 w-full rounded-t-xl bg-gradient-to-b ${s.bar} ${s.h} flex items-start justify-center pt-1 font-display text-2xl font-extrabold text-slate-950/70`}>{e.rank}</div>
          </Link>
        );
      })}
    </div>
  );
}
