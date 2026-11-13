import type { NextRequest } from "next/server";
import { db, pushSubscriptions } from "@/db";
import { sendMorningMail } from "@/lib/morning-mail";
import { notifications } from "@/lib/notify";
import { sendPush } from "@/lib/push";
import { bearerToken, secretMatches } from "@/lib/secret";

/**
 * Powiadomienia wołane przez zewnętrzny cron (cron-job.org): /api/notify/morning (+ poranny mail), /api/notify/evening.
 * Omija basic auth (proxy.ts) — chroni go nagłówek `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/notify/[kind]">) {
  if (!secretMatches(bearerToken(request), process.env.CRON_SECRET)) return new Response("Unauthorized", { status: 401 });

  const { kind } = await ctx.params;
  if (kind !== "morning" && kind !== "evening") return new Response("Not found", { status: 404 });

  // Poranny mail idzie stąd (niezależnie od pushy i od GitHuba); błąd maila nie blokuje powiadomień.
  let mail: unknown = null;
  if (kind === "morning") {
    try {
      mail = await sendMorningMail({ log: () => {} });
    } catch (e) {
      mail = { error: (e as Error).message };
    }
  }

  // Bez żadnego urządzenia nie liczymy przypomnień — inaczej odhaczyłyby się jako „wysłane dziś” i przepadły.
  const [anyDevice] = await db.select({ e: pushSubscriptions.endpoint }).from(pushSubscriptions).limit(1);
  if (!anyDevice) return Response.json({ kind, mail, sent: [], devices: 0, note: "brak zapisanych urządzeń — nic nie odhaczone" });

  const list = await notifications(kind);
  let devices = 0;
  for (const n of list) devices = await sendPush(n);
  return Response.json({ kind, mail, sent: list.map((n) => n.title), devices });
}
