import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { getLeague } from "@/lib/game";
import { Nav } from "@/components/Nav";
import { logout } from "./actions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Score Predictor League",
  description: "Premier League score predictions for you and your mates",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#047857" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const league = user ? await getLeague(user.league_id) : null;
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}>
        <header className="sticky top-0 z-10 bg-emerald-800 text-white shadow">
          <div className="mx-auto max-w-3xl px-4 pt-3">
            <div className="flex items-center justify-between gap-2 pb-2">
              <Link href="/" className="font-bold tracking-tight">
                Score Predictor League
                {league && <span className="ml-2 hidden text-sm font-normal text-emerald-200 sm:inline">{league.name}</span>}
              </Link>
              {user && (
                <form action={logout} className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-100">{user.name}</span>
                  <button className="rounded-md bg-emerald-900/60 px-2 py-1 text-xs hover:bg-emerald-900">Log out</button>
                </form>
              )}
            </div>
            {user && <Nav admin={!!user.is_admin} />}
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
