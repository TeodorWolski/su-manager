/**
 * Dane do „Kto sprzedaje sale” i wyprzedzenia ogłaszania (src/lib/market.ts): wszystkie wydarzenia
 * z bileterii (też minione — sold out sprzed tygodnia też mówi o popycie), bez przewidywanych serii,
 * open miców i obcojęzycznych. Komik = kontakt z CRM, jeśli pasuje, inaczej nazwa z tytułu.
 */
import { and, eq, lt, ne, sql } from "drizzle-orm";
import { cities, contacts, db, events, gigs } from "@/db";
import { announceLead, rankHeadliners, type MarketEvent } from "./market";
import { matchContacts } from "./match";
import { isOpenMic, MAX_TRAVEL_MIN } from "./opportunities";
import { isWantedLanguage, performerKey, performerName } from "./performer";
import { RECURRING_SOURCE } from "./recurring";
import { normalize } from "./text";
import { nowLocal } from "./time";

export async function loadMarketEvents() {
  const [rows, cityRows, people, played] = await Promise.all([
    db
      .select({
        title: events.title,
        performers: events.performers,
        startsAt: events.startsAt,
        cityName: events.cityName,
        availability: events.availability,
        firstSeenAt: events.firstSeenAt,
      })
      .from(events)
      .where(ne(events.source, RECURRING_SOURCE)),
    db.select().from(cities),
    db
      .select({ id: contacts.id, name: contacts.name, aliases: contacts.aliases, ignoreInReport: contacts.ignoreInReport })
      .from(contacts)
      .where(eq(contacts.role, "comedian")),
    db
      .selectDistinct({ id: gigs.headlinerId })
      .from(gigs)
      .where(and(eq(gigs.status, "confirmed"), lt(gigs.startsAt, nowLocal()), sql`${gigs.headlinerId} is not null`)),
  ]);
  const byCity = new Map(cityRows.map((c) => [normalize(c.name), c]));
  const list: MarketEvent[] = rows
    .filter((e) => !isOpenMic(e.title) && isWantedLanguage(`${e.title} ${e.performers ?? ""}`))
    .map((e) => {
      const contact = matchContacts(`${e.title} ${e.performers ?? ""}`, people)[0];
      const city = byCity.get(normalize(e.cityName ?? ""));
      return {
        key: contact ? `c${contact.id}` : `t:${performerKey(e.title)}`,
        name: contact?.name ?? performerName(e.title),
        contactId: contact?.id ?? null,
        startsAt: e.startsAt,
        cityName: e.cityName,
        inRange: !!city && (city.hasLodging || (city.travelMinutes != null && city.travelMinutes <= MAX_TRAVEL_MIN)),
        availability: e.availability ?? null,
        firstSeenAt: e.firstSeenAt,
      };
    });
  const scrapeStart = rows.reduce((min, e) => (e.firstSeenAt < min ? e.firstSeenAt : min), rows[0]?.firstSeenAt ?? "");
  return {
    events: list,
    scrapeStart,
    playedBefore: new Set(played.flatMap((p) => (p.id ? [p.id] : []))),
    hidden: new Set(people.filter((p) => p.ignoreInReport).map((p) => `c${p.id}`)),
  };
}

/** Ranking „Kto sprzedaje sale”. */
export async function loadHeadlinerRanking() {
  const m = await loadMarketEvents();
  return rankHeadliners(m.events, { today: nowLocal().slice(0, 10), scrapeStart: m.scrapeStart, playedBefore: m.playedBefore, hidden: m.hidden });
}

/** Z jakim wyprzedzeniem ten komik (kontakt) ogłasza terminy — na karcie komika. */
export async function loadAnnounceLead(contactId: number) {
  const m = await loadMarketEvents();
  return announceLead(
    m.events.filter((e) => e.contactId === contactId),
    m.scrapeStart,
  );
}
