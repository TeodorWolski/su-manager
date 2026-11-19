/**
 * Zajęte wieczory z Kalendarza Google (app_state „calendar-busy”) i prośby do kalendarza „w toku”.
 * Bez server-only — używa tego też planowanie (mail) i trasa dla skryptu.
 */
import { and, gte, inArray, sql } from "drizzle-orm";
import { db, gigs } from "@/db";
import { getState, setState } from "./app-state";
import { PENDING_SYNC_STATUSES, type BusyEvening, type PendingGig } from "./calendar-sync";

const BUSY_KEY = "calendar-busy";

/** Zapisuje całą listę na nowo — skrypt zawsze wysyła pełny obraz, więc odwołane spotkania same znikają. */
export async function saveBusyEvenings(evenings: BusyEvening[]) {
  await setState(BUSY_KEY, JSON.stringify(evenings));
}

/** Dzień → godziny spotkań. Pusto, gdy skrypt jeszcze nic nie wysłał. */
export async function loadBusyEvenings(): Promise<Map<string, string[]>> {
  const raw = await getState(BUSY_KEY);
  const list = raw ? (JSON.parse(raw) as BusyEvening[]) : [];
  return new Map(list.map((e) => [e.day, e.slots]));
}

export async function loadPendingGigs(today: string): Promise<PendingGig[]> {
  return db
    .select({
      id: gigs.id,
      title: gigs.title,
      startsAt: gigs.startsAt,
      status: gigs.status,
      cityName: sql<string | null>`coalesce(
        (select c.name from cities c where c.id = ${gigs.cityId}),
        (select c.name from venues v join cities c on c.id = v.city_id where v.id = ${gigs.venueId}))`,
    })
    .from(gigs)
    .where(and(inArray(gigs.status, [...PENDING_SYNC_STATUSES]), gte(gigs.startsAt, today)));
}
