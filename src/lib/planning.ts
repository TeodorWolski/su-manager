/**
 * Planowanie: „Do ponowienia”, rytm tygodni i najgorętsze okazje. Bez `server-only` i bez
 * pamięci podręcznej Next — używa tego i ekran Dziś (queries.ts), i codzienny mail (scripts/scrape.ts).
 */
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { cities, contacts, db, gigs, venues } from "@/db";
import { daysSince, followUpTiming, lastActivity, nextChannel } from "./follow-up";
import { hotOpportunities, type HotCandidate } from "./hot";
import { getOpportunities, loadUpcomingEvents, type EventRow } from "./opportunities";
import { getInsights, type RhythmOpportunity } from "./rhythm";
import { nowLocal } from "./time";

const headliner = alias(contacts, "headliner");

/**
 * Grania „napisałem” / „czekam” bez odpowiedzi, do których zostało ~1,5 tygodnia
 * (FOLLOW_UP_BEFORE_DAYS) i od ostatniej wiadomości minęło min. FOLLOW_UP_MIN_QUIET_DAYS.
 */
export async function getFollowUps() {
  const today = nowLocal().slice(0, 10);
  const rows = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      startsAt: gigs.startsAt,
      status: gigs.status,
      createdAt: gigs.createdAt,
      statusChangedAt: gigs.statusChangedAt,
      headlinerName: headliner.name,
      cityName: sql<string | null>`coalesce(${cities.name}, (select c.name from cities c where c.id = ${venues.cityId}))`,
      lastMessageAt: sql<string | null>`(select max(i.date) from interactions i where i.gig_id = gigs.id)`,
      channels: sql<string | null>`(select group_concat(distinct i.channel) from interactions i where i.gig_id = gigs.id)`,
      lastReplied: sql<number | null>`(select i.replied from interactions i where i.gig_id = gigs.id order by i.date desc, i.id desc limit 1)`,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .leftJoin(cities, eq(gigs.cityId, cities.id))
    .leftJoin(headliner, eq(gigs.headlinerId, headliner.id))
    .where(and(inArray(gigs.status, ["contacted", "waiting"]), gte(gigs.startsAt, today)))
    .orderBy(asc(gigs.startsAt));
  // „Czekam” po odpowiedzi „jeszcze nie wiem” dalej wymaga przypomnienia; „odpisał” przy „napisałem” — nie.
  return rows
    .filter((g) => !g.lastReplied || g.status === "waiting")
    .map((g) => {
      const used = g.channels?.split(",") ?? [];
      const since = lastActivity(g);
      return {
        ...g,
        used,
        quietDays: daysSince(since, today),
        daysLeft: daysSince(today, g.startsAt),
        next: nextChannel(used),
        due: followUpTiming(g.startsAt, since, today).due,
      };
    })
    .filter((g) => g.due);
}

export type FollowUp = Awaited<ReturnType<typeof getFollowUps>>[number];

/**
 * Rytm grania (tygodnie wokół dzisiaj + podpowiedzi na luźne tygodnie)
 * + „najgorętsze okazje” z ~2-tygodniowym wyprzedzeniem.
 */
export async function getPlanning(loadEvents: (today: string) => Promise<EventRow[]> = loadUpcomingEvents) {
  const today = nowLocal().slice(0, 10);
  const from = new Date(Date.parse(today) - 35 * 864e5).toISOString().slice(0, 10);
  const [rows, opportunities] = await Promise.all([
    db
      .select({ id: gigs.id, title: gigs.title, startsAt: gigs.startsAt, status: gigs.status, context: gigs.context })
      .from(gigs)
      .where(and(gte(gigs.startsAt, from), inArray(gigs.status, ["confirmed", "interested", "contacted", "waiting"]))),
    getOpportunities(undefined, loadEvents),
  ]);
  // Najpierw znajomi, potem open miki, potem reszta w zasięgu; bez wyciszonych i tych, gdzie już mam granie.
  const order = { friends: 0, openMic: 1, inRange: 2 } as Record<string, number>;
  const usable = opportunities.filter((o) => o.tab in order && !o.myGigId);
  const ideas: RhythmOpportunity[] = [...usable]
    .sort((a, b) => order[a.tab] - order[b.tab] || a.event.startsAt.localeCompare(b.event.startsAt))
    .map((o) => ({
      eventId: o.event.id,
      title: o.event.title,
      startsAt: o.event.startsAt,
      cityName: o.event.cityName,
      href: `/events?${new URLSearchParams({ tab: o.tab, m: o.event.startsAt.slice(0, 7) })}`,
    }));
  const candidates: HotCandidate[] = usable.map((o) => ({
    eventId: o.event.id,
    url: o.event.url,
    title: o.event.title,
    startsAt: o.event.startsAt,
    cityName: o.event.cityName,
    venueName: o.event.venueName,
    isOpenMic: o.isOpenMic,
    tab: o.tab,
    availability: o.event.availability,
    travelMinutes: o.city?.travelMinutes ?? null,
    isNew: o.isNew,
    performer: o.performer,
    friend: o.tab === "friends" ? (o.matches[0]?.name ?? null) : null,
  }));
  return { ...getInsights(rows, ideas, today), hot: hotOpportunities(rows, candidates, today) };
}

export type Rhythm = Awaited<ReturnType<typeof getPlanning>>;
