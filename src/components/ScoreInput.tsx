"use client";

import { useState } from "react";

export function ScoreInput({ name, label, initial }: { name: string; label: string; initial: number | null }) {
  const [v, setV] = useState(initial == null ? "" : String(initial));
  const n = v === "" ? null : Number(v);
  const set = (x: number) => setV(String(Math.max(0, Math.min(20, x))));
  const step = "h-7 w-12 text-lg font-black leading-none text-lime-300 transition active:bg-lime-400 active:text-slate-950 disabled:opacity-30";
  return (
    <div className="flex flex-col items-center overflow-hidden rounded-xl border border-white/15 bg-slate-950/70">
      <button type="button" aria-label={`${label} plus one`} onClick={() => set((n ?? -1) + 1)} className={step}>+</button>
      <input
        name={name}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        value={v}
        placeholder="–"
        onChange={(e) => setV(e.target.value)}
        onFocus={(e) => e.target.select()}
        className={`h-11 w-12 border-y border-white/10 bg-transparent text-center font-display text-3xl font-extrabold tabular-nums text-white placeholder:text-slate-600 focus:bg-lime-400/10 focus:outline-none ${v !== "" ? "animate-pop" : ""}`}
      />
      <button type="button" aria-label={`${label} minus one`} disabled={n == null || n <= 0} onClick={() => set((n ?? 0) - 1)} className={step}>−</button>
    </div>
  );
}
