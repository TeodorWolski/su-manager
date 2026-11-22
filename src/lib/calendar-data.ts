/**
 * Wydarzenia z Kalendarza Google (app_state „calendar-events”) i prośby do kalendarza „w toku”.
 * Bez server-only — używa tego też planowanie (mail) i trasa dla skryptu.
 */
import { and, gte, inArray, sql } from "drizzle-orm";
import { db, gigs } from "@/db";
import { getState, setState } from "./app-state";
import { busyEvenings, calendarDays, PENDING_SYNC_STATUSES, type CalendarEvent, type PendingGig } from "./calendar-sync";
import { nowLocal } from "./time";

const EVENTS_KEY = "calendar-events";

/** Zapisuje całą listę na nowo — skrypt zawsze wysyła pełny obraz, więc odwołane spotkania same znikają. */
export async function saveCalendarEvents(events: CalendarEvent[]) {
  await setState(EVENTS_KEY, JSON.stringify(events));
}

/** Pusto, gdy skrypt jeszcze nic nie wysłał. */
async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  const raw = await getState(EVENTS_KEY);
  return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
}

/** Zajęte wieczory od dziś: dzień → spotkania („18:30–19:30 Dietetyk”). */
export async function loadBusyEvenings(): Promise<Map<string, string[]>> {
  const evenings = busyEvenings(await loadCalendarEvents(), nowLocal().slice(0, 10));
  return new Map(evenings.map((e) => [e.day, e.slots]));
}

/** Co jest w prywatnym kalendarzu w dniach od–do (mini kalendarz). */
export async function loadCalendarDays(from: string, to: string) {
  return calendarDays(await loadCalendarEvents(), from, to);
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
