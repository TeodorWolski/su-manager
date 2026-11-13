/**
 * Feed iCalendar (.ics) z potwierdzonymi graniami i podróżami — subskrybowany w Google Calendar.
 * Wpis zaczyna się ARRIVE_BEFORE_MIN przed startem na scenie (tyle wcześniej trzeba być na miejscu).
 */

import { addDays } from "./time";
import { TRAIN_CALENDAR_LEAD_MIN } from "./trips";

/** Ile minut przed startem sceny zaczyna się wpis w kalendarzu. */
export const ARRIVE_BEFORE_MIN = 60;
/** Ile minut po starcie sceny kończy się wpis (orientacyjny koniec wieczoru). */
const SHOW_LENGTH_MIN = 120;

export type CalendarGig = {
  id: number;
  title: string;
  startsAt: string; // lokalny czas Warszawy "YYYY-MM-DDTHH:mm" albo sama data
  venueName: string | null;
  cityName: string | null;
  url: string | null;
  notes: string | null;
  headlinerName: string | null;
  context: string | null;
};

/** Przesunięcie Europe/Warsaw względem UTC (w minutach) w danej chwili — uwzględnia czas letni. */
function warsawOffsetMin(utcMs: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Warsaw",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(utcMs)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - utcMs) / 60_000);
}

/** "2026-10-08T19:00" czasu warszawskiego → milisekundy UTC. */
export function warsawToUtc(local: string) {
  const [d, t] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const first = guess - warsawOffsetMin(guess) * 60_000;
  return guess - warsawOffsetMin(first) * 60_000;
}

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateStamp = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => addDays(d, 1);

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545: linie max 75 oktetów, kontynuacja zaczyna się spacją. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export type CalendarTrip = {
  id: number;
  fromStation: string;
  toStation: string;
  departsAt: string; // lokalny czas Warszawy "YYYY-MM-DDTHH:mm"
  arrivesAt: string | null;
  train: string | null;
  seat: string | null;
  gigId: number | null;
  gigTitle: string | null;
};

/** Bez godziny przyjazdu wpis pociągu trwa tyle. */
const TRIP_FALLBACK_MIN = 60;

export function buildCalendar(gigs: CalendarGig[], appUrl: string, trips: CalendarTrip[] = []) {
  const now = utcStamp(Date.now());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SU Manager//Grania//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Grania (SU Manager)",
    "X-WR-TIMEZONE:Europe/Warsaw",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const g of gigs) {
    const hasTime = g.startsAt.length > 10;
    const stageTime = hasTime ? g.startsAt.slice(11, 16) : null;
    const where = [g.venueName, g.cityName].filter(Boolean).join(", ");
    const description = [
      hasTime
        ? `Scena o ${stageTime} — bądź na miejscu od ${new Date(warsawToUtc(g.startsAt) - ARRIVE_BEFORE_MIN * 60_000).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" })}.`
        : "Godzina nieznana — uzupełnij w SU Manager.",
      g.headlinerName && `Przed: ${g.headlinerName}`,
      g.url && `Bilety: ${g.url}`,
      g.notes,
      `${appUrl}/gigs/${g.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    lines.push("BEGIN:VEVENT", `UID:gig-${g.id}@su-manager`, `DTSTAMP:${now}`);
    if (hasTime) {
      const start = warsawToUtc(g.startsAt);
      lines.push(
        `DTSTART:${utcStamp(start - ARRIVE_BEFORE_MIN * 60_000)}`,
        `DTEND:${utcStamp(start + SHOW_LENGTH_MIN * 60_000)}`,
      );
    } else {
      const day = g.startsAt.slice(0, 10);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(day)}`, `DTEND;VALUE=DATE:${dateStamp(nextDay(day))}`);
    }
    lines.push(
      `SUMMARY:${escape(`🎤 ${g.title}`)}`,
      ...(where ? [`LOCATION:${escape(where)}`] : []),
      `DESCRIPTION:${escape(description)}`,
      `URL:${escape(g.url ?? `${appUrl}/gigs/${g.id}`)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  // Pociągi: wpis TRAIN_CALENDAR_LEAD_MIN przed odjazdem (17:10 → 17:00), do przyjazdu.
  for (const t of trips) {
    if (t.departsAt.length <= 10) continue;
    const dep = warsawToUtc(t.departsAt);
    const arr = t.arrivesAt && t.arrivesAt.length > 10 ? warsawToUtc(t.arrivesAt) : dep + TRIP_FALLBACK_MIN * 60_000;
    const description = [
      `Odjazd ${t.departsAt.slice(11, 16)}${t.arrivesAt ? `, przyjazd ${t.arrivesAt.slice(11, 16)}` : ""}`,
      t.train,
      t.seat,
      t.gigTitle && `Na: ${t.gigTitle}`,
      `${appUrl}${t.gigId ? `/gigs/${t.gigId}` : "/trips"}`,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:trip-${t.id}@su-manager`,
      `DTSTAMP:${now}`,
      `DTSTART:${utcStamp(dep - TRAIN_CALENDAR_LEAD_MIN * 60_000)}`,
      `DTEND:${utcStamp(arr)}`,
      `SUMMARY:${escape(`🚆 ${t.fromStation} → ${t.toStation}${t.train ? ` (${t.train})` : ""}`)}`,
      `LOCATION:${escape(t.fromStation)}`,
      `DESCRIPTION:${escape(description)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
