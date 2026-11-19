import type { NextRequest } from "next/server";
import { busyEvenings, parseBusy, pendingEvents } from "@/lib/calendar-sync";
import { loadPendingGigs, saveBusyEvenings } from "@/lib/calendar-data";
import { bearerToken, secretMatches } from "@/lib/secret";
import { nowLocal } from "@/lib/time";

/**
 * Kalendarz Google ↔ apka (skrypt Apps Script co 10 min, instrukcja: /settings/calendar):
 * POST { busy: [{ start, end }] } — spotkania z prywatnego kalendarza (same godziny, czas Warszawy),
 * w odpowiedzi { pending } — prośby „napisałem / czekam” do kalendarza „SU · w toku”.
 * Poza logowaniem (proxy.ts) — chroni go `Authorization: Bearer <CRON_SECRET>`, jak bilety.
 */
export async function POST(request: NextRequest) {
  if (!secretMatches(bearerToken(request), process.env.CRON_SECRET)) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { busy?: unknown } | null;
  if (!body || !Array.isArray(body.busy)) return Response.json({ error: "brak busy" }, { status: 400 });

  const today = nowLocal().slice(0, 10);
  const evenings = busyEvenings(parseBusy(body.busy, today), today);
  await saveBusyEvenings(evenings);

  const appUrl = process.env.APP_URL ?? request.nextUrl.origin;
  const pending = pendingEvents(await loadPendingGigs(today), today, appUrl);
  return Response.json({ busyEvenings: evenings.length, pending }, { headers: { "Cache-Control": "no-store" } });
}
