/**
 * Raport okazji: wydarzenia ze scrapera przefiltrowane pod moje kryteria
 * i dopasowane do kontaktów z CRM. Bez "server-only" — używa go też skrypt crona.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { cities, contacts, db, events, gigs, hiddenTitles, venues, type City, type Contact, type Event } from "@/db";
import { matchContacts } from "./match";
import { normalize } from "./text";
import { nowLocal } from "./time";

/** Maks. czas dojazdu w jedną stronę; miasta z noclegiem wchodzą zawsze. */
export const MAX_TRAVEL_MIN = 180;
/** Ile dni wydarzenie jest „nowe” w aplikacji. */
export const NEW_FOR_DAYS = 7;

export type MatchedContact = Pick<Contact, "id" | "name" | "relation" | "ignoreInReport"> & {
  lastPlayedTogether: string | null;
};

export type Opportunity = {
  event: Event;
  city: City | null;
  inRange: boolean;
  matches: MatchedContact[];
  isNew: boolean;
  isOpenMic: boolean;
  /** Moje granie tego dnia z tym headlinerem albo w tym mieście (dodane ręcznie lub wcześniej z Okazji). */
  myGigId: number | null;
  group: "friends" | "inRange" | "unknownCity";
};

export const dedupeKey = (title: string, startsAt: string, venue: string | null) =>
  [normalize(title), startsAt.slice(0, 10), normalize(venue ?? "")].join("|");

export const isOpenMic = (title: string) => /open[\s-]?mi[ck]|\bom\b/.test(normalize(title));

async function loadContext() {
  const now = nowLocal();
  const [allCities, people, never, hidden, myGigs] = await Promise.all([
    db.select().from(cities),
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        aliases: contacts.aliases,
        relation: contacts.relation,
        ignoreInReport: contacts.ignoreInReport,
        lastPlayedTogether: sql<string | null>`(
          select max(g.starts_at) from gigs g
          where g.status = 'confirmed' and g.starts_at < ${now}
            and (g.headliner_id = contacts.id
              or exists (select 1 from gig_contacts gc where gc.gig_id = g.id and gc.contact_id = contacts.id)))`,
      })
      .from(contacts),
    db
      .select({ name: venues.name, cityName: cities.name })
      .from(venues)
      .leftJoin(cities, eq(venues.cityId, cities.id))
      .where(eq(venues.verdict, "never")),
    db.select({ t: hiddenTitles.normalizedTitle }).from(hiddenTitles),
    db
      .select({
        id: gigs.id,
        startsAt: gigs.startsAt,
        headlinerId: gigs.headlinerId,
        cityName: sql<string | null>`coalesce(
          (select c.name from cities c where c.id = ${gigs.cityId}),
          (select c.name from venues v join cities c on c.id = v.city_id where v.id = ${gigs.venueId}))`,
      })
      .from(gigs)
      .where(and(gte(gigs.startsAt, now.slice(0, 10)), sql`${gigs.status} not in ('rejected', 'cancelled')`)),
  ]);
  return {
    citiesByName: new Map(allCities.map((c) => [normalize(c.name), c])),
    people,
    blacklist: new Set(never.map((v) => `${normalize(v.name)}|${normalize(v.cityName ?? "")}`)),
    hidden: new Set(hidden.map((h) => h.t)),
    myGigs,
  };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

function classify(e: Event, ctx: Ctx, newSince: string): Opportunity | null {
  if (e.dismissed || ctx.hidden.has(normalize(e.title))) return null;
  if (ctx.blacklist.has(`${normalize(e.venueName ?? "")}|${normalize(e.cityName ?? "")}`)) return null;

  const city = e.cityName ? (ctx.citiesByName.get(normalize(e.cityName)) ?? null) : null;
  const inRange = !!city && (city.hasLodging || (city.travelMinutes != null && city.travelMinutes <= MAX_TRAVEL_MIN));
  const all = matchContacts(`${e.title} ${e.performers ?? ""}`, ctx.people);
  const matches = all.filter((m) => !m.ignoreInReport);
  if (all.length && !matches.length) return null; // sami „pomijani w raporcie”

  const group = matches.length ? "friends" : !city || city.travelMinutes == null ? "unknownCity" : inRange ? "inRange" : null;
  if (!group) return null;
  const day = e.startsAt.slice(0, 10);
  const myGig = ctx.myGigs.find(
    (g) =>
      g.startsAt.slice(0, 10) === day &&
      (all.some((m) => m.id === g.headlinerId) || (!!g.cityName && normalize(g.cityName) === normalize(e.cityName ?? ""))),
  );
  return {
    event: e,
    city,
    inRange,
    matches,
    isNew: e.firstSeenAt >= newSince,
    isOpenMic: isOpenMic(e.title),
    myGigId: e.gigId ?? myGig?.id ?? null,
    group,
  };
}

/** Nadchodzące okazje. `onlyIds` — tylko te wydarzenia (np. nowe z dzisiejszego przebiegu crona). */
export async function getOpportunities(onlyIds?: Set<number>) {
  const ctx = await loadContext();
  const today = nowLocal().slice(0, 10);
  // firstSeenAt jest w UTC (datetime('now')) — porównujemy w tym samym formacie.
  const newSince = new Date(Date.now() - NEW_FOR_DAYS * 864e5).toISOString().replace("T", " ").slice(0, 19);
  const rows = await db
    .select()
    .from(events)
    .where(and(gte(events.startsAt, today), eq(events.dismissed, false)))
    .orderBy(events.startsAt);
  return rows
    .filter((e) => !onlyIds || onlyIds.has(e.id))
    .map((e) => classify(e, ctx, newSince))
    .filter((o): o is Opportunity => o !== null);
}
