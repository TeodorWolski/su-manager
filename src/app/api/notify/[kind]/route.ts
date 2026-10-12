import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { db, pushSubscriptions } from "@/db";
import { notifications } from "@/lib/notify";
import { sendPush } from "@/lib/push";

/**
 * Powiadomienia wołane przez zewnętrzny cron (cron-job.org): /api/notify/morning, /api/notify/evening.
 * Omija basic auth (proxy.ts) — chroni go nagłówek `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/notify/[kind]">) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  const { kind } = await ctx.params;
  if (kind !== "morning" && kind !== "evening") return new Response("Not found", { status: 404 });

  // Bez żadnego urządzenia nie liczymy przypomnień — inaczej odhaczyłyby się jako „wysłane dziś” i przepadły.
  const [anyDevice] = await db.select({ e: pushSubscriptions.endpoint }).from(pushSubscriptions).limit(1);
  if (!anyDevice) return Response.json({ kind, sent: [], devices: 0, note: "brak zapisanych urządzeń — nic nie odhaczone" });

  const list = await notifications(kind);
  let devices = 0;
  for (const n of list) devices = await sendPush(n);
  return Response.json({ kind, sent: list.map((n) => n.title), devices });
}
