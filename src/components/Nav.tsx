"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Goal, Search, Settings, Trophy, Wallet } from "lucide-react";

const LINKS = [
  { href: "/week", label: "Picks", icon: Goal },
  { href: "/leaderboard", label: "Weekly", icon: Trophy },
  { href: "/season", label: "Season", icon: Crown },
  { href: "/ledger", label: "Ledger", icon: Wallet },
  { href: "/scouting", label: "Scouting", icon: Search },
];

export function Nav({ admin, variant }: { admin: boolean; variant: "top" | "bottom" }) {
  const path = usePathname();
  const links = admin ? [...LINKS, { href: "/admin", label: "Admin", icon: Settings }] : LINKS;
  if (variant === "top") {
    return (
      <nav className="hidden gap-1 sm:flex">
        {links.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${active ? "bg-lime-400 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#06120d]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <div className="mx-auto flex max-w-md justify-around px-1">
        {links.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className="flex flex-1 flex-col items-center gap-0.5 py-2">
              <span className={`grid h-8 w-11 place-items-center rounded-full transition ${active ? "bg-lime-400/20 text-lime-300 ring-1 ring-lime-400/50" : "text-slate-400"}`}><l.icon size={20} strokeWidth={2.25} aria-hidden /></span>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${active ? "text-lime-300" : "text-slate-400"}`}>{l.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
