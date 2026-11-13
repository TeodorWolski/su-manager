/**
 * Poranny mail: do ponowienia, najgorętsze okazje, nowe terminy z bileterii, pisanie i MGM.
 * Wysyła go /api/notify/morning (cron-job.org 10:35, Vercel — bez GitHuba i jego opóźnień),
 * a scraper na GitHubie (scripts/scrape.ts) tylko jako zapas. Raz dziennie („morning-mail”).
 * „Nowe terminy” = wydarzenia dodane od poprzedniego maila („morning-mail-since”, UTC), więc nie zależą
 * od tego, czy scraper przeszedł przed mailem — co doszło później, będzie w kolejnym.
 * Bez server-only (używa tego skrypt).
 */
import { and, gt, ne } from "drizzle-orm";
import { db, events } from "@/db";
import { sendReport } from "@/scraper/email";
import { getState, setState } from "./app-state";
import { getOpportunities } from "./opportunities";
import { getFollowUps, getMgm, getPlanning, getWhileThere, getWriting } from "./planning";
import { RECURRING_SOURCE } from "./recurring";

const SENT_KEY = "morning-mail";
const SINCE_KEY = "morning-mail-since";
/** Bez zapisanego „od kiedy” (pierwszy raz) — nowe z ostatniej doby. */
const FIRST_LOOKBACK_H = 24;

const utcNow = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const warsawToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });

export async function sendMorningMail({
  force = false,
  dryRun = false,
  log = console.log,
}: {
  force?: boolean;
  /** Bez kluczy Resend: złóż mail i odhacz (testy, lokalnie). Domyślnie bez kluczy nic nie odhaczamy. */
  dryRun?: boolean;
  log?: (m: string) => void;
} = {}) {
  // Bez klucza nie zużywamy dnia — inaczej zapas (scraper na GitHubie, który klucz ma) by już nie wysłał.
  if (!dryRun && !(process.env.RESEND_API_KEY && process.env.REPORT_EMAIL)) {
    log("poranny mail: brak RESEND_API_KEY / REPORT_EMAIL — pomijam, nic nie odhaczam");
    return { sent: false, reason: "brak RESEND_API_KEY / REPORT_EMAIL" };
  }
  const today = warsawToday();
  if (!force && (await getState(SENT_KEY)) === today) {
    log("poranny mail już dziś wysłany");
    return { sent: false, reason: "już dziś" };
  }
  const now = utcNow();
  const since =
    (await getState(SINCE_KEY)) ??
    new Date(Date.now() - FIRST_LOOKBACK_H * 36e5).toISOString().replace("T", " ").slice(0, 19);
  // Przewidywane terminy serii nie są „nowe z bileterii”.
  const added = await db
    .select({ id: events.id })
    .from(events)
    .where(and(gt(events.firstSeenAt, since), ne(events.source, RECURRING_SOURCE)));
  const ids = new Set(added.map((r) => r.id));
  const fresh = ids.size ? (await getOpportunities(ids)).filter((o) => !o.myGigId && o.tab !== "muted") : [];
  const [followUps, { hot }, whileThere, writing, mgm] = await Promise.all([getFollowUps(), getPlanning(), getWhileThere(), getWriting(), getMgm()]);
  log(`mail: ${fresh.length} nowych okazji (od ${since} UTC), ${followUps.length} do ponowienia, ${hot.length} gorących`);
  const sent = await sendReport({ fresh, followUps, hot, whileThere, writing, mgm }, log);
  // Dopiero po udanej wysyłce (błąd Resend → zapas na GitHubie spróbuje jeszcze raz).
  await setState(SENT_KEY, today);
  await setState(SINCE_KEY, now);
  return { sent, fresh: fresh.length, followUps: followUps.length, hot: hot.length };
}
