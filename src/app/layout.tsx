import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { getLeague } from "@/lib/game";
import { Nav } from "@/components/Nav";
import { Avatar } from "@/components/ui";
import { logout } from "./actions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["700", "800"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Score Predictor League",
  description: "Premier League score predictions for you and your mates",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#06120d" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const league = user ? await getLeague(user.league_id) : null;
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${display.variable} min-h-screen font-sans antialiased`}>
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#06120d]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="animate-float grid h-9 w-9 place-items-center rounded-xl bg-lime-400 text-xl shadow-lg shadow-lime-400/30">⚽</span>
              <span className="leading-none">
                <span className="block font-display text-lg font-extrabold uppercase tracking-tight text-white">Score Predictor</span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-lime-400">{league?.name ?? "League"}</span>
              </span>
            </Link>
            {user && (
              <div className="flex items-center gap-3">
                <Nav admin={!!user.is_admin} variant="top" />
                <form action={logout} className="flex items-center gap-2">
                  <Avatar id={user.id} name={user.name} size="sm" />
                  <button className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10" title="Log out">
                    Log out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className={`mx-auto max-w-3xl px-4 py-5 ${user ? "pb-28 sm:pb-10" : ""}`}>{children}</main>
        {user && <Nav admin={!!user.is_admin} variant="bottom" />}
      </body>
    </html>
  );
}
