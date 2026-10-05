/**
 * Import grań spisanych ręcznie: historia (marzec–październik 2026) + zaplanowane.
 * Idempotentny: miasta/sceny/kontakty szuka po nazwie, grania po (tytuł + data).
 * Grania sprzed dnia importu nie wymuszają formularza oceny; przyszłe — normalnie.
 * Uruchom: pnpm tsx scripts/import-gigs.ts   (na Turso: z DATABASE_URL + DATABASE_AUTH_TOKEN)
 */
import "dotenv/config";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cities, contacts, db, gigContacts, gigs, venues, type Contact, type GigContext } from "../src/db";
import { nowLocal } from "../src/lib/time";

/** Miasta spoza słownika. Czas dojazdu z Warszawy orientacyjny — popraw w apce. */
const NEW_CITIES: { name: string; travelMinutes: number | null; notes?: string }[] = [
  { name: "Mogilno", travelMinutes: 210 },
  { name: "Inowrocław", travelMinutes: 170 },
  { name: "Piaski", travelMinutes: 270, notes: "Wielkopolska, między Lesznem a Jarocinem" },
  { name: "Zielona Góra", travelMinutes: 330 },
  { name: "Lubniewice", travelMinutes: 330 },
  { name: "Ośno Lubuskie", travelMinutes: 330 },
  { name: "Kartuzy", travelMinutes: 210 },
  { name: "Dziwnów", travelMinutes: 400 },
  { name: "Końskie", travelMinutes: 150 },
  { name: "Grójec", travelMinutes: 60 },
  { name: "Konstancin-Jeziorna", travelMinutes: 40 },
];

const HEADLINERS: {
  name: string;
  aliases?: string;
  role?: Contact["role"];
  relation?: Contact["relation"];
  notes?: string;
}[] = [
  { name: "Jacek Stramik" },
  { name: "Rafał Sumowski" },
  { name: "Tomek Kołecki", aliases: "Tomasz Kołecki" },
  { name: "Zbychu Grabowski", aliases: "Zbigniew Grabowski" },
  { name: "Mariusz Kałamaga" },
  { name: "Ewa Stasiewicz" },
  { name: "Damian Usewicz", aliases: "Viking, Damian Viking Usewicz" },
  { name: "Tomasz Bartkowiak", aliases: "Karp, Tomek Bartkowiak, Tomasz Karp Bartkowiak" },
  // zaplanowane — zgoda na open mic przed nimi
  { name: "Sebastian Rejent", relation: "agreed" },
  { name: "Roman Kostelecki", relation: "agreed" },
  { name: "Wiktor Sumliński", relation: "agreed" },
  { name: "Arnold Cytrowski", role: "organizer", relation: "none", notes: "Dziadowski Open-mic, Wrocław." },
  { name: "Syrek-Dąbrowski", relation: "none", notes: "Prowadził open mic w Gnieździe Piratów (21.06)." },
];

type Row = {
  date: string;
  title: string;
  venue: string | null;
  city: string | null;
  context?: GigContext;
  headliner?: string;
  lineup?: string[];
  /** Kontakt bez roli na scenie (organizator) — tylko tworzony w CRM. */
  organizer?: string;
  notes?: string;
};

const GIGS: Row[] = [
  { date: "2026-03-27", title: "Burzowanko Comedy Night", venue: "Restauracja Patryk", city: "Mogilno" },
  { date: "2026-04-16", title: "Burzowanko Comedy Night", venue: "Restauracja Dąbrówka", city: "Inowrocław" },
  { date: "2026-04-17", title: "Maraton stand-upu", venue: "Dom Kultury", city: "Piaski", context: "opener", headliner: "Damian Usewicz", lineup: ["Tomasz Bartkowiak"] },
  { date: "2026-04-19", title: "Jacek Stramik — testy programu „Deprawacja”", venue: "3ecia Strona Baru", city: "Poznań", context: "opener", headliner: "Jacek Stramik" },
  { date: "2026-05-21", title: "Stand-up Lublin: Open Mic", venue: "Just Crafted", city: "Lublin", context: "open_mic" },
  { date: "2026-05-24", title: "Open-Mic Comedy Lab", venue: "103-8 FM", city: "Kraków", context: "open_mic" },
  { date: "2026-06-12", title: "Social Komedia", venue: "Czeski Film", city: "Wrocław" },
  { date: "2026-06-18", title: "Stand-up ON Zielona Góra", venue: "Cafe Noir", city: "Zielona Góra" },
  { date: "2026-06-19", title: "Plener Lubniewice", venue: "Plener", city: "Lubniewice" },
  { date: "2026-06-20", title: "BohoArt Open Mic", venue: "BohoArt", city: "Łódź", context: "open_mic" },
  { date: "2026-06-21", title: "Open mic (prow. Syrek-Dąbrowski)", venue: "Gniazdo Piratów", city: "Warszawa", context: "open_mic", lineup: ["Syrek-Dąbrowski"], notes: "Tawerna żeglarska." },
  { date: "2026-06-28", title: "Open-Mic Comedy Lab", venue: "103-8 FM", city: "Kraków", context: "open_mic" },
  { date: "2026-07-01", title: "Open-Mic Comedy Lab", venue: "103-8 FM", city: "Kraków", context: "open_mic" },
  { date: "2026-07-03", title: "Plener Lubniewice", venue: "Plener", city: "Lubniewice" },
  { date: "2026-07-04", title: "Plener Ośno Lubuskie", venue: "Plener", city: "Ośno Lubuskie" },
  { date: "2026-07-05", title: "Kartuzy, Antykvariat Cafe", venue: "Antykvariat Cafe", city: "Kartuzy" },
  { date: "2026-07-11", title: "Dziwnów, Dom Kultury", venue: "Dom Kultury", city: "Dziwnów" },
  { date: "2026-07-23", title: "Bar a boo", venue: "Bar a boo", city: "Warszawa" },
  { date: "2026-07-25", title: "Backstreet Bar", venue: "Backstreet Bar", city: "Warszawa" },
  { date: "2026-07-26", title: "Stand-up Rzeszów", venue: "Underground Pub", city: "Rzeszów" },
  { date: "2026-07-29", title: "Open-Mic Comedy Lab", venue: "103-8 FM", city: "Kraków", context: "open_mic" },
  { date: "2026-08-19", title: "Open mic Wolna Wola", venue: "Wolna Wola", city: "Warszawa", context: "open_mic" },
  { date: "2026-08-20", title: "Bar a boo", venue: "Bar a boo", city: "Warszawa" },
  { date: "2026-08-20", title: "Open mic Błękitny Ogród", venue: "Błękitny Ogród", city: "Warszawa", context: "open_mic" },
  { date: "2026-08-22", title: "Open mic przed Rafałem Sumowskim", venue: "Klub Wędrówki", city: "Wrocław", context: "open_mic", headliner: "Rafał Sumowski" },
  { date: "2026-08-30", title: "Open-Mic Comedy Lab", venue: "103-8 FM", city: "Kraków", context: "open_mic" },
  { date: "2026-09-01", title: "Open mic przed Tomkiem Kołeckim", venue: "Klub Buda", city: "Kraków", context: "open_mic", headliner: "Tomek Kołecki" },
  { date: "2026-09-04", title: "Open mic Resort Komedii", venue: "Resort Komedii", city: "Warszawa", context: "open_mic" },
  { date: "2026-09-05", title: "Open mic Świetlica Wolności", venue: "Świetlica Wolności", city: "Warszawa", context: "open_mic" },
  { date: "2026-09-19", title: "Zbychu Grabowski — „Kryzys Życia Średniego”", venue: "I LO im. KEN", city: "Końskie", context: "opener", headliner: "Zbychu Grabowski" },
  { date: "2026-09-20", title: "Open mic Klub Oczki", venue: "Klub Oczki", city: "Warszawa", context: "open_mic" },
  { date: "2026-09-21", title: "Jacek Stramik — „Deprawacja”", venue: "Klub Bazar", city: "Warszawa", context: "opener", headliner: "Jacek Stramik" },
  { date: "2026-09-22", title: "Mariusz Kałamaga — „Mamo, papier się skończył”", venue: "Dom Kultury", city: "Grójec", context: "opener", headliner: "Mariusz Kałamaga" },
  { date: "2026-09-23", title: "Mariusz Kałamaga — „Mamo, papier się skończył”", venue: "Dom Kultury", city: "Konstancin-Jeziorna", context: "opener", headliner: "Mariusz Kałamaga" },
  { date: "2026-09-24", title: "Open mic Pub Biblioteka", venue: "Pub Biblioteka", city: "Łódź", context: "open_mic" },
  { date: "2026-09-30", title: "Ewa Stasiewicz — „Centrum zarządzania światem”", venue: "Praska Perliczka", city: "Warszawa", context: "opener", headliner: "Ewa Stasiewicz" },
  { date: "2026-10-03", title: "Open mic Świetlica Wolności", venue: "Świetlica Wolności", city: "Warszawa", context: "open_mic" },
  // ── zaplanowane ──
  { date: "2026-10-08T18:00", title: "Sebastian Rejent — „Ku lepszej Polsce”", venue: "Publiczna Biblioteka", city: "Piaseczno", context: "opener", headliner: "Sebastian Rejent" },
  { date: "2026-10-09T19:00", title: "Roman Kostelecki — „Ognisko”", venue: "Hotel Campanile", city: "Łódź", context: "opener", headliner: "Roman Kostelecki" },
  { date: "2026-10-17T19:00", title: "Wiktor Sumliński — „Profesja”", venue: "Graciarnia", city: "Gdańsk", context: "opener", headliner: "Wiktor Sumliński" },
  { date: "2026-10-21T19:00", title: "Open mic Stand-up Lokal", venue: "Stand-up Lokal", city: "Warszawa", context: "open_mic" },
  { date: "2026-10-25T19:00", title: "Planetarny Stand-up", venue: "Coffee Planet", city: "Wrocław", context: "open_mic" },
  { date: "2026-10-27T19:00", title: "Dziadowski Open-mic", venue: "Dziady i Koktajle", city: "Wrocław", context: "open_mic", organizer: "Arnold Cytrowski" },
];

async function cityId(name: string | null) {
  if (!name) return null;
  const [row] = await db.select({ id: cities.id }).from(cities).where(eq(cities.name, name));
  if (!row) throw new Error(`Brak miasta w słowniku: ${name}`);
  return row.id;
}

async function venueId(name: string, city: number | null) {
  const where = and(eq(venues.name, name), city ? eq(venues.cityId, city) : isNull(venues.cityId));
  const [found] = await db.select({ id: venues.id }).from(venues).where(where);
  if (found) return found.id;
  const [row] = await db.insert(venues).values({ name, cityId: city }).returning({ id: venues.id });
  return row.id;
}

async function contactId(name: string) {
  const [found] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.name, name));
  if (found) return found.id;
  const h = HEADLINERS.find((x) => x.name === name);
  const [row] = await db
    .insert(contacts)
    .values({
      name,
      aliases: h?.aliases,
      role: h?.role ?? "comedian",
      relation: h?.relation ?? "opened_for",
      notes: h?.notes,
    })
    .returning({ id: contacts.id });
  return row.id;
}

async function main() {
  await db
    .insert(cities)
    .values(NEW_CITIES.map((c) => ({ ...c, notes: c.notes ?? "dodane przy imporcie — sprawdź czas dojazdu" })))
    .onConflictDoNothing();

  const today = nowLocal().slice(0, 10);
  let added = 0;
  for (const g of GIGS) {
    const [exists] = await db
      .select({ id: gigs.id })
      .from(gigs)
      // po samej dacie — godzina mogła zostać dopisana później
      .where(and(eq(gigs.title, g.title), sql`substr(${gigs.startsAt}, 1, 10) = ${g.date.slice(0, 10)}`));
    if (exists) continue;

    const city = await cityId(g.city);
    const [row] = await db
      .insert(gigs)
      .values({
        title: g.title,
        startsAt: g.date,
        venueId: g.venue ? await venueId(g.venue, city) : null,
        cityId: g.venue ? null : city,
        status: "confirmed",
        context: g.context ?? null,
        headlinerId: g.headliner ? await contactId(g.headliner) : null,
        notes: g.notes ?? null,
        skipReview: g.date.slice(0, 10) < today,
      })
      .returning({ id: gigs.id });

    if (g.organizer) await contactId(g.organizer);
    for (const name of g.lineup ?? []) {
      await db.insert(gigContacts).values({ gigId: row.id, contactId: await contactId(name) });
    }
    added++;
  }
  console.log(`Zaimportowano ${added} z ${GIGS.length} grań.`);
}

main();
