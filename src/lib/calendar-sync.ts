/**
 * Synchronizacja z Kalendarzem Google (skrypt Apps Script, instrukcja: /settings/calendar):
 * - do apki: wydarzenia z prywatnego kalendarza (godziny i tytuły) — mini kalendarz pokazuje, co jest
 *   danego dnia, a wieczory z czymś w środku liczą się jako zajęte,
 * - do Google: prośby o granie „napisałem / czekam” jako wpisy w osobnym kalendarzu „SU · w toku”,
 *   żeby przy umawianiu się z kimś było widać, że wieczór jest jeszcze niepewny.
 * Czysta logika; zapis i odczyt: calendar-data.ts.
 */
import { addDays, dayOf, effectiveStart } from "./time";

/** Wieczór, który może zająć granie (lokalnie). Spotkanie, które na niego nachodzi, robi z niego „zajęty”. */
export const EVENING_FROM = "18:00";
export const EVENING_TO = "23:00";
/** Ile dni naprzód skrypt czyta prywatny kalendarz i ile naprzód wysyłamy prośby „w toku”. */
export const CALENDAR_AHEAD_DAYS = 90;
/** Długość wpisu „w toku” w kalendarzu — mniej więcej tyle, ile zajmuje wieczór z open mikiem. */
export const PENDING_EVENT_MIN = 150;
/** Statusy, które trafiają do kalendarza „w toku”. „Zainteresowany” nie — to tylko pomysł, nikogo jeszcze nie pytałem. */
export const PENDING_SYNC_STATUSES = ["contacted", "waiting"] as const;
/** Dłuższe tytuły przycinamy — w mini kalendarzu i tak mieści się jedna linijka. */
export const CALENDAR_TITLE_MAX = 80;

/** Lokalny czas Warszawy, jak przy graniach. */
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Wydarzenie z prywatnego kalendarza; całodniowe trwa od północy do północy (koniec bez tego dnia). */
export type CalendarEvent = { start: string; end: string; title: string; allDay: boolean };
/** Zajęty wieczór: dzień i spotkania („19:00–21:00 Dietetyk”; „…” = zaczęło się wcześniej / kończy później). */
export type BusyEvening = { day: string; slots: string[] };
/** Dzień w mini kalendarzu: co jest w prywatnym kalendarzu (bez godziny = całodniowe). */
export type CalendarDay = { day: string; items: { time: string | null; title: string }[] };

/**
 * Tylko poprawne wydarzenia z okna synchronizacji (skrypt jest nasz, ale wejście z sieci sprawdzamy).
 * Stary skrypt wysyła same godziny ({ start, end }) — wtedy bez tytułu i jako zwykłe spotkanie.
 */
export function parseEvents(input: unknown, today: string): CalendarEvent[] {
  if (!Array.isArray(input)) return [];
  const until = addDays(today, CALENDAR_AHEAD_DAYS + 1);
  return input.flatMap((x): CalendarEvent[] => {
    if (!x || typeof x.start !== "string" || typeof x.end !== "string") return [];
    if (!LOCAL.test(x.start) || !LOCAL.test(x.end) || x.start >= x.end) return [];
    if (dayOf(x.end) < today || dayOf(x.start) > until) return [];
    const title = typeof x.title === "string" ? x.title.trim().slice(0, CALENDAR_TITLE_MAX) : "";
    return [{ start: x.start, end: x.end, title, allDay: x.allDay === true }];
  });
}

/** Dni, na które przypada wydarzenie; koniec równo o północy nie zajmuje już następnego dnia. */
function daysOf({ start, end }: CalendarEvent) {
  const first = dayOf(start);
  const last = end.endsWith("T00:00") && dayOf(end) > first ? addDays(dayOf(end), -1) : dayOf(end);
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  return days;
}

/** „19:00–21:00”, a przy wydarzeniu na kilka dni „15:00–…” / „…–…” / „…–12:00”. */
const timeOn = (e: CalendarEvent, day: string) =>
  `${dayOf(e.start) === day ? e.start.slice(11, 16) : "…"}–${dayOf(e.end) === day ? e.end.slice(11, 16) : "…"}`;

const withTitle = (time: string, title: string) => (title ? `${time} ${title}` : time);

/** Które wieczory są zajęte: spotkanie nachodzi na EVENING_FROM–EVENING_TO danego dnia. Całodniowe się nie liczą. Od dziś, posortowane. */
export function busyEvenings(events: CalendarEvent[], today: string): BusyEvening[] {
  const byDay = new Map<string, string[]>();
  for (const e of events) {
    if (e.allDay) continue;
    for (const day of daysOf(e)) {
      if (day < today || !(e.start < `${day}T${EVENING_TO}` && e.end > `${day}T${EVENING_FROM}`)) continue;
      byDay.set(day, [...(byDay.get(day) ?? []), withTitle(timeOn(e, day), e.title)]);
    }
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, slots]) => ({ day, slots: [...new Set(slots)].sort() }));
}

/** Wszystko z prywatnego kalendarza dzień po dniu (do mini kalendarza): całodniowe na górze, potem wg godziny. */
export function calendarDays(events: CalendarEvent[], from: string, to: string): CalendarDay[] {
  const byDay = new Map<string, CalendarDay["items"]>();
  for (const e of events) {
    for (const day of daysOf(e)) {
      if (day < from || day > to) continue;
      byDay.set(day, [...(byDay.get(day) ?? []), { time: e.allDay ? null : timeOn(e, day), title: e.title }]);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, items: items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")) }));
}

export type PendingGig = { id: number; title: string; startsAt: string; status: string; cityName: string | null };
/** Wpis do kalendarza „SU · w toku” — czasy lokalne Warszawy, skrypt czyta je w tej strefie. */
export type PendingEvent = { id: number; title: string; start: string; end: string; url: string };

const STATUS_WORD: Record<string, string> = { contacted: "napisałem", waiting: "czekam" };

/** Prośby „napisałem / czekam” od dziś na CALENDAR_AHEAD_DAYS dni, jako wpisy do kalendarza. */
export function pendingEvents(gigs: PendingGig[], today: string, appUrl: string): PendingEvent[] {
  const until = addDays(today, CALENDAR_AHEAD_DAYS);
  return gigs
    .filter((g) => STATUS_WORD[g.status] && dayOf(g.startsAt) >= today && dayOf(g.startsAt) <= until)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((g) => {
      const start = effectiveStart(g.startsAt);
      const endMs = Date.parse(`${start}:00Z`) + PENDING_EVENT_MIN * 60_000;
      return {
        id: g.id,
        title: [`❓ ${STATUS_WORD[g.status]}`, g.title, g.cityName].filter(Boolean).join(" · "),
        start,
        // Przesunięcie liczone „na papierze” (jak w UTC) — to czas lokalny, bez strefy, więc zmiana czasu go nie rusza.
        end: new Date(endMs).toISOString().slice(0, 16),
        url: `${appUrl}/gigs/${g.id}`,
      };
    });
}

/** „w kalendarzu: 18:30–19:30 Dietetyk” — do ostrzeżeń przy graniu i okazjach. */
export const busyLabel = (slots: string[]) => `w kalendarzu: ${slots.join(", ")}`;
