/**
 * Zapis przewidywanych terminów serii jako wydarzeń (źródło RECURRING_SOURCE), żeby Okazje, Najgorętsze,
 * Rytm, Trasa i mail widziały je bez zmian. Bez `server-only` — woła to i scraper, i akcje aplikacji.
 */
import { and, eq, gte, inArray } from "drizzle-orm";
import { db, events, recurringSeries } from "@/db";
import { buildSeries, RECURRING_SOURCE, seriesKey } from "./recurring";
import { nowLocal } from "./time";

export async function loadSeries() {
  const today = nowLocal().slice(0, 10);
  const [all, decisions] = await Promise.all([
    db
      .select({
        id: events.id,
        source: events.source,
        title: events.title,
        cityName: events.cityName,
        venueName: events.venueName,
        url: events.url,
        startsAt: events.startsAt,
        gigId: events.gigId,
      })
      .from(events),
    db.select().from(recurringSeries),
  ]);
  return { today, all, decisions, series: buildSeries(all, decisions, today) };
}

/**
 * Doprowadza przewidywane terminy w bazie do stanu z `buildSeries`: dopisuje brakujące, usuwa nieaktualne
 * (seria wyłączona, zmieniony rytm, pojawił się prawdziwy termin). Granie założone z przewidywanego
 * terminu przechodzi na prawdziwe wydarzenie z tego dnia, jeśli takie jest.
 */
export async function syncRecurring(log: (m: string) => void = () => {}) {
  const { today, all, series } = await loadSeries();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const wanted = new Map<string, { series: (typeof series)[number]; startsAt: string }>();
  for (const s of series) for (const d of s.predicted) wanted.set(`${s.key}|${d.slice(0, 10)}`, { series: s, startsAt: d });

  const predicted = await db
    .select({ id: events.id, sourceId: events.sourceId, gigId: events.gigId, startsAt: events.startsAt })
    .from(events)
    .where(and(eq(events.source, RECURRING_SOURCE), gte(events.startsAt, today)));
  const have = new Set(predicted.map((p) => p.sourceId));

  // Nieaktualne: przenieś ewentualne granie na prawdziwy termin z tego dnia, potem usuń.
  const stale = predicted.filter((p) => !wanted.has(p.sourceId));
  for (const p of stale.filter((p) => p.gigId)) {
    const [key, day] = [p.sourceId.slice(0, p.sourceId.lastIndexOf("|")), p.sourceId.slice(-10)];
    const real = all.find((e) => e.source !== RECURRING_SOURCE && e.startsAt.startsWith(day) && seriesKey(e) === key && !e.gigId);
    if (real) await db.update(events).set({ gigId: p.gigId }).where(eq(events.id, real.id));
  }
  // Przewidywany termin z założonym graniem, bez prawdziwego odpowiednika — zostaje (granie ma swoje wydarzenie).
  const toDelete = stale.filter((p) => !p.gigId || all.some((e) => e.gigId === p.gigId && e.source !== RECURRING_SOURCE));
  if (toDelete.length) await db.delete(events).where(inArray(events.id, toDelete.map((p) => p.id)));

  const toInsert = [...wanted.entries()]
    .filter(([id]) => !have.has(id))
    .map(([sourceId, { series: s, startsAt }]) => ({
      source: RECURRING_SOURCE,
      sourceId,
      url: s.url ?? "",
      title: s.title,
      startsAt,
      cityName: s.cityName,
      venueName: s.venueName,
      performers: null,
      dedupeKey: `${RECURRING_SOURCE}|${sourceId}`,
      lastSeenAt: now,
    }));
  for (let i = 0; i < toInsert.length; i += 100) {
    await db.insert(events).values(toInsert.slice(i, i + 100)).onConflictDoNothing();
  }
  log(`cykliczne: ${series.length} serii, +${toInsert.length} przewidywanych, −${toDelete.length} nieaktualnych`);
  return series;
}
