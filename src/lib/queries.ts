import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  bits,
  cities,
  contacts,
  db,
  gigBits,
  gigContacts,
  gigLogs,
  gigs,
  interactions,
  supports,
  venues,
  writingSessions,
  ideas,
  type GigStatus,
} from "@/db";
import { loadUpcomingEventsCached } from "./events-cache";
import { gigTotals } from "./gig-totals";
import { getFollowUps, getPlanning } from "./planning";
import { DEFAULT_START_TIME, nowLocal } from "./time";
import { normalize } from "./text";

/** Ile minut po starcie grania wyskakuje formularz oceny. */
export const REVIEW_DELAY_MIN = 90;
/** Grania bez wpisanej godziny: formularz o tej porze w dniu grania. */
export const REVIEW_TIME_DATE_ONLY = "21:00";
/** Formularz nigdy nie wcześniej niż o tej porze w dniu grania (wypełniam wieczorem). */
export const REVIEW_EARLIEST = "20:00";

const headliner = alias(contacts, "headliner");

/** Start grania do porównań — dla grań bez godziny dokleja DEFAULT_START_TIME. */
const startExpr = sql<string>`(case when length(${gigs.startsAt}) = 10 then ${gigs.startsAt} || 'T' || ${DEFAULT_START_TIME} else ${gigs.startsAt} end)`;
const rawStart = (alias: string) =>
  sql.raw(`(case when length(${alias}.starts_at) = 10 then ${alias}.starts_at || 'T${DEFAULT_START_TIME}' else ${alias}.starts_at end)`);

/**
 * Czy nadeszła pora formularza oceny: 90 min po starcie, ale nie wcześniej niż REVIEW_EARLIEST
 * (wypełniam wieczorem); granie bez godziny — o REVIEW_TIME_DATE_ONLY tego dnia.
 */
const reviewDue = () => sql`(case when length(${gigs.startsAt}) = 10
  then ${gigs.startsAt} || 'T' || ${REVIEW_TIME_DATE_ONLY} <= ${nowLocal()}
  else ${gigs.startsAt} <= ${nowLocal(-REVIEW_DELAY_MIN)}
    and substr(${gigs.startsAt}, 1, 10) || 'T' || ${REVIEW_EARLIEST} <= ${nowLocal()} end)`;

const gigListSelect = {
  id: gigs.id,
  title: gigs.title,
  startsAt: gigs.startsAt,
  status: gigs.status,
  context: gigs.context,
  venueId: gigs.venueId,
  venueName: venues.name,
  cityName: sql<string | null>`coalesce(${cities.name}, (select c.name from cities c where c.id = ${venues.cityId}))`,
  headlinerId: gigs.headlinerId,
  headlinerName: headliner.name,
  rating: gigLogs.rating,
  venueRating: gigLogs.venueRating,
  createdAt: gigs.createdAt,
};

function gigListQuery() {
  return db
    .select(gigListSelect)
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .leftJoin(cities, eq(gigs.cityId, cities.id))
    .leftJoin(headliner, eq(gigs.headlinerId, headliner.id))
    .leftJoin(gigLogs, eq(gigLogs.gigId, gigs.id));
}

export type GigListItem = Awaited<ReturnType<typeof listGigs>>[number];

export async function listGigs(view: "upcoming" | "pipeline" | "past" | "all" = "upcoming") {
  const now = nowLocal();
  const q = gigListQuery();
  switch (view) {
    case "upcoming":
      return q
        .where(and(eq(gigs.status, "confirmed"), sql`not ${reviewDue()}`))
        .orderBy(asc(gigs.startsAt));
    case "pipeline":
      return q
        .where(
          and(
            inArray(gigs.status, ["interested", "contacted", "waiting"]),
            gte(gigs.startsAt, now.slice(0, 10)),
          ),
        )
        .orderBy(asc(gigs.startsAt));
    case "past":
      return q
        .where(and(eq(gigs.status, "confirmed"), lt(startExpr, now)))
        .orderBy(desc(gigs.startsAt));
    case "all":
      // Bez odrzuconych — to historia moich grań, a nie odmów (te są przy kontaktach).
      return q.where(ne(gigs.status, "rejected")).orderBy(desc(gigs.startsAt));
  }
}

/** Potwierdzone grania, które już minęły, a nie mają logu — to one blokują apkę. */
export async function getPendingReviews() {
  return gigListQuery()
    .where(
      and(
        eq(gigs.status, "confirmed"),
        eq(gigs.skipReview, false),
        reviewDue(),
        isNull(gigLogs.gigId),
      ),
    )
    .orderBy(asc(gigs.startsAt));
}

/**
 * Dane do logu bez zasięgu (offline.html): potwierdzone grania od wczoraj do jutra bez logu
 * i bity do wyboru. Layout odkłada je w telefonie przy każdym otwarciu apki.
 */
export async function getOfflineLogData() {
  const today = nowLocal().slice(0, 10);
  const day = (n: number) => new Date(Date.parse(today) + n * 864e5).toISOString().slice(0, 10);
  const list = await gigListQuery()
    .where(
      and(
        eq(gigs.status, "confirmed"),
        eq(gigs.skipReview, false),
        isNull(gigLogs.gigId),
        gte(gigs.startsAt, day(-1)),
        lt(gigs.startsAt, day(2)),
      ),
    )
    .orderBy(asc(gigs.startsAt));
  if (!list.length) return { gigs: [], bits: [] };
  const allBits = await db
    .select({ id: bits.id, name: bits.name, lengthMin: bits.lengthMin })
    .from(bits)
    .where(ne(bits.status, "rejected"))
    .orderBy(asc(bits.name));
  return {
    gigs: list.map((g) => ({
      id: g.id,
      title: g.title,
      startsAt: g.startsAt,
      place: [g.venueName, g.cityName].filter(Boolean).join(", "),
      context: g.context,
      headlinerId: g.headlinerId,
    })),
    bits: allBits,
  };
}

export type OfflineLogData = Awaited<ReturnType<typeof getOfflineLogData>>;

export async function getGig(id: number) {
  // Równolegle — każde zapytanie to osobny round-trip do Turso.
  const [[row], [gig], [log], playedBits, lineup, messages] = await Promise.all([
    gigListQuery().where(eq(gigs.id, id)),
    db.select().from(gigs).where(eq(gigs.id, id)),
    db.select().from(gigLogs).where(eq(gigLogs.gigId, id)),
    db
      .select({ id: bits.id, name: bits.name, reaction: gigBits.reaction })
      .from(gigBits)
      .innerJoin(bits, eq(gigBits.bitId, bits.id))
      .where(eq(gigBits.gigId, id)),
    db
      .select({ id: contacts.id, name: contacts.name })
      .from(gigContacts)
      .innerJoin(contacts, eq(gigContacts.contactId, contacts.id))
      .where(eq(gigContacts.gigId, id)),
    db
      .select({
        id: interactions.id,
        contactId: interactions.contactId,
        contactName: contacts.name,
        date: interactions.date,
        channel: interactions.channel,
        replied: interactions.replied,
      })
      .from(interactions)
      .leftJoin(contacts, eq(contacts.id, interactions.contactId))
      .where(eq(interactions.gigId, id))
      .orderBy(asc(interactions.date), asc(interactions.id)),
  ]);
  if (!row || !gig) return null;
  return {
    ...row,
    gig,
    log: log ?? null,
    bits: playedBits,
    lineup,
    messages,
    supports: gig.headlinerId ? await listSupports(gig.headlinerId) : [],
  };
}

/**
 * Supporty headlinera (aktualni najpierw, potem ostatnio potwierdzeni) — do „Napisz do supportu”
 * na karcie grania i do sekcji „Supporty” na karcie komika.
 */
export async function listSupports(headlinerId: number) {
  return db
    .select({ id: supports.id, contactId: contacts.id, name: contacts.name, active: supports.active, lastSeen: supports.lastSeen })
    .from(supports)
    .innerJoin(contacts, eq(contacts.id, supports.supportId))
    .where(eq(supports.headlinerId, headlinerId))
    .orderBy(desc(supports.active), desc(supports.lastSeen), asc(contacts.name));
}

/** U kogo ten komik robi (robił) support — na jego karcie. */
export async function listSupportedBy(supportId: number) {
  return db
    .select({ id: supports.id, contactId: contacts.id, name: contacts.name, active: supports.active, lastSeen: supports.lastSeen })
    .from(supports)
    .innerJoin(contacts, eq(contacts.id, supports.headlinerId))
    .where(eq(supports.supportId, supportId))
    .orderBy(desc(supports.active), desc(supports.lastSeen), asc(contacts.name));
}

export async function listCities() {
  return db.select().from(cities).orderBy(asc(cities.priority), asc(cities.travelMinutes), asc(cities.name));
}

export async function listVenues() {
  const now = nowLocal();
  return db
    .select({
      id: venues.id,
      name: venues.name,
      cityId: venues.cityId,
      cityName: cities.name,
      recurrence: venues.recurrence,
      travelMinutes: sql<number | null>`coalesce(${venues.travelMinutes}, ${cities.travelMinutes})`,
      hasLodging: sql<boolean>`(${venues.hasLodging} or coalesce(${cities.hasLodging}, 0))`,
      verdict: venues.verdict,
      gigCount: sql<number>`(select count(*) from gigs g where g.venue_id = venues.id and g.status = 'confirmed' and ${rawStart("g")} < ${now})`,
      myAvg: sql<number | null>`(select avg(l.rating) from gig_logs l join gigs g on g.id = l.gig_id where g.venue_id = venues.id)`,
      venueAvg: sql<number | null>`(select avg(l.venue_rating) from gig_logs l join gigs g on g.id = l.gig_id where g.venue_id = venues.id)`,
    })
    .from(venues)
    .leftJoin(cities, eq(venues.cityId, cities.id))
    .orderBy(asc(cities.priority), asc(venues.name));
}

export async function getVenue(id: number) {
  const [venue] = await db.select().from(venues).where(eq(venues.id, id));
  if (!venue) return null;
  const venueGigs = await gigListQuery().where(eq(gigs.venueId, id)).orderBy(desc(gigs.startsAt));
  return { venue, gigs: venueGigs };
}

export async function listContacts() {
  const now = nowLocal();
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      role: contacts.role,
      relation: contacts.relation,
      ignoreInReport: contacts.ignoreInReport,
      ignoreReason: contacts.ignoreReason,
      lastPlayedTogether: sql<string | null>`(
        select max(g.starts_at) from gigs g
        where g.status = 'confirmed' and ${rawStart("g")} < ${now}
          and (g.headliner_id = contacts.id
            or exists (select 1 from gig_contacts gc where gc.gig_id = g.id and gc.contact_id = contacts.id)))`,
      lastInteraction: sql<string | null>`(select max(i.date) from interactions i where i.contact_id = contacts.id)`,
    })
    .from(contacts)
    .orderBy(asc(contacts.name));
}

export async function getContact(id: number) {
  const [[contact], history, sharedGigs, asHeadliner] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.id, id)),
    // Też wiadomości przy graniach przed nim wysłane do kogoś innego (np. przez supportu).
    db
      .select({
        id: interactions.id,
        contactId: interactions.contactId,
        contactName: contacts.name,
        gigId: interactions.gigId,
        date: interactions.date,
        channel: interactions.channel,
        topic: interactions.topic,
        replied: interactions.replied,
      })
      .from(interactions)
      .leftJoin(contacts, eq(contacts.id, interactions.contactId))
      .where(
        sql`${interactions.contactId} = ${id} or ${interactions.gigId} in (select g.id from gigs g where g.headliner_id = ${id})`,
      )
      .orderBy(desc(interactions.date), desc(interactions.id)),
    gigListQuery()
      .innerJoin(gigContacts, eq(gigContacts.gigId, gigs.id))
      .where(eq(gigContacts.contactId, id))
      .orderBy(desc(gigs.startsAt)),
    gigListQuery().where(eq(gigs.headlinerId, id)).orderBy(desc(gigs.startsAt)),
  ]);
  if (!contact) return null;
  return { contact, history, gigs: dedupeById([...sharedGigs, ...asHeadliner]) };
}

function dedupeById<T extends { id: number }>(items: T[]) {
  return [...new Map(items.map((i) => [i.id, i])).values()];
}

export async function listBits() {
  return db
    .select({
      id: bits.id,
      name: bits.name,
      status: bits.status,
      lengthMin: bits.lengthMin,
      timesPlayed: sql<number>`(select count(*) from gig_bits gb join gig_logs l on l.gig_id = gb.gig_id where gb.bit_id = bits.id)`,
      ups: sql<number>`(select count(*) from gig_bits gb where gb.bit_id = bits.id and gb.reaction = 1)`,
      downs: sql<number>`(select count(*) from gig_bits gb where gb.bit_id = bits.id and gb.reaction = -1)`,
      lastPlayed: sql<string | null>`(select max(g.starts_at) from gig_bits gb join gigs g on g.id = gb.gig_id where gb.bit_id = bits.id)`,
      createdAt: bits.createdAt,
    })
    .from(bits)
    .orderBy(
      sql`case ${bits.status} when 'tested' then 0 when 'testing' then 1 when 'editing' then 2 when 'vomit' then 3 else 4 end`,
      asc(bits.name),
    );
}

export async function getBit(id: number) {
  const [bit] = await db.select().from(bits).where(eq(bits.id, id));
  if (!bit) return null;
  const bitGigs = await db
    .select({ ...gigListSelect, reaction: gigBits.reaction })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .leftJoin(cities, eq(gigs.cityId, cities.id))
    .leftJoin(headliner, eq(gigs.headlinerId, headliner.id))
    .leftJoin(gigLogs, eq(gigLogs.gigId, gigs.id))
    .innerJoin(gigBits, eq(gigBits.gigId, gigs.id))
    .where(eq(gigBits.bitId, id))
    .orderBy(desc(gigs.startsAt));
  const sessions = await db
    .select()
    .from(writingSessions)
    .where(eq(writingSessions.bitId, id))
    .orderBy(desc(writingSessions.date), desc(writingSessions.id));
  return { bit, gigs: bitGigs, sessions };
}

/** Pomysły do przejrzenia (nowe, najświeższe najpierw). */
export async function listIdeas() {
  return db.select().from(ideas).where(eq(ideas.status, "new")).orderBy(desc(ideas.createdAt), desc(ideas.id));
}

/**
 * Bity w pracy (do redakcji, w testach, drafty) z tym, co przydaje się przy pisaniu:
 * link do tekstu, ostatnia sesja nad bitem, ostatnia reakcja ze sceny.
 */
export async function listBitsInProgress() {
  return db
    .select({
      id: bits.id,
      name: bits.name,
      status: bits.status,
      lengthMin: bits.lengthMin,
      docUrl: bits.docUrl,
      lastSession: sql<string | null>`(select max(ws.date) from writing_sessions ws where ws.bit_id = bits.id)`,
      lastReaction: sql<number | null>`(select gb.reaction from gig_bits gb join gigs g on g.id = gb.gig_id where gb.bit_id = bits.id and gb.reaction is not null order by g.starts_at desc limit 1)`,
      lastPlayed: sql<string | null>`(select max(g.starts_at) from gig_bits gb join gigs g on g.id = gb.gig_id where gb.bit_id = bits.id)`,
    })
    .from(bits)
    .where(inArray(bits.status, ["editing", "testing", "vomit"]))
    .orderBy(sql`case ${bits.status} when 'editing' then 0 when 'testing' then 1 else 2 end`, asc(bits.name));
}

/** Historia pisania: sesje z ostatnich `days` dni (najnowsze najpierw), z nazwą bitu. */
export async function listWriting(days = 60) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  return db
    .select({
      id: writingSessions.id,
      date: writingSessions.date,
      kind: writingSessions.kind,
      minutes: writingSessions.minutes,
      note: writingSessions.note,
      bitId: writingSessions.bitId,
      bitName: bits.name,
    })
    .from(writingSessions)
    .leftJoin(bits, eq(bits.id, writingSessions.bitId))
    .where(gte(writingSessions.date, since))
    .orderBy(desc(writingSessions.date), desc(writingSessions.id));
}

export async function listThoughts(query?: string) {
  const rows = await db
    .select({
      gigId: gigs.id,
      title: gigs.title,
      startsAt: gigs.startsAt,
      venueName: venues.name,
      rating: gigLogs.rating,
      thoughts: gigLogs.thoughts,
    })
    .from(gigLogs)
    .innerJoin(gigs, eq(gigLogs.gigId, gigs.id))
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(sql`${gigLogs.thoughts} is not null`, ne(gigLogs.thoughts, "")))
    .orderBy(desc(gigs.startsAt));
  if (!query?.trim()) return rows;
  // SQLite LIKE nie rozumie polskich znaków — przy setkach logów filtr w JS jest w zupełności OK.
  const terms = normalize(query).split(/\s+/);
  return rows.filter((r) => {
    const hay = normalize(`${r.thoughts} ${r.title} ${r.venueName ?? ""}`);
    return terms.every((t) => hay.includes(t));
  });
}

export async function getDashboard() {
  const now = nowLocal();
  const monthStart = `${now.slice(0, 7)}-01`;
  const [upcoming, allPipeline, followUps, [month], recent] = await Promise.all([
    listGigs("upcoming"),
    listGigs("pipeline"),
    getFollowUps(),
    // Liczymy wszystkie zagrane w tym miesiącu (też bez logu); średnia — tylko z ocenionych.
    db
      .select({
        count: sql<number>`count(*)`,
        avg: sql<number | null>`avg(${gigLogs.rating})`,
      })
      .from(gigs)
      .leftJoin(gigLogs, eq(gigLogs.gigId, gigs.id))
      .where(and(eq(gigs.status, "confirmed"), gte(gigs.startsAt, monthStart), lt(startExpr, now))),
    listThoughts().then((r) => r.slice(0, 3)),
  ]);
  // Grania do ponowienia mają własną sekcję — nie dublujemy ich w „W toku”.
  const due = new Set(followUps.map((g) => g.id));
  const pipeline = allPipeline.filter((g) => !due.has(g.id));
  return { upcoming, pipeline, followUps, month, recent };
}

/** Opcje do selectów w formularzach. */
export async function getFormOptions() {
  const [allVenues, allCities, allContacts, allBits] = await Promise.all([
    db
      .select({ id: venues.id, name: venues.name, cityName: cities.name })
      .from(venues)
      .leftJoin(cities, eq(venues.cityId, cities.id))
      .orderBy(asc(venues.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.name)),
    db
      .select({ id: contacts.id, name: contacts.name, role: contacts.role, ignoreReason: contacts.ignoreReason })
      .from(contacts)
      .orderBy(asc(contacts.name)),
    db
      .select({ id: bits.id, name: bits.name, status: bits.status, lengthMin: bits.lengthMin })
      .from(bits)
      .orderBy(asc(bits.name)),
  ]);
  return { venues: allVenues, cities: allCities, contacts: allContacts, bits: allBits };
}

export type FormOptions = Awaited<ReturnType<typeof getFormOptions>>;
export type { GigStatus };

/** Potwierdzone grania do feedu kalendarza (.ics). */
export async function listCalendarGigs() {
  return db
    .select({
      id: gigs.id,
      title: gigs.title,
      startsAt: gigs.startsAt,
      url: gigs.url,
      notes: gigs.notes,
      context: gigs.context,
      venueName: gigListSelect.venueName,
      cityName: gigListSelect.cityName,
      headlinerName: gigListSelect.headlinerName,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .leftJoin(cities, eq(gigs.cityId, cities.id))
    .leftJoin(headliner, eq(gigs.headlinerId, headliner.id))
    .where(eq(gigs.status, "confirmed"))
    .orderBy(asc(gigs.startsAt));
}

/** Rytm + najgorętsze okazje — z pamięcią podręczną wydarzeń (logika w planning.ts). */
export const getRhythm = () => getPlanning(loadUpcomingEventsCached);

/** Statystyki: skuteczność pisania (wyniki rozmów, kanały) i jak mi idzie (oceny wg kontekstu, sceny, miesiąca). */
/** Licznik zagranych występów (potwierdzone, już po starcie) — w Statystykach i w Więcej. */
export async function getGigTotals() {
  return gigTotals(await getPlayedGigs(), nowLocal().slice(0, 10));
}

/** Zagrane występy, najnowsze najpierw (lista z licznika: /stats/played). */
export async function getPlayedGigs() {
  return gigListQuery()
    .where(and(eq(gigs.status, "confirmed"), lt(startExpr, nowLocal())))
    .orderBy(desc(gigs.startsAt));
}

export async function getStats() {
  const [outcomes, channels, byContext, byVenue, byMonth] = await Promise.all([
    db
      .select({ outcome: gigs.outcome, n: sql<number>`count(*)` })
      .from(gigs)
      .where(sql`${gigs.outcome} is not null`)
      .groupBy(gigs.outcome),
    // Wiadomości w sprawie grań: ile wysłanych na kanale i na ile przyszła odpowiedź.
    db
      .select({
        channel: interactions.channel,
        sent: sql<number>`count(*)`,
        replied: sql<number>`sum(case when ${interactions.replied} = 1 then 1 else 0 end)`,
      })
      .from(interactions)
      .where(sql`${interactions.gigId} is not null`)
      .groupBy(interactions.channel)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ context: gigs.context, avg: sql<number>`avg(${gigLogs.rating})`, n: sql<number>`count(*)` })
      .from(gigLogs)
      .innerJoin(gigs, eq(gigs.id, gigLogs.gigId))
      .groupBy(gigs.context),
    db
      .select({ id: venues.id, name: venues.name, avg: sql<number>`avg(${gigLogs.rating})`, n: sql<number>`count(*)` })
      .from(gigLogs)
      .innerJoin(gigs, eq(gigs.id, gigLogs.gigId))
      .innerJoin(venues, eq(venues.id, gigs.venueId))
      .groupBy(venues.id)
      .having(sql`count(*) >= 2`)
      .orderBy(desc(sql`avg(${gigLogs.rating})`)),
    db
      .select({ month: sql<string>`substr(${gigs.startsAt}, 1, 7)`, avg: sql<number>`avg(${gigLogs.rating})`, n: sql<number>`count(*)` })
      .from(gigLogs)
      .innerJoin(gigs, eq(gigs.id, gigLogs.gigId))
      .groupBy(sql`substr(${gigs.startsAt}, 1, 7)`)
      .orderBy(desc(sql`substr(${gigs.startsAt}, 1, 7)`))
      .limit(6),
  ]);
  return { outcomes, channels, byContext, byVenue, byMonth: byMonth.reverse() };
}
