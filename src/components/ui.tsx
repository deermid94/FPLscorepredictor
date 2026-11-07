import Link from "next/link";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" | "purple" | "blue" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    purple: "bg-fuchsia-600 text-white",
    blue: "bg-sky-100 text-sky-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Crest({ code, name }: { code: number | null; name: string }) {
  if (!code) return <span className="inline-block h-6 w-6 rounded-full bg-slate-200" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://resources.premierleague.com/premierleague/badges/70/t${code}.png`} alt={name} width={24} height={24} className="h-6 w-6 object-contain" loading="lazy" />;
}

export function GwPager({ gw, min, max, base }: { gw: number; min: number; max: number; base: string }) {
  const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm";
  return (
    <div className="flex items-center gap-2">
      {gw > min ? <Link className={btn} href={`${base}?gw=${gw - 1}`}>&larr; GW{gw - 1}</Link> : <span className={`${btn} opacity-40`}>&larr;</span>}
      <span className="text-sm font-semibold">GW{gw}</span>
      {gw < max ? <Link className={btn} href={`${base}?gw=${gw + 1}`}>GW{gw + 1} &rarr;</Link> : <span className={`${btn} opacity-40`}>&rarr;</span>}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return <button {...props} className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50 ${v[variant]} ${className}`}>{children}</button>;
}

export const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";
