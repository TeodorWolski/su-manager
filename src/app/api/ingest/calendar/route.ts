import type { NextRequest } from "next/server";
import { getState, setState } from "@/lib/app-state";
import { describeWindow } from "@/lib/away";
import { parseEvents, pendingEvents } from "@/lib/calendar-sync";
import { loadGigConflicts, loadPendingGigs, saveCalendarEvents } from "@/lib/calendar-data";
import { sendPush } from "@/lib/push";
import { bearerToken, secretMatches } from "@/lib/secret";
import { fmtDate, nowLocal } from "@/lib/time";

/** Kolizje, o których już był push („id grania|spotkanie”) — każda nowa raz, rozwiązana znika z listy. */
const NOTIFIED_KEY = "calendar-conflicts-notified";

/**
 * Kalendarz Google ↔ apka (skrypt Apps Script co 10 min, instrukcja: /settings/calendar):
 * POST { events: [{ start, end, title, allDay }] } — wydarzenia z prywatnego kalendarza (czas Warszawy),
 * w odpowiedzi { pending } — prośby „napisałem / czekam” do kalendarza „SU · w toku”.
 * Nowa kolizja z graniem (dopisana wizyta albo potwierdzone granie) → push od razu, nie dopiero rano.
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

  const conflicts = await loadGigConflicts();
  const notified = new Set<string>(JSON.parse((await getState(NOTIFIED_KEY)) ?? "[]"));
  const stillNotified: string[] = [];
  for (const c of conflicts) {
    const keys = c.slots.map((s) => `${c.gig.id}|${s.label}`);
    stillNotified.push(...keys.filter((k) => notified.has(k)));
    const fresh = c.slots.filter((_, i) => !notified.has(keys[i]));
    if (!fresh.length) continue;
    const devices = await sendPush({
      title: `⚠️ Kolizja: ${c.gig.title}`,
      body: `${fmtDate(c.gig.startsAt.slice(0, 10))}, ${describeWindow(c.window, c.gig.cityName)} — w kalendarzu: ${fresh.map((s) => s.label).join(", ")}`,
      url: `/gigs/${c.gig.id}`,
      tag: `conflict-${c.gig.id}`,
    }).catch(() => 0);
    // Odhaczamy tylko to, co doszło na telefon — bez urządzenia (albo kluczy) push pójdzie przy następnej synchronizacji.
    if (devices > 0) stillNotified.push(...keys.filter((k) => !notified.has(k)));
  }
  // Rozwiązane kolizje wypadają z listy — gdyby wróciły, będzie nowy push.
  await setState(NOTIFIED_KEY, JSON.stringify(stillNotified));

  const appUrl = process.env.APP_URL ?? request.nextUrl.origin;
  const pending = pendingEvents(await loadPendingGigs(today), today, appUrl);
  return Response.json({ events: events.length, conflicts: conflicts.length, pending }, { headers: { "Cache-Control": "no-store" } });
}
