import Link from "next/link";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-xl shadow-black/30 backdrop-blur-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, kicker, subtitle, children }: { title: string; kicker?: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-400">{kicker}</p>}
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight text-white sm:text-4xl">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-slate-400">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

const TONES = {
  slate: "bg-white/10 text-slate-200",
  green: "bg-lime-400/15 text-lime-300 ring-1 ring-inset ring-lime-400/30",
  amber: "bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/30",
  red: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30",
  purple: "wildcard-shine text-white shadow-lg shadow-fuchsia-500/30",
  blue: "bg-sky-400/15 text-sky-300 ring-1 ring-inset ring-sky-400/30",
};

export function Badge({ children, tone = "slate", className = "" }: { children: React.ReactNode; tone?: keyof typeof TONES; className?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONES[tone]} ${className}`}>{children}</span>;
}

export function Crest({ code, name, size = 24 }: { code: number | null; name: string; size?: number }) {
  if (!code) return <span className="inline-block rounded-full bg-white/10" style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://resources.premierleague.com/premierleague/badges/70/t${code}.png`} alt={name} width={size} height={size} style={{ width: size, height: size }} className="object-contain drop-shadow" loading="lazy" />;
}

const AVATAR_COLOURS = [
  "from-lime-300 to-emerald-500",
  "from-fuchsia-400 to-pink-600",
  "from-sky-300 to-indigo-500",
  "from-amber-300 to-orange-500",
  "from-rose-300 to-red-500",
  "from-teal-300 to-cyan-600",
  "from-violet-300 to-purple-600",
  "from-yellow-200 to-lime-500",
];

export function Avatar({ id, name, size = "md" }: { id: number; name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const s = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-14 w-14 text-xl", xl: "h-20 w-20 text-3xl" }[size];
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-extrabold text-slate-950 ring-2 ring-black/30 ${AVATAR_COLOURS[id % AVATAR_COLOURS.length]} ${s}`}>
      {initials}
    </span>
  );
}

export function GwPager({ gw, min, max, base, compact = false }: { gw: number; min: number; max: number; base: string; compact?: boolean }) {
  const btn = "grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-lg font-bold text-white transition hover:bg-lime-400 hover:text-slate-950";
  return (
    <div className="flex shrink-0 items-center gap-2">
      {gw > min ? <Link aria-label={`GW${gw - 1}`} className={btn} href={`${base}?gw=${gw - 1}`}>&lsaquo;</Link> : <span className={`${btn} opacity-30`}>&lsaquo;</span>}
      {!compact && <span className="rounded-full bg-lime-400 px-3 py-1.5 font-display text-sm font-extrabold text-slate-950">GW{gw}</span>}
      {gw < max ? <Link aria-label={`GW${gw + 1}`} className={btn} href={`${base}?gw=${gw + 1}`}>&rsaquo;</Link> : <span className={`${btn} opacity-30`}>&rsaquo;</span>}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-lime-400 text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300",
    ghost: "border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  };
  return <button {...props} className={`rounded-xl px-4 py-2 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 ${v[variant]} ${className}`}>{children}</button>;
}

export function Flash({ tone = "ok", children }: { tone?: "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "border-lime-400/30 bg-lime-400/10 text-lime-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return <p className={`animate-pop mb-3 rounded-xl border p-3 text-sm font-medium ${cls}`}>{tone === "ok" ? "✅ " : "⚠️ "}{children}</p>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-7 flex items-center justify-between gap-2">
      <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">{children}</h2>
      {right}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30";

export const tableCls = {
  wrap: "overflow-x-auto p-0",
  table: "w-full text-sm",
  thead: "text-left text-[11px] uppercase tracking-wider text-slate-400",
  th: "px-2 py-2.5 sm:px-3",
  tr: "border-t border-white/5",
  td: "px-2 py-2.5 sm:px-3",
};
