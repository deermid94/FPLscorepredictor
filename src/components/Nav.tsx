"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/week", label: "This week" },
  { href: "/leaderboard", label: "Weekly" },
  { href: "/season", label: "Season" },
  { href: "/ledger", label: "Ledger" },
  { href: "/scouting", label: "Scouting" },
];

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const links = admin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;
  return (
    <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
      {links.map((l) => {
        const active = path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-white text-emerald-800" : "text-emerald-50 hover:bg-emerald-700"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
