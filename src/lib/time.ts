import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";

const TZ = "Europe/Warsaw";

/**
 * Bieżący czas w Warszawie jako "YYYY-MM-DDTHH:mm" — w tym formacie trzymamy
 * daty grań, więc porównanie stringów działa niezależnie od strefy serwera.
 */
export function nowLocal(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Grania bez godziny (sama data) traktujemy przy porównaniach jak start o tej godzinie. */
export const DEFAULT_START_TIME = "20:00";

export function effectiveStart(local: string) {
  return local.length === 10 ? `${local}T${DEFAULT_START_TIME}` : local;
}

export function fmtDate(local: string) {
  return format(parseISO(local), "EEE, d MMM", { locale: pl });
}

/** Grania z importu mają samą datę ("2026-03-27") — wtedy bez godziny. */
export function fmtDateTime(local: string) {
  if (local.length <= 10) return fmtDate(local);
  return format(parseISO(local), "EEE, d MMM · HH:mm", { locale: pl });
}

export function fmtDateLong(local: string) {
  return format(parseISO(local), "EEEE, d MMMM yyyy", { locale: pl });
}

export function fmtMonth(local: string) {
  return format(parseISO(local), "LLLL yyyy", { locale: pl });
}

export function fmtTravel(minutes: number | null | undefined) {
  if (minutes == null) return null;
  if (minutes === 0) return "na miejscu";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paz", "lis", "gru"];

/**
 * Data wpisana w wyszukiwarce: „14.10”, „14.10.2026”, „2026-10-14”, „14 października”, „14 paź”,
 * „dziś”, „jutro”. Bez roku — najbliższy taki dzień od dziś. Zwraca datę i resztę frazy.
 */
export function parseDateQuery(query: string, today: string): { date: string | null; rest: string } {
  const q = query
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const valid = (y: number, m: number, d: number) => {
    const t = new Date(Date.UTC(y, m - 1, d));
    return m >= 1 && m <= 12 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  };
  /** Bez roku: ten rok, a jeśli dzień już minął — przyszły. */
  const nearest = (m: number, d: number, y?: number) => {
    if (y) return y < 100 ? 2000 + y : y;
    const thisYear = Number(today.slice(0, 4));
    return iso(thisYear, m, d) < today ? thisYear + 1 : thisYear;
  };
  const patterns: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => (valid(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null)],
    [
      /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?\b/,
      (m) => {
        const y = nearest(+m[2], +m[1], m[3] ? +m[3] : undefined);
        return valid(y, +m[2], +m[1]) ? iso(y, +m[2], +m[1]) : null;
      },
    ],
    [
      /\b(\d{1,2})\s+([a-z]{3})[a-z]*\b/,
      (m) => {
        const month = MONTHS.indexOf(m[2]) + 1;
        if (!month) return null;
        const y = nearest(month, +m[1]);
        return valid(y, month, +m[1]) ? iso(y, month, +m[1]) : null;
      },
    ],
    [/\b(dzis|dzisiaj)\b/, () => today],
    [/\bjutro\b/, () => new Date(Date.parse(today) + 864e5).toISOString().slice(0, 10)],
  ];
  for (const [re, toDate] of patterns) {
    const m = q.match(re);
    const date = m && toDate(m);
    if (m && date) return { date, rest: q.replace(m[0], " ").replace(/\s+/g, " ").trim() };
  }
  return { date: null, rest: query.trim() };
}
