/**
 * Wydarzenia z Kalendarza Google (app_state „calendar-events”), kolizje z graniami i prośby do kalendarza „w toku”.
 * Bez server-only — używa tego też planowanie (mail), trasa dla skryptu i feed kalendarza.
 */
import { and, gte, inArray, lte, sql } from "drizzle-orm";
import { db, gigs, trips } from "@/db";
import { getState, setState } from "./app-state";
import { gigWindow, type GigWindow } from "./away";
import {
  CALENDAR_AHEAD_DAYS,
  calendarDays,
  isRoutine,
  overlapping,
  PENDING_SYNC_STATUSES,
  routineKey,
  type CalendarEvent,
  type CalendarSlot,
  type PendingGig,
} from "./calendar-sync";
import { addDays, nowLocal } from "./time";

const EVENTS_KEY = "calendar-events";
/** Tytuły wpisów oznaczonych jako rutyna (tak, jak były w kalendarzu — do listy w ustawieniach). */
const ROUTINES_KEY = "calendar-routines";

/** Zapisuje całą listę na nowo — skrypt zawsze wysyła pełny obraz, więc odwołane spotkania same znikają. */
export async function saveCalendarEvents(events: CalendarEvent[]) {
  await setState(EVENTS_KEY, JSON.stringify(events));
}

/** Pusto, gdy skrypt jeszcze nic nie wysłał. */
async function loadAllCalendarEvents(): Promise<CalendarEvent[]> {
  const raw = await getState(EVENTS_KEY);
  return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
}

export async function loadRoutineTitles(): Promise<string[]> {
  return JSON.parse((await getState(ROUTINES_KEY)) ?? "[]") as string[];
}

const routineSet = (titles: string[]) => new Set(titles.map(routineKey));

/** Rutyna ↔ zwykłe spotkanie (jeden tap); wszystkie wpisy o tym tytule naraz. */
export async function setRoutine(title: string, routine: boolean) {
  const titles = (await loadRoutineTitles()).filter((t) => routineKey(t) !== routineKey(title));
  await setState(ROUTINES_KEY, JSON.stringify(routine ? [...titles, title.trim()] : titles));
}

/** Wydarzenia, które mogą kolidować z graniem — bez rutyn. */
export async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  const [events, routines] = await Promise.all([loadAllCalendarEvents(), loadRoutineTitles()]);
  const set = routineSet(routines);
  return events.filter((e) => !isRoutine(e, set));
}

/** Co jest w prywatnym kalendarzu w dniach od–do (mini kalendarz), z rutynami oznaczonymi. */
export async function loadCalendarDays(from: string, to: string) {
  const [events, routines] = await Promise.all([loadAllCalendarEvents(), loadRoutineTitles()]);
  return calendarDays(events, from, to, routineSet(routines));
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
  /** Spotkania z kalendarza w oknie grania („15:45–16:30 Kardiolog”), bez rutyn. */
  slots: CalendarSlot[];
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
