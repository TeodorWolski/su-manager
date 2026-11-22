/**
 * Synchronizacja z Kalendarzem Google (skrypt Apps Script, instrukcja: /settings/calendar):
 * - do apki: wydarzenia z prywatnego kalendarza (godziny i tytuły) — mini kalendarz pokazuje, co jest
 *   danego dnia, a spotkania w czasie grania (wieczór albo cały wyjazd, away.ts) to kolizje,
 * - do Google: prośby o granie „napisałem / czekam” jako wpisy w osobnym kalendarzu „SU · w toku”,
 *   żeby przy umawianiu się z kimś było widać, że ten czas jest jeszcze niepewny.
 * Czysta logika; zapis i odczyt: calendar-data.ts.
 */
import { gigWindow, GIG_LENGTH_MIN, type WindowGig } from "./away";
import { normalize } from "./text";
import { addDays, addMinutes, dayOf, effectiveStart } from "./time";
/** Ile dni naprzód skrypt czyta prywatny kalendarz i ile naprzód wysyłamy prośby „w toku”. */
export const CALENDAR_AHEAD_DAYS = 90;
/** Statusy, które trafiają do kalendarza „w toku”. „Zainteresowany” nie — to tylko pomysł, nikogo jeszcze nie pytałem. */
export const PENDING_SYNC_STATUSES = ["contacted", "waiting"] as const;
/** Dłuższe tytuły przycinamy — w mini kalendarzu i tak mieści się jedna linijka. */
export const CALENDAR_TITLE_MAX = 80;

/** Lokalny czas Warszawy, jak przy graniach. */
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Wydarzenie z prywatnego kalendarza; całodniowe trwa od północy do północy (koniec bez tego dnia). */
export type CalendarEvent = { start: string; end: string; title: string; allDay: boolean };
/** Dzień w mini kalendarzu: co jest w prywatnym kalendarzu (bez godziny = całodniowe; rutyna = nie koliduje). */
export type CalendarDay = { day: string; items: { time: string | null; title: string; routine: boolean }[] };
/** Spotkanie w oknie grania: opis do ostrzeżeń („15:45–16:30 Kardiolog”) i tytuł (do „to rutyna”). */
export type CalendarSlot = { label: string; title: string };

/**
 * Rutyna (siłownia, czytanie…) — wpis w kalendarzu, który nie jest prawdziwym spotkaniem: widać go w mini
 * kalendarzu, ale nie koliduje z graniami. Rozpoznajemy po tytule, więc jeden tap łapie wszystkie powtórzenia.
 */
export const routineKey = (title: string) => normalize(title).replace(/\s+/g, " ");
export const isRoutine = (e: Pick<CalendarEvent, "title">, routines: Set<string>) => !!e.title && routines.has(routineKey(e.title));

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

/**
 * Spotkania, które nachodzą na okno grania (away.ts: wieczór w Warszawie albo cały wyjazd), jako
 * „15:45–16:30 Kardiolog”; z innego dnia niż start okna — z datą („10.12 09:00–10:00 …”). Całodniowe się nie liczą.
 */
export function overlapping(events: CalendarEvent[], window: { from: string; to: string }): CalendarSlot[] {
  const shortDate = (d: string) => `${Number(d.slice(8, 10))}.${d.slice(5, 7)}`;
  return events
    .filter((e) => !e.allDay && e.start < window.to && e.end > window.from)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => {
      const day = dayOf(e.start);
      const label = withTitle(timeOn(e, day), e.title);
      return { label: day === dayOf(window.from) ? label : `${shortDate(day)} ${label}`, title: e.title };
    });
}

/** Wszystko z prywatnego kalendarza dzień po dniu (do mini kalendarza): całodniowe na górze, potem wg godziny. */
export function calendarDays(events: CalendarEvent[], from: string, to: string, routines = new Set<string>()): CalendarDay[] {
  const byDay = new Map<string, CalendarDay["items"]>();
  for (const e of events) {
    for (const day of daysOf(e)) {
      if (day < from || day > to) continue;
      byDay.set(day, [...(byDay.get(day) ?? []), { time: e.allDay ? null : timeOn(e, day), title: e.title, routine: isRoutine(e, routines) }]);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, items: items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")) }));
}

export type PendingGig = WindowGig & { id: number; title: string; status: string };
/** Wpis do kalendarza „SU · w toku” — czasy lokalne Warszawy, skrypt czyta je w tej strefie. */
export type PendingEvent = { id: number; title: string; start: string; end: string; url: string };

const STATUS_WORD: Record<string, string> = { contacted: "napisałem", waiting: "czekam" };

/**
 * Prośby „napisałem / czekam” od dziś na CALENDAR_AHEAD_DAYS dni, jako wpisy do kalendarza.
 * W Warszawie wpis trwa GIG_LENGTH_MIN od sceny; wyjazd zajmuje cały czas poza domem (away.ts) — żeby
 * przy umawianiu się na popołudnie było widać, że mnie nie ma.
 */
export function pendingEvents(gigs: PendingGig[], today: string, appUrl: string): PendingEvent[] {
  const until = addDays(today, CALENDAR_AHEAD_DAYS);
  return gigs
    .filter((g) => STATUS_WORD[g.status] && dayOf(g.startsAt) >= today && dayOf(g.startsAt) <= until)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((g) => {
      const window = gigWindow(g);
      const start = window.away ? window.from : effectiveStart(g.startsAt);
      return {
        id: g.id,
        title: [`❓ ${STATUS_WORD[g.status]}`, g.title, g.cityName && (window.away ? `${g.cityName} (wyjazd)` : g.cityName)].filter(Boolean).join(" · "),
        start,
        end: window.away ? window.to : addMinutes(start, GIG_LENGTH_MIN),
        url: `${appUrl}/gigs/${g.id}`,
      };
    });
}

/** „w kalendarzu: 18:30–19:30 Dietetyk” — do ostrzeżeń przy graniu i okazjach. */
export const busyLabel = (slots: CalendarSlot[]) => `w kalendarzu: ${slots.map((s) => s.label).join(", ")}`;
