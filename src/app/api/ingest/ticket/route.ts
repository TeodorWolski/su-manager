import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ingestNotice, ingestTicket } from "@/lib/trip-ingest";
import { sendPush } from "@/lib/push";

/**
 * Bilety z Gmaila (skrypt Google Apps Script, instrukcja: /trips/setup): POST { pdf: base64 } albo { text }.
 * Poza logowaniem (proxy.ts) — chroni go `Authorization: Bearer <CRON_SECRET>`, jak /api/notify.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { pdf?: string; text?: string } | null;
  if (!body?.pdf && !body?.text) return Response.json({ error: "brak pdf / text" }, { status: 400 });

  const result = await ingestTicket(body);
  const notice = ingestNotice(result);
  if (notice) {
    try {
      await sendPush(notice);
    } catch {
      // brak kluczy VAPID / urządzeń — podróż i tak zapisana
    }
  }
  const { ticket, ...rest } = result;
  return Response.json({ ...rest, from: ticket.fromStation, to: ticket.toStation, departsAt: ticket.departsAt });
}
