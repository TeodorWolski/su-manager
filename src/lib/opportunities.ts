/**
 * Raport okazji: wydarzenia ze scrapera przefiltrowane pod moje kryteria
 * i dopasowane do kontaktów z CRM. Bez "server-only" — używa go też skrypt crona.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { cities, contacts, db, events, gigs, hiddenTitles, venues, type City, type Contact, type Event } from "@/db";
import { matchContacts, matchesQuery } from "./match";
import { isWantedLanguage, performerKey, performerName } from "./performer";
import { normalize } from "./text";
import { nowLocal, parseDateQuery } from "./time";

/** Maks. czas dojazdu w jedną stronę; miasta z noclegiem wchodzą zawsze. */
export const MAX_TRAVEL_MIN = 180;
/** Ile dni wydarzenie jest „nowe” w aplikacji. */
export const NEW_FOR_DAYS = 7;
/** Po wspólnym wieczorze nie proponuj tego komika przez tyle dni (chyba że kontakt ma własne „wyciszony do”). */
export const COOLDOWN_DAYS = 30;
/** Statusy grania, przy których nie piszę do komika o kolejny termin. */
export const ACTIVE_GIG: readonly string[] = ["interested", "contacted", "waiting", "confirmed"];

export type MatchedContact = Pick<Contact, "id" | "name" | "relation" | "ignoreInReport" | "snoozeUntil"> & {
  lastPlayedTogether: string | null;
  /** Do kiedy wyciszony w Okazjach (data), null = widoczny. */
  mutedUntil: string | null;
  muteReason: MuteReason | null;
};

/** manual = sam wyciszyłem, gig = mamy granie w toku, played = niedawno graliśmy. */
export type MuteReason = "manual" | "gig" | "played";

export type Tab = "friends" | "inRange" | "openMic" | "unknownCity" | "muted";

export type Opportunity = {
  event: EventRow;
  city: City | null;
  inRange: boolean;
  matches: MatchedContact[];
  isNew: boolean;
  isOpenMic: boolean;
  /** Moje granie tego dnia z tym headlinerem albo w tym mieście (dodane ręcznie lub wcześniej z Okazji). */
  myGigId: number | null;
  /** Kto występuje: kontakt z CRM albo nazwa wyciągnięta z tytułu. Klucz grupuje terminy jednego komika. */
  performer: { key: string; name: string; contactId: number | null };
  tab: Tab;
  /** Tylko w wyszukiwarce: czemu wydarzenie normalnie nie trafia do Okazji (np. „poza zasięgiem”). */
  note: string | null;
};

/** Wszystkie terminy jednego komika w danej zakładce: najbliższy w zasięgu + reszta jako alternatywy. */
export type OpportunityGroup = {
  performer: Opportunity["performer"];
  primary: Opportunity;
  others: Opportunity[];
  matches: MatchedContact[];
  isNew: boolean;
};

export const dedupeKey = (title: string, startsAt: string, venue: string | null) =>
  [normalize(title), startsAt.slice(0, 10), normalize(venue ?? "")].join("|");

export const isOpenMic = (title: string) => /open[\s-]?mi[ck]|\bom\b/.test(normalize(title));

const addDays = (date: string, days: number) =>
  new Date(Date.parse(date.slice(0, 10)) + days * 864e5).toISOString().slice(0, 10);

type MuteInput = {
  snoozeUntil: string | null;
  lastPlayedTogether: string | null;
  nextGig: string | null;
  nextGigCreatedAt: string | null;
};

/**
 * Czy (i do kiedy) komik jest wyciszony w Okazjach:
 * 1. ręcznie („Wycisz na miesiąc”) — snoozeUntil w przyszłości,
 * 2. mamy granie w toku (od „zainteresowany” do „potwierdzone”) — do dnia tego grania,
 * 3. niedawno graliśmy — COOLDOWN_DAYS po wspólnym wieczorze.
 * snoozeUntil w przeszłości = „Pokaż teraz”: znosi 2. i 3., ale tylko jeśli powód powstał przed kliknięciem.
 */
export function muteState(c: MuteInput, today: string): { until: string; reason: MuteReason } | null {
  if (c.snoozeUntil && c.snoozeUntil > today) return { until: c.snoozeUntil, reason: "manual" };
  const shownSince = c.snoozeUntil; // dzień przed kliknięciem „Pokaż teraz”
  if (c.nextGig && !(shownSince && c.nextGigCreatedAt && shownSince >= c.nextGigCreatedAt.slice(0, 10))) {
    return { until: c.nextGig.slice(0, 10), reason: "gig" };
  }
  if (c.lastPlayedTogether) {
    const until = addDays(c.lastPlayedTogether, COOLDOWN_DAYS);
    const overridden = shownSince && shownSince >= c.lastPlayedTogether.slice(0, 10);
    if (until > today && !overridden) return { until, reason: "played" };
  }
  return null;
}

/** Najbliższe granie w toku z tym kontaktem (jako headliner albo w lineupie). */
const nextGigSql = (column: string) =>
  sql.raw(`select ${column} from gigs g
    where g.status in (${ACTIVE_GIG.map((s) => `'${s}'`).join(", ")}) and g.starts_at >= date('now')
      and (g.headliner_id = contacts.id
        or exists (select 1 from gig_contacts gc where gc.gig_id = g.id and gc.contact_id = contacts.id))
    order by g.starts_at limit 1`);

async function loadContext() {
  const now = nowLocal();
  const today = now.slice(0, 10);
  const [allCities, people, never, hidden, myGigs] = await Promise.all([
    db.select().from(cities),
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        aliases: contacts.aliases,
        relation: contacts.relation,
        ignoreInReport: contacts.ignoreInReport,
        snoozeUntil: contacts.snoozeUntil,
        lastPlayedTogether: sql<string | null>`(
          select max(g.starts_at) from gigs g
          where g.status = 'confirmed' and g.starts_at < ${now}
            and (g.headliner_id = contacts.id
              or exists (select 1 from gig_contacts gc where gc.gig_id = g.id and gc.contact_id = contacts.id)))`,
        nextGig: sql<string | null>`(${nextGigSql("g.starts_at")})`,
        nextGigCreatedAt: sql<string | null>`(${nextGigSql("g.created_at")})`,
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
      .where(and(gte(gigs.startsAt, today), sql`${gigs.status} not in ('rejected', 'cancelled')`)),
  ]);
  return {
    citiesByName: new Map(allCities.map((c) => [normalize(c.name), c])),
    people: people.map((p) => {
      const m = muteState(p, today);
      return { ...p, mutedUntil: m?.until ?? null, muteReason: m?.reason ?? null };
    }),
    blacklist: new Set(never.map((v) => `${normalize(v.name)}|${normalize(v.cityName ?? "")}`)),
    hidden: new Set(hidden.map((h) => h.t)),
    myGigs,
  };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

/**
 * `force` (wyszukiwarka): zamiast odrzucać wydarzenie, zapisz powód w `note` i pokaż je mimo to.
 */
function classify(e: EventRow, ctx: Ctx, newSince: string, force = false): Opportunity | null {
  let note: string | null = null;
  const drop = (reason: string) => {
    note ??= reason;
    return !force;
  };
  if (e.dismissed && drop("ukryte")) return null;
  if (ctx.hidden.has(normalize(e.title)) && drop("program ukryty")) return null;
  if (!isWantedLanguage(`${e.title} ${e.performers ?? ""}`) && drop("inny język")) return null;
  if (ctx.blacklist.has(`${normalize(e.venueName ?? "")}|${normalize(e.cityName ?? "")}`) && drop("scena na czarnej liście")) {
    return null;
  }

  const all = matchContacts(`${e.title} ${e.performers ?? ""}`, ctx.people);
  let matches = all.filter((m) => !m.ignoreInReport);
  if (all.length && !matches.length) {
    if (drop("komik pomijany")) return null; // sami „pomijani” (nie interesuje / nie robi open miców)
    matches = all;
  }

  const city = e.cityName ? (ctx.citiesByName.get(normalize(e.cityName)) ?? null) : null;
  const known = !!city && city.travelMinutes != null;
  const inRange = !!city && (city.hasLodging || (city.travelMinutes != null && city.travelMinutes <= MAX_TRAVEL_MIN));
  const openMic = isOpenMic(e.title);

  let tab: Tab | null;
  if (matches.length) tab = matches.every((m) => m.mutedUntil) ? "muted" : "friends";
  else if (!known) tab = "unknownCity";
  else if (!inRange) tab = null;
  else tab = openMic ? "openMic" : "inRange";
  if (!tab) {
    if (drop("poza zasięgiem")) return null;
    tab = openMic ? "openMic" : "inRange";
  }

  const day = e.startsAt.slice(0, 10);
  const myGig = ctx.myGigs.find(
    (g) =>
      g.startsAt.slice(0, 10) === day &&
      (all.some((m) => m.id === g.headlinerId) || (!!g.cityName && normalize(g.cityName) === normalize(e.cityName ?? ""))),
  );
  const lead = matches.find((m) => !m.mutedUntil) ?? matches[0];
  return {
    event: e,
    city,
    inRange,
    matches,
    isNew: e.firstSeenAt >= newSince,
    isOpenMic: openMic,
    myGigId: e.gigId ?? myGig?.id ?? null,
    performer: lead
      ? { key: `c${lead.id}`, name: lead.name, contactId: lead.id }
      : { key: performerKey(e.title), name: performerName(e.title), contactId: null },
    tab,
    note,
  };
}

/** Tag pamięci podręcznej wydarzeń w aplikacji — unieważniany przy zmianie wydarzenia. */
export const EVENTS_TAG = "events";

export type EventRow = Pick<
  Event,
  | "id"
  | "url"
  | "title"
  | "startsAt"
  | "cityName"
  | "venueName"
  | "performers"
  | "firstSeenAt"
  | "dismissed"
  | "gigId"
  | "availability"
>;

/** Nadchodzące, nieukryte wydarzenia — tylko kolumny potrzebne w raporcie (mniej danych z bazy). */
export function loadUpcomingEvents(today: string): Promise<EventRow[]> {
  return db
    .select({
      id: events.id,
      url: events.url,
      title: events.title,
      startsAt: events.startsAt,
      cityName: events.cityName,
      venueName: events.venueName,
      performers: events.performers,
      firstSeenAt: events.firstSeenAt,
      dismissed: events.dismissed,
      gigId: events.gigId,
      availability: events.availability,
    })
    .from(events)
    .where(and(gte(events.startsAt, today), eq(events.dismissed, false)))
    .orderBy(events.startsAt);
}

/**
 * Nadchodzące okazje. `onlyIds` — tylko te wydarzenia (np. nowe z dzisiejszego przebiegu crona).
 * `loadEvents` — aplikacja podaje wersję z pamięci podręcznej; skrypt crona czyta bazę wprost.
 */
export async function getOpportunities(
  onlyIds?: Set<number>,
  loadEvents: (today: string) => Promise<EventRow[]> = loadUpcomingEvents,
) {
  const today = nowLocal().slice(0, 10);
  const [ctx, rows] = await Promise.all([loadContext(), loadEvents(today)]);
  // firstSeenAt jest w UTC (datetime('now')) — porównujemy w tym samym formacie.
  const newSince = new Date(Date.now() - NEW_FOR_DAYS * 864e5).toISOString().replace("T", " ").slice(0, 19);
  return rows
    .filter((e) => !onlyIds || onlyIds.has(e.id))
    .map((e) => classify(e, ctx, newSince))
    .filter((o): o is Opportunity => o !== null);
}

/**
 * Wyszukiwarka: wszystkie nadchodzące wydarzenia pasujące do frazy (tytuł, występujący, a jeśli fraza
 * to kontakt z CRM — także jego aliasy), łącznie z tymi, które Okazje normalnie odfiltrowują.
 */
export async function searchOpportunities(
  query: string,
  loadEvents: (today: string) => Promise<EventRow[]> = loadUpcomingEvents,
) {
  const today = nowLocal().slice(0, 10);
  const [ctx, rows] = await Promise.all([loadContext(), loadEvents(today)]);
  // „Modzelewski 14.10” = komik tego dnia; sama data = wszystko tego dnia.
  const { date, rest } = parseDateQuery(query, today);
  const q = normalize(rest).trim();
  if (!date && q.length < 2) return [];
  // Kontakty z CRM pasujące do frazy — ich aliasy też szukamy (np. pseudonim sceniczny).
  const people = q ? ctx.people.filter((p) => matchesQuery(rest, `${p.name} ${p.aliases ?? ""}`)) : [];
  const newSince = new Date(Date.now() - NEW_FOR_DAYS * 864e5).toISOString().replace("T", " ").slice(0, 19);
  return rows
    .filter((e) => {
      if (date && e.startsAt.slice(0, 10) !== date) return false;
      if (!q) return true;
      const who = `${e.title} ${e.performers ?? ""}`;
      const text = `${who} ${e.venueName ?? ""} ${e.cityName ?? ""}`;
      return normalize(text).includes(q) || matchesQuery(rest, text) || matchContacts(who, people).length > 0;
    })
    .map((e) => classify(e, ctx, newSince, true))
    .filter((o): o is Opportunity => o !== null);
}

/**
 * Jedna karta na komika zamiast wszystkich jego terminów.
 * Główny termin: najbliższy w zasięgu (albo po prostu najbliższy); reszta jako alternatywy.
 */
export function groupByPerformer(items: Opportunity[]): OpportunityGroup[] {
  const groups = new Map<string, Opportunity[]>();
  for (const o of items) groups.set(o.performer.key, [...(groups.get(o.performer.key) ?? []), o]);
  return [...groups.values()]
    .map((list) => {
      const primary = list.find((o) => o.myGigId) ?? list.find((o) => o.inRange) ?? list[0];
      return {
        performer: primary.performer,
        primary,
        others: list.filter((o) => o !== primary),
        matches: primary.matches,
        isNew: list.some((o) => o.isNew),
      };
    })
    .sort((a, b) => a.primary.event.startsAt.localeCompare(b.primary.event.startsAt));
}
