import { and, gte, lte, notInArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { cities, db, gigs, trips, venues } from "@/db";
import { eq } from "drizzle-orm";
import { currentSession } from "@/lib/auth";

/**
 * Grania i podróże do mini kalendarza: /api/month?from=YYYY-MM-DD&to=YYYY-MM-DD (widoczne tygodnie miesiąca).
 * Za basic auth jak cała apka. Bez odrzuconych i odwołanych.
 */
export async function GET(request: NextRequest) {
  if (!(await currentSession())) return new Response("Unauthorized", { status: 401 });
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return new Response("Bad request", { status: 400 });
  }
  const rows = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      startsAt: gigs.startsAt,
      status: gigs.status,
      context: gigs.context,
      city: sql<string | null>`coalesce(${cities.name}, (select c.name from cities c where c.id = ${venues.cityId}))`,
    })
    .from(gigs)
    .leftJoin(venues, eq(venues.id, gigs.venueId))
    .leftJoin(cities, eq(cities.id, gigs.cityId))
    .where(
      and(
        gte(sql`substr(${gigs.startsAt}, 1, 10)`, from),
        lte(sql`substr(${gigs.startsAt}, 1, 10)`, to),
        notInArray(gigs.status, ["rejected", "cancelled"]),
      ),
    )
    .orderBy(gigs.startsAt);
  // Podróże (pociągi) w tych dniach — znaczek 🚆 i lista pod dniem.
  const tripRows = await db
    .select({ id: trips.id, fromStation: trips.fromStation, toStation: trips.toStation, departsAt: trips.departsAt, arrivesAt: trips.arrivesAt, gigId: trips.gigId })
    .from(trips)
    .where(and(gte(sql`substr(${trips.departsAt}, 1, 10)`, from), lte(sql`substr(${trips.departsAt}, 1, 10)`, to)))
    .orderBy(trips.departsAt);
  return Response.json({ gigs: rows, trips: tripRows }, { headers: { "Cache-Control": "no-store" } });
}
