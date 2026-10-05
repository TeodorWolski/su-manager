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
