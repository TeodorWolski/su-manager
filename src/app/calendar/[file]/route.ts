import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { buildCalendar } from "@/lib/ics";
import { listCalendarGigs } from "@/lib/queries";

/**
 * Feed .ics dla Google Calendar: /calendar/<CALENDAR_TOKEN>.ics
 * Omija basic auth (Google nie poda hasła) — chroni go losowy token w adresie.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/calendar/[file]">) {
  const { file } = await ctx.params;
  const token = process.env.CALENDAR_TOKEN;
  const given = file.replace(/\.ics$/, "");
  const ok = !!token && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));
  if (!ok) return new Response("Not found", { status: 404 });

  const gigs = await listCalendarGigs();
  return new Response(buildCalendar(gigs, request.nextUrl.origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="grania.ics"',
      "Cache-Control": "no-store",
    },
  });
}
