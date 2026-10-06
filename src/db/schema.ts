import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  uniqueIndex,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

/** Słownik miast z ręcznie wpisanym czasem dojazdu z Warszawy. */
export const cities = sqliteTable("cities", {
  id: id(),
  name: text("name").notNull().unique(),
  travelMinutes: integer("travel_minutes"),
  hasLodging: integer("has_lodging", { mode: "boolean" }).notNull().default(false),
  /** 1 = Warszawa, 2 = miasta z noclegiem, 3 = reszta w zasięgu. */
  priority: integer("priority").notNull().default(3),
  notes: text("notes"),
});

/**
 * Relacja z komikiem. Rozróżniamy, jak dzieliliśmy scenę:
 * opened_for = darmowy open mic przed headlinerem, supported = płatny support,
 * played_with = oboje headlinerami.
 */
export const CONTACT_RELATIONS = [
  "none",
  "opened_for",
  "supported",
  "played_with",
  "want_to_play",
  "no_reply",
  "agreed",
  "declined",
] as const;

/** Dlaczego komik jest pomijany w Okazjach. */
export const IGNORE_REASONS = ["not_interested", "no_openers", "other"] as const;

export const contacts = sqliteTable("contacts", {
  id: id(),
  name: text("name").notNull(),
  /** Alternatywne zapisy nazwiska / pseudonimy, po przecinku — pomaga dopasowaniu ze scrapera. */
  aliases: text("aliases"),
  role: text("role", { enum: ["comedian", "organizer", "venue"] }).notNull(),
  contactInfo: text("contact_info"),
  relation: text("relation", { enum: CONTACT_RELATIONS })
    .notNull()
    .default("none"),
  /** Pomijaj w raporcie nowych grań (np. gwiazdy, które nie biorą supportów). */
  ignoreInReport: integer("ignore_in_report", { mode: "boolean" }).notNull().default(false),
  ignoreReason: text("ignore_reason", { enum: IGNORE_REASONS }),
  /**
   * Do kiedy nie pokazywać w Okazjach. Puste = automatycznie 90 dni po ostatnim wspólnym wieczorze.
   * Data w przeszłości = „pokazuj już teraz” mimo niedawnego wspólnego grania.
   */
  snoozeUntil: text("snooze_until"),
  notes: text("notes"),
  createdAt: createdAt(),
});

/**
 * Wiadomość / kontakt. Przy graniu (gigId) kontakt bywa pusty — np. open mic pisany do sceny.
 * Kanał to tekst (patrz CHANNELS w labels.ts), żeby stare wpisy dalej się wyświetlały.
 */
export const interactions = sqliteTable("interactions", {
  id: id(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  gigId: integer("gig_id").references(() => gigs.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  channel: text("channel").notNull(),
  topic: text("topic"),
  replied: integer("replied", { mode: "boolean" }),
  createdAt: createdAt(),
});

/** Ogólna ocena miejsca, 5 stopni od najgorszej. "never" = czarna lista. */
export const VENUE_VERDICTS = ["never", "weak", "meh", "good", "great"] as const;

export const venues = sqliteTable("venues", {
  id: id(),
  name: text("name").notNull(),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
  recurrence: text("recurrence"),
  organizerId: integer("organizer_id").references(() => contacts.id, { onDelete: "set null" }),
  /** Nadpisuje czas dojazdu miasta, gdy scena jest daleko od centrum. */
  travelMinutes: integer("travel_minutes"),
  hasLodging: integer("has_lodging", { mode: "boolean" }).notNull().default(false),
  /** Moja ocena miejsca; null = jeszcze nie oceniłem. "never" = czarna lista. */
  verdict: text("verdict", { enum: VENUE_VERDICTS }),
  verdictNote: text("blacklist_reason"),
  notes: text("notes"),
  createdAt: createdAt(),
});

/**
 * "editing" = do redakcji (wiem, że trzeba go przepisać). "rejected" = odrzucony —
 * nie liczy się do materiału i nie ma go do wyboru w logu.
 */
export const BIT_STATUSES = ["tested", "testing", "editing", "vomit", "rejected"] as const;

export const bits = sqliteTable("bits", {
  id: id(),
  name: text("name").notNull(),
  status: text("status", { enum: BIT_STATUSES }).notNull().default("testing"),
  lengthMin: integer("length_min"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const GIG_STATUSES = [
  "interested",
  "contacted",
  "waiting",
  "confirmed",
  "rejected",
  "cancelled",
] as const;

/**
 * Jak się skończyło pytanie o granie: zgoda, odmowa, nie robi open miców przed sobą,
 * ktoś zajął miejsce, zghostował (brak odpowiedzi).
 */
export const GIG_OUTCOMES = ["agreed", "declined", "no_openers", "slot_taken", "ghosted"] as const;

/** opener = darmowy slot przed headlinerem, support = płatny, headline = własny / co-headline. */
export const GIG_CONTEXTS = ["open_mic", "opener", "support", "headline", "other"] as const;

export const gigs = sqliteTable("gigs", {
  id: id(),
  title: text("title").notNull(),
  /** Lokalny czas występu, ISO bez strefy: "2026-10-14T20:00". */
  startsAt: text("starts_at").notNull(),
  venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
  status: text("status", { enum: GIG_STATUSES }).notNull().default("interested"),
  /** Lokalny czas ostatniej zmiany statusu — z niego (i z wiadomości) liczymy, kiedy ponowić. */
  statusChangedAt: text("status_changed_at"),
  /** Wynik rozmowy o granie (patrz GIG_OUTCOMES); null = jeszcze w toku / nie pytałem. */
  outcome: text("outcome", { enum: GIG_OUTCOMES }),
  context: text("context", { enum: GIG_CONTEXTS }),
  /** Przed kim gram (support) — kontakt z CRM. */
  headlinerId: integer("headliner_id").references(() => contacts.id, { onDelete: "set null" }),
  url: text("url"),
  notes: text("notes"),
  /** Granie wpisane wstecz (import historii) — nie wymuszaj formularza oceny. */
  skipReview: integer("skip_review", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** Kto jeszcze grał tego wieczoru — z tego wynika „grałem z X w czerwcu”. */
export const gigContacts = sqliteTable(
  "gig_contacts",
  {
    gigId: integer("gig_id")
      .notNull()
      .references(() => gigs.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.gigId, t.contactId] })],
);

export const gigLogs = sqliteTable("gig_logs", {
  gigId: integer("gig_id")
    .primaryKey()
    .references(() => gigs.id, { onDelete: "cascade" }),
  /** Jak mi poszło, 1–5. */
  rating: integer("rating").notNull(),
  /** Jak było w miejscu tego wieczoru (sala, publika, organizacja), 1–5. */
  venueRating: integer("venue_rating"),
  attendance: integer("attendance"),
  minutesPlayed: integer("minutes_played"),
  minutesAvailable: integer("minutes_available"),
  thoughts: text("thoughts"),
  createdAt: createdAt(),
});

export const gigBits = sqliteTable(
  "gig_bits",
  {
    gigId: integer("gig_id")
      .notNull()
      .references(() => gigs.id, { onDelete: "cascade" }),
    bitId: integer("bit_id")
      .notNull()
      .references(() => bits.id, { onDelete: "cascade" }),
    /** Jak poszedł bit tego wieczoru: 1 = siadł, 0 = tak sobie, -1 = nie siadł. */
    reaction: integer("reaction"),
  },
  (t) => [primaryKey({ columns: [t.gigId, t.bitId] })],
);

export const TICKET_AVAILABILITY = ["last", "sold_out"] as const;

/** Wydarzenia zebrane przez scraper z bileterii. */
export const events = sqliteTable(
  "events",
  {
    id: id(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    /** Lokalny czas Warszawy: "2026-10-14T20:00" albo sama data. */
    startsAt: text("starts_at").notNull(),
    cityName: text("city_name"),
    venueName: text("venue_name"),
    /** Występujący / organizator, jeśli serwis ich podaje — dodatkowy tekst do dopasowania. */
    performers: text("performers"),
    /** normalize(tytuł)|data|normalize(miejsce) — deduplikacja między serwisami. */
    dedupeKey: text("dedupe_key").notNull().unique(),
    firstSeenAt: createdAt(),
    lastSeenAt: text("last_seen_at").notNull(),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    /** Dostępność biletów wg bileterii: "last" = ostatnie bilety, "sold_out"; null = normalna / nieznana. */
    availability: text("availability", { enum: TICKET_AVAILABILITY }),
    gigId: integer("gig_id").references(() => gigs.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("events_source_id").on(t.source, t.sourceId)],
);

/** Programy wyciszone w raporcie („Ukryj ten program wszędzie”) — po znormalizowanym tytule. */
export const hiddenTitles = sqliteTable("hidden_titles", {
  normalizedTitle: text("normalized_title").primaryKey(),
  title: text("title").notNull(),
  createdAt: createdAt(),
});

/**
 * Cele. Klucze: "gigs:YYYY-MM" — liczba grań w miesiącu; "material" — minuty materiału do `deadline`.
 * Brak wiersza = wartość domyślna (patrz src/lib/goals.ts), więc nic nie jest na sztywno.
 */
export const goals = sqliteTable("goals", {
  key: text("key").primaryKey(),
  target: integer("target").notNull(),
  deadline: text("deadline"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type City = typeof cities.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Bit = typeof bits.$inferSelect;
export type Gig = typeof gigs.$inferSelect;
export type GigLog = typeof gigLogs.$inferSelect;
export type Event = typeof events.$inferSelect;
export type GigStatus = (typeof GIG_STATUSES)[number];
export type GigContext = (typeof GIG_CONTEXTS)[number];
export type GigOutcome = (typeof GIG_OUTCOMES)[number];
export type VenueVerdict = (typeof VENUE_VERDICTS)[number];
export type IgnoreReason = (typeof IGNORE_REASONS)[number];
