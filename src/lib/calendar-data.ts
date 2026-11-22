/**
 * Wydarzenia z Kalendarza Google (app_state „calendar-events”), kolizje z graniami i prośby do kalendarza „w toku”.
 * Bez server-only — używa tego też planowanie (mail), trasa dla skryptu i feed kalendarza.
 */
import { and, gte, inArray, lte, sql } from "drizzle-orm";
import { db, gigs, trips } from "@/db";
import { getState, setState } from "./app-state";
import { gigWindow, type GigWindow } from "./away";
import { CALENDAR_AHEAD_DAYS, calendarDays, overlapping, PENDING_SYNC_STATUSES, type CalendarEvent, type PendingGig } from "./calendar-sync";
import { addDays, nowLocal } from "./time";

const EVENTS_KEY = "calendar-events";

/** Zapisuje całą listę na nowo — skrypt zawsze wysyła pełny obraz, więc odwołane spotkania same znikają. */
export async function saveCalendarEvents(events: CalendarEvent[]) {
  await setState(EVENTS_KEY, JSON.stringify(events));
}

/** Pusto, gdy skrypt jeszcze nic nie wysłał. */
export async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  const raw = await getState(EVENTS_KEY);
  return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
}

/** Co jest w prywatnym kalendarzu w dniach od–do (mini kalendarz). */
export async function loadCalendarDays(from: string, to: string) {
  return calendarDays(await loadCalendarEvents(), from, to);
}

/** Miasto grania z miasta albo sceny — z czasem dojazdu i noclegiem (do okna wyjazdu). */
const cityOf = (column: "name" | "travel_minutes" | "has_lodging") =>
  sql.raw(`coalesce(
    (select c.${column} from cities c where c.id = "gigs"."city_id"),
    (select c.${column} from venues v join cities c on c.id = v.city_id where v.id = "gigs"."venue_id"))`);

const gigWithCity = {
  id: gigs.id,
  title: gigs.title,
  startsAt: gigs.startsAt,
  status: gigs.status,
  cityName: sql<string | null>`${cityOf("name")}`,
  travelMinutes: sql<number | null>`${cityOf("travel_minutes")}`,
  hasLodging: sql<boolean>`coalesce(${cityOf("has_lodging")}, 0) = 1`.mapWith(Boolean),
};

export async function loadPendingGigs(today: string): Promise<PendingGig[]> {
  return db
    .select(gigWithCity)
    .from(gigs)
    .where(and(inArray(gigs.status, [...PENDING_SYNC_STATUSES]), gte(gigs.startsAt, today)));
}

export type GigConflict = {
  gig: { id: number; title: string; startsAt: string; status: string; cityName: string | null };
  window: GigWindow;
  /** Spotkania z kalendarza w oknie grania („15:45–16:30 Kardiolog”). */
  slots: string[];
};

/**
 * Nadchodzące grania (potwierdzone i prośby „napisałem / czekam”), na które nachodzi coś z prywatnego
 * kalendarza — w Warszawie wieczór, przy wyjeździe cały czas poza domem (z biletów, jeśli są).
 */
export async function loadGigConflicts(): Promise<GigConflict[]> {
  const today = nowLocal().slice(0, 10);
  const events = await loadCalendarEvents();
  if (!events.length) return [];
  const until = addDays(today, CALENDAR_AHEAD_DAYS);
  const [rows, tickets] = await Promise.all([
    db
      .select(gigWithCity)
      .from(gigs)
      .where(and(inArray(gigs.status, ["confirmed", ...PENDING_SYNC_STATUSES]), gte(gigs.startsAt, today), lte(gigs.startsAt, `${until}T23:59`))),
    db
      .select({ gigId: trips.gigId, departsAt: trips.departsAt, arrivesAt: trips.arrivesAt })
      .from(trips)
      .where(gte(trips.departsAt, addDays(today, -1))),
  ]);
  return rows
    .map(({ travelMinutes, hasLodging, ...gig }) => {
      const window = gigWindow({ ...gig, travelMinutes, hasLodging }, tickets.filter((t) => t.gigId === gig.id));
      return { gig, window, slots: overlapping(events, window) };
    })
    .filter((c) => c.slots.length > 0)
    .sort((a, b) => a.gig.startsAt.localeCompare(b.gig.startsAt));
}
