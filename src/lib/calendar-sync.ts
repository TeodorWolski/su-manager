/**
 * Synchronizacja z Kalendarzem Google (skrypt Apps Script, instrukcja: /settings/calendar):
 * - do apki: kiedy mam wieczór zajęty w prywatnym kalendarzu (same godziny, bez tytułów),
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

/** Lokalny czas Warszawy, jak przy graniach. */
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type BusyInterval = { start: string; end: string };
/** Zajęty wieczór: dzień i godziny spotkań („19:00–21:00”; „…” = zaczęło się wcześniej / kończy później). */
export type BusyEvening = { day: string; slots: string[] };

/** Tylko poprawne przedziały z przyszłości (skrypt jest nasz, ale wejście z sieci sprawdzamy). */
export function parseBusy(input: unknown, today: string): BusyInterval[] {
  if (!Array.isArray(input)) return [];
  const until = addDays(today, CALENDAR_AHEAD_DAYS + 1);
  return input.filter(
    (x): x is BusyInterval =>
      !!x &&
      typeof x.start === "string" &&
      typeof x.end === "string" &&
      LOCAL.test(x.start) &&
      LOCAL.test(x.end) &&
      x.start < x.end &&
      dayOf(x.end) >= today &&
      dayOf(x.start) <= until,
  );
}

/** Które wieczory są zajęte: przedział nachodzi na EVENING_FROM–EVENING_TO danego dnia. Od dziś, posortowane. */
export function busyEvenings(intervals: BusyInterval[], today: string): BusyEvening[] {
  const byDay = new Map<string, string[]>();
  for (const { start, end } of intervals) {
    for (let day = dayOf(start); day <= dayOf(end); day = addDays(day, 1)) {
      if (day < today || !(start < `${day}T${EVENING_TO}` && end > `${day}T${EVENING_FROM}`)) continue;
      const from = dayOf(start) === day ? start.slice(11, 16) : "…";
      const to = dayOf(end) === day ? end.slice(11, 16) : "…";
      byDay.set(day, [...(byDay.get(day) ?? []), `${from}–${to}`]);
    }
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, slots]) => ({ day, slots: [...new Set(slots)].sort() }));
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

/** „w kalendarzu: 19:00–21:00” — do ostrzeżeń przy graniu i okazjach. */
export const busyLabel = (slots: string[]) => `w kalendarzu: ${slots.join(", ")}`;
