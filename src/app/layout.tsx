import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import { connection } from "next/server";
import { MiniCalendar } from "@/components/mini-calendar";
import { ReviewGate } from "@/components/review-gate";
import { TabBar } from "@/components/tab-bar";
import { ThemeProvider } from "@/components/theme";
import { currentSession } from "@/lib/auth";
import { getFormOptions, getPendingReviews } from "@/lib/queries";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SU Manager",
  description: "Grania, ludzie, materiał.",
  appleWebApp: { capable: true, title: "SU Manager", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#131312" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Wszystko jest dynamiczne — dane z bazy, jeden użytkownik, nic do cache'owania.
  await connection();
  // Bez sesji (ekran logowania): sama treść — żadnych danych w pasku, kalendarzu ani bramce oceny.
  const authed = !!(await currentSession());
  const pending = authed ? await getPendingReviews() : [];
  const options = pending.length ? await getFormOptions() : null;

  return (
    <html lang="pl" suppressHydrationWarning className={`${instrument.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider>
          {authed && <TabBar />}
          <main className="mx-auto max-w-2xl px-4 pt-[env(safe-area-inset-top)] pb-28 md:pt-14 md:pb-16">
            {children}
          </main>
          {authed && <MiniCalendar />}
          {pending[0] && options && (
            <ReviewGate gig={pending[0]} remaining={pending.length} options={options} />
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
