import type { NextRequest } from "next/server";
import { busyEvenings, parseEvents, pendingEvents } from "@/lib/calendar-sync";
import { loadPendingGigs, saveCalendarEvents } from "@/lib/calendar-data";
import { bearerToken, secretMatches } from "@/lib/secret";
import { nowLocal } from "@/lib/time";

/**
 * Kalendarz Google ↔ apka (skrypt Apps Script co 10 min, instrukcja: /settings/calendar):
 * POST { events: [{ start, end, title, allDay }] } — wydarzenia z prywatnego kalendarza (czas Warszawy),
 * w odpowiedzi { pending } — prośby „napisałem / czekam” do kalendarza „SU · w toku”.
 * `busy` zamiast `events` (same godziny) wysyła poprzednia wersja skryptu — przyjmujemy, dopóki ktoś jej nie podmieni.
 * Poza logowaniem (proxy.ts) — chroni go `Authorization: Bearer <CRON_SECRET>`, jak bilety.
 */
export async function POST(request: NextRequest) {
  if (!secretMatches(bearerToken(request), process.env.CRON_SECRET)) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { events?: unknown; busy?: unknown } | null;
  const input = body?.events ?? body?.busy;
  if (!Array.isArray(input)) return Response.json({ error: "brak events" }, { status: 400 });

  const today = nowLocal().slice(0, 10);
  const events = parseEvents(input, today);
  await saveCalendarEvents(events);

  const appUrl = process.env.APP_URL ?? request.nextUrl.origin;
  const pending = pendingEvents(await loadPendingGigs(today), today, appUrl);
  return Response.json(
    { events: events.length, busyEvenings: busyEvenings(events, today).length, pending },
    { headers: { "Cache-Control": "no-store" } },
  );
}
