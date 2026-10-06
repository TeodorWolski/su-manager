/**
 * Codzienny przebieg scrapera (GitHub Actions, patrz .github/workflows/scrape.yml).
 * 1. zbiera wydarzenia ze wszystkich serwisów (błąd jednego nie blokuje reszty),
 * 2. zapisuje nowe / odświeża znane (deduplikacja po tytuł+data+miejsce),
 * 3. wysyła poranny mail: do ponowienia + najgorętsze okazje + nowe okazje (jeśli cokolwiek z tego jest).
 *    Pierwszy przebieg tylko zasila bazę.
 *
 * Lokalnie: pnpm scrape   (bez RESEND_API_KEY mail jest tylko logowany)
 */
import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";
import { db, events } from "@/db";
import { dedupeKey, getOpportunities } from "@/lib/opportunities";
import { getFollowUps, getPlanning } from "@/lib/planning";
import { sendReport } from "@/scraper/email";
import { fetchHtml } from "@/scraper/http";
import { SOURCES } from "@/scraper/sources";
import type { ScrapedEvent } from "@/scraper/types";

const HORIZON_DAYS = 90;
const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function main() {
  const until = new Date(Date.now() + HORIZON_DAYS * 864e5).toISOString().slice(0, 10);
  const existing = await db.select().from(events);
  const firstRun = existing.length === 0;
  const bySource = new Map(existing.map((e) => [`${e.source}:${e.sourceId}`, e]));

  const failures: string[] = [];
  const scraped: ScrapedEvent[] = [];
  for (const source of SOURCES) {
    const known = new Map(existing.filter((e) => e.source === source.name).map((e) => [e.sourceId, e as ScrapedEvent]));
    try {
      const found = await source.scrape({ fetchHtml, known, until, log });
      log(`${source.name}: ${found.length} wydarzeń`);
      scraped.push(...found);
    } catch (e) {
      failures.push(`${source.name}: ${(e as Error).message}`);
      log(`BŁĄD ${source.name}: ${(e as Error).stack}`);
    }
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const toInsert: (typeof events.$inferInsert)[] = [];
  const seenIds: number[] = [];
  for (const s of scraped) {
    const key = dedupeKey(s.title, s.startsAt, s.venueName);
    const prev = bySource.get(`${s.source}:${s.sourceId}`);
    if (!prev) {
      toInsert.push({ ...s, dedupeKey: key, lastSeenAt: now });
      continue;
    }
    seenIds.push(prev.id);
    if (s.availability !== undefined && s.availability !== prev.availability) {
      await db.update(events).set({ availability: s.availability }).where(eq(events.id, prev.id));
    }
    // Organizator poprawił tytuł/datę/godzinę/miejsce — aktualizujemy rekord.
    if (prev.dedupeKey !== key || prev.url !== s.url || prev.startsAt !== s.startsAt) {
      try {
        await db
          .update(events)
          .set({ title: s.title, startsAt: s.startsAt, cityName: s.cityName, venueName: s.venueName, url: s.url, dedupeKey: key })
          .where(eq(events.id, prev.id));
      } catch {
        log(`pomijam aktualizację ${s.source}:${s.sourceId} (duplikat z innego serwisu)`);
      }
    }
  }

  const newIds = new Set<number>();
  for (const part of chunk(toInsert, 100)) {
    const rows = await db.insert(events).values(part).onConflictDoNothing().returning({ id: events.id });
    rows.forEach((r) => newIds.add(r.id));
  }
  for (const part of chunk(seenIds, 500)) {
    await db.update(events).set({ lastSeenAt: now }).where(inArray(events.id, part));
  }
  const total = await db.select({ n: sql<number>`count(*)` }).from(events);
  log(`zapisano: ${newIds.size} nowych, ${seenIds.length} odświeżonych, ${toInsert.length - newIds.size} duplikatów; w bazie ${total[0].n}`);

  if (firstRun) {
    log("pierwszy przebieg — tylko zasilam bazę, bez maila");
  } else {
    const fresh = newIds.size ? (await getOpportunities(newIds)).filter((o) => !o.myGigId && o.tab !== "muted") : [];
    const [followUps, { hot }] = await Promise.all([getFollowUps(), getPlanning()]);
    log(`mail: ${fresh.length} nowych okazji, ${followUps.length} do ponowienia, ${hot.length} gorących`);
    await sendReport({ fresh, followUps, hot }, log);
  }

  // Padnięty parser = czerwony build w Actions, żeby GitHub dał znać mailem.
  if (failures.length) {
    console.error(`Nieudane źródła:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

main();
