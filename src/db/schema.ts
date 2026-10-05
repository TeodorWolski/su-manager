import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
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
  notes: text("notes"),
  createdAt: createdAt(),
});

export const interactions = sqliteTable("interactions", {
  id: id(),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  channel: text("channel").notNull(),
  topic: text("topic"),
  replied: integer("replied", { mode: "boolean" }),
  createdAt: createdAt(),
});

export const VENUE_VERDICTS = ["good", "meh", "never"] as const;

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

export const bits = sqliteTable("bits", {
  id: id(),
  name: text("name").notNull(),
  status: text("status", { enum: ["tested", "testing", "vomit"] }).notNull().default("testing"),
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
  },
  (t) => [primaryKey({ columns: [t.gigId, t.bitId] })],
);

export type City = typeof cities.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Bit = typeof bits.$inferSelect;
export type Gig = typeof gigs.$inferSelect;
export type GigLog = typeof gigLogs.$inferSelect;
export type GigStatus = (typeof GIG_STATUSES)[number];
export type GigContext = (typeof GIG_CONTEXTS)[number];
export type VenueVerdict = (typeof VENUE_VERDICTS)[number];
