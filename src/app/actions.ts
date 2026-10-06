"use server";

import { desc, eq, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { matchContacts } from "@/lib/match";
import { EVENTS_TAG, isOpenMic } from "@/lib/opportunities";
import { normalize } from "@/lib/text";
import { nowLocal } from "@/lib/time";
import {
  BIT_STATUSES,
  bits,
  cities,
  CONTACT_RELATIONS,
  contacts,
  db,
  events,
  GIG_CONTEXTS,
  GIG_STATUSES,
  gigBits,
  gigContacts,
  gigLogs,
  gigs,
  goals,
  IGNORE_REASONS,
  interactions,
  VENUE_VERDICTS,
  venues,
  type GigOutcome,
  type GigStatus,
  type VenueVerdict,
} from "@/db";

// Uwierzytelnianie robi proxy.ts (basic auth na każdym requeście, także POST akcji).

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const ids = (fd: FormData, k: string) =>
  fd.getAll(k).map(Number).filter((n) => Number.isInteger(n) && n > 0);
function oneOf<T extends string>(values: readonly T[], v: string | null): T | null {
  return v && (values as readonly string[]).includes(v) ? (v as T) : null;
}
const clamp = (n: number) => Math.min(5, Math.max(1, n));
function required<T>(v: T | null, field: string): T {
  if (v == null) throw new Error(`Brak pola: ${field}`);
  return v;
}

/**
 * Po mutacji z przejściem na inną stronę. Wszystkie strony są dynamiczne, więc docelowa
 * renderuje się ze świeżych danych — nie czyścimy całej pamięci routera (revalidatePath
 * na layoucie wywoływał lawinę ponownych prefetchy i spowalniał każde kliknięcie).
 */
function done(path: string): never {
  redirect(path);
}

// ── Grania ──────────────────────────────────────────────────────────────

export async function saveGig(fd: FormData) {
  const id = int(fd, "id");
  const values = {
    title: required(str(fd, "title"), "nazwa"),
    startsAt: required(str(fd, "startsAt"), "data"),
    venueId: int(fd, "venueId"),
    cityId: int(fd, "cityId"),
    status: oneOf(GIG_STATUSES, str(fd, "status")) ?? "interested",
    context: oneOf(GIG_CONTEXTS, str(fd, "context")),
    headlinerId: int(fd, "headlinerId"),
    url: str(fd, "url"),
    notes: str(fd, "notes"),
  };
  let gigId = id;
  if (gigId) {
    const [old] = await db.select({ status: gigs.status }).from(gigs).where(eq(gigs.id, gigId));
    const changed = old?.status !== values.status ? { statusChangedAt: nowLocal() } : {};
    await db.update(gigs).set({ ...values, ...changed }).where(eq(gigs.id, gigId));
  } else {
    [{ id: gigId }] = await db
      .insert(gigs)
      .values({ ...values, statusChangedAt: nowLocal() })
      .returning({ id: gigs.id });
  }
  const lineup = ids(fd, "lineup");
  await db.delete(gigContacts).where(eq(gigContacts.gigId, gigId));
  if (lineup.length) {
    await db.insert(gigContacts).values(lineup.map((contactId) => ({ gigId: gigId!, contactId })));
  }
  done(`/gigs/${gigId}`);
}

export async function setGigStatus(id: number, status: GigStatus) {
  // Powrót do pipeline'u (np. jednak rozmawiamy dalej) kasuje wcześniejszy wynik rozmowy.
  const reopened = (["interested", "contacted", "waiting"] as GigStatus[]).includes(status);
  await db
    .update(gigs)
    .set({ status, statusChangedAt: nowLocal(), ...(reopened ? { outcome: null } : {}) })
    .where(eq(gigs.id, id));
  refresh();
}

/**
 * Zapisuje wysłaną wiadomość w sprawie grania. Pierwsza wiadomość przesuwa granie
 * z „zainteresowany” na „napisałem”; kolejne (ponowienia) tylko odświeżają licznik ciszy.
 */
async function recordGigMessage(gigId: number, channel: string, contactId?: number | null) {
  const [gig] = await db
    .select({ title: gigs.title, status: gigs.status, headlinerId: gigs.headlinerId })
    .from(gigs)
    .where(eq(gigs.id, gigId));
  if (!gig) throw new Error("Nie ma takiego grania");
  await db.insert(interactions).values({
    contactId: contactId ?? gig.headlinerId,
    gigId,
    date: nowLocal().slice(0, 10),
    channel,
    topic: gig.title,
  });
  if (gig.status === "interested") {
    await db.update(gigs).set({ status: "contacted", statusChangedAt: nowLocal() }).where(eq(gigs.id, gigId));
  }
}

/** „Napisałem przez …” z karty grania (też ponowienie na innym kanale). */
export async function logGigMessage(gigId: number, fd: FormData) {
  await recordGigMessage(gigId, required(str(fd, "channel"), "kanał"));
  refresh();
}

/** Relacje, które odpowiedź komika może nadpisać (bez kasowania historii wspólnych grań). */
const SOFT_RELATIONS = ["none", "want_to_play", "no_reply", "agreed", "declined"];

/**
 * Jak się skończyło pytanie o granie, jednym tapem:
 * - agreed → granie potwierdzone, relacja „zgoda na granie”,
 * - declined → odrzucone, relacja „odmowa”,
 * - no_openers → odrzucone + komik pomijany w Okazjach z tym powodem,
 * - slot_taken → odrzucone, relacja bez zmian (to nie odmowa — inny termin może wyjść),
 * - ghosted → odrzucone, ostatnia wiadomość „bez odpowiedzi”, relacja „pisałem, brak odpowiedzi”,
 * - wait (bez wyniku) → odpisał, ale jeszcze nie wie: status „czekam”, przypomnienie dalej działa.
 */
export async function replyToGig(gigId: number, outcome: GigOutcome | "wait") {
  const [last] = await db
    .select({ id: interactions.id })
    .from(interactions)
    .where(eq(interactions.gigId, gigId))
    .orderBy(desc(interactions.date), desc(interactions.id))
    .limit(1);
  if (last) await db.update(interactions).set({ replied: outcome !== "ghosted" }).where(eq(interactions.id, last.id));

  const [gig] = await db.select({ headlinerId: gigs.headlinerId }).from(gigs).where(eq(gigs.id, gigId));
  await db
    .update(gigs)
    .set(
      outcome === "wait"
        ? { status: "waiting", statusChangedAt: nowLocal() }
        : { status: outcome === "agreed" ? "confirmed" : "rejected", outcome, statusChangedAt: nowLocal() },
    )
    .where(eq(gigs.id, gigId));

  const contactId = gig?.headlinerId;
  if (!contactId || outcome === "wait" || outcome === "slot_taken") return refresh();
  if (outcome === "no_openers") {
    await db.update(contacts).set({ ignoreInReport: true, ignoreReason: "no_openers" }).where(eq(contacts.id, contactId));
    return refresh();
  }
  const relation = outcome === "agreed" ? "agreed" : outcome === "declined" ? "declined" : "no_reply";
  const [c] = await db.select({ relation: contacts.relation }).from(contacts).where(eq(contacts.id, contactId));
  if (c && SOFT_RELATIONS.includes(c.relation)) {
    await db.update(contacts).set({ relation }).where(eq(contacts.id, contactId));
  }
  refresh();
}

export async function deleteGigMessage(id: number) {
  await db.delete(interactions).where(eq(interactions.id, id));
  refresh();
}

export async function deleteGig(id: number) {
  await db.delete(gigs).where(eq(gigs.id, id));
  done("/gigs");
}

export async function saveLog(fd: FormData) {
  const gigId = required(int(fd, "gigId"), "granie");
  const rating = required(int(fd, "rating"), "ocena");
  const venueRating = int(fd, "venueRating");
  const log = {
    rating: clamp(rating),
    venueRating: venueRating ? clamp(venueRating) : null,
    attendance: int(fd, "attendance"),
    minutesPlayed: int(fd, "minutesPlayed"),
    minutesAvailable: int(fd, "minutesAvailable"),
    thoughts: str(fd, "thoughts"),
  };
  await db
    .insert(gigLogs)
    .values({ gigId, ...log })
    .onConflictDoUpdate({ target: gigLogs.gigId, set: log });

  await db
    .update(gigs)
    .set({
      context: oneOf(GIG_CONTEXTS, str(fd, "context")),
      headlinerId: int(fd, "headlinerId"),
    })
    .where(eq(gigs.id, gigId));

  const played = ids(fd, "bits");
  await db.delete(gigBits).where(eq(gigBits.gigId, gigId));
  if (played.length) {
    await db.insert(gigBits).values(
      played.map((bitId) => {
        const r = int(fd, `reaction-${bitId}`);
        return { gigId, bitId, reaction: r === 1 || r === 0 || r === -1 ? r : null };
      }),
    );
  }
  done(str(fd, "returnTo") ?? `/gigs/${gigId}`);
}

/** Ucieczka z bramki oceny, gdy granie się nie odbyło. */
export async function markGigCancelled(id: number) {
  await setGigStatus(id, "cancelled");
}

// ── Kontakty ────────────────────────────────────────────────────────────

export async function saveContact(fd: FormData) {
  const id = int(fd, "id");
  const values = {
    name: required(str(fd, "name"), "imię i nazwisko"),
    aliases: str(fd, "aliases"),
    role: oneOf(["comedian", "organizer", "venue"] as const, str(fd, "role")) ?? "comedian",
    contactInfo: str(fd, "contactInfo"),
    relation:
oneOf(CONTACT_RELATIONS, str(fd, "relation")) ?? "none",
    ignoreInReport: bool(fd, "ignoreInReport"),
    ignoreReason: bool(fd, "ignoreInReport") ? oneOf(IGNORE_REASONS, str(fd, "ignoreReason")) : null,
    notes: str(fd, "notes"),
  };
  if (id) {
    await db.update(contacts).set(values).where(eq(contacts.id, id));
    done(`/contacts/${id}`);
  }
  const [row] = await db.insert(contacts).values(values).returning({ id: contacts.id });
  done(`/contacts/${row.id}`);
}

export async function deleteContact(id: number) {
  await db.delete(contacts).where(eq(contacts.id, id));
  done("/contacts");
}

export async function addInteraction(fd: FormData) {
  const contactId = required(int(fd, "contactId"), "kontakt");
  const replied = str(fd, "replied");
  await db.insert(interactions).values({
    contactId,
    date: required(str(fd, "date"), "data"),
    channel: str(fd, "channel") ?? "inne",
    topic: str(fd, "topic"),
    replied: replied === "yes" ? true : replied === "no" ? false : null,
  });
  // „Pisałem, brak odpowiedzi” ustawiamy automatycznie, jeśli kontakt nie miał relacji.
  if (replied === "no") {
    const [c] = await db.select({ relation: contacts.relation }).from(contacts).where(eq(contacts.id, contactId));
    if (c?.relation === "none" || c?.relation === "want_to_play") {
      await db.update(contacts).set({ relation: "no_reply" }).where(eq(contacts.id, contactId));
    }
  }
  done(`/contacts/${contactId}`);
}

export async function deleteInteraction(id: number, contactId: number) {
  await db.delete(interactions).where(eq(interactions.id, id));
  done(`/contacts/${contactId}`);
}

// ── Sceny ───────────────────────────────────────────────────────────────

export async function saveVenue(fd: FormData) {
  const id = int(fd, "id");
  const values = {
    name: required(str(fd, "name"), "nazwa"),
    cityId: int(fd, "cityId"),
    recurrence: str(fd, "recurrence"),
    organizerId: int(fd, "organizerId"),
    travelMinutes: int(fd, "travelMinutes"),
    hasLodging: bool(fd, "hasLodging"),
    verdict: oneOf(VENUE_VERDICTS, str(fd, "verdict")),
    verdictNote: str(fd, "verdictNote"),
    notes: str(fd, "notes"),
  };
  if (id) {
    await db.update(venues).set(values).where(eq(venues.id, id));
    done(`/venues/${id}`);
  }
  const [row] = await db.insert(venues).values(values).returning({ id: venues.id });
  done(`/venues/${row.id}`);
}

/** Szybka ocena z listy scen — bez wchodzenia w edycję. */
export async function setVenueVerdict(id: number, verdict: VenueVerdict | null) {
  await db.update(venues).set({ verdict }).where(eq(venues.id, id));
  refresh();
}

export async function deleteVenue(id: number) {
  await db.delete(venues).where(eq(venues.id, id));
  done("/venues");
}

// ── Materiał ────────────────────────────────────────────────────────────

export async function saveBit(fd: FormData) {
  const id = int(fd, "id");
  const values = {
    name: required(str(fd, "name"), "nazwa"),
    status: oneOf(BIT_STATUSES, str(fd, "status")) ?? "testing",
    lengthMin: int(fd, "lengthMin"),
    notes: str(fd, "notes"),
  };
  if (id) {
    await db.update(bits).set(values).where(eq(bits.id, id));
    done(`/bits/${id}`);
  }
  const [row] = await db.insert(bits).values(values).returning({ id: bits.id });
  done(`/bits/${row.id}`);
}

export async function deleteBit(id: number) {
  await db.delete(bits).where(eq(bits.id, id));
  done("/bits");
}

// ── Miasta ──────────────────────────────────────────────────────────────

export async function saveCity(fd: FormData) {
  const id = int(fd, "id");
  const values = {
    name: required(str(fd, "name"), "nazwa"),
    travelMinutes: int(fd, "travelMinutes"),
    hasLodging: bool(fd, "hasLodging"),
    priority: int(fd, "priority") ?? 3,
    notes: str(fd, "notes"),
  };
  if (id) await db.update(cities).set(values).where(eq(cities.id, id));
  else await db.insert(cities).values(values);
  done("/cities");
}

export async function deleteCity(id: number) {
  await db.delete(cities).where(eq(cities.id, id));
  done("/cities");
}

// ── Okazje (scraper) ────────────────────────────────────────────────────

export async function dismissEvent(id: number) {
  await db.update(events).set({ dismissed: true }).where(eq(events.id, id));
  updateTag(EVENTS_TAG);
  refresh();
}

/** Kontakt dla komika z Okazji: istniejący (dopasowany po nazwisku/aliasach) albo nowy. */
async function performerContactId(name: string) {
  const people = await db.select({ id: contacts.id, name: contacts.name, aliases: contacts.aliases }).from(contacts);
  const found = matchContacts(name, people)[0];
  if (found) return found.id;
  const [row] = await db.insert(contacts).values({ name, role: "comedian" }).returning({ id: contacts.id });
  return row.id;
}

/** „Ukryj komika” — nie pokazuj go w Okazjach, z powodem zapisanym w CRM. */
export async function hidePerformer(fd: FormData) {
  const name = required(str(fd, "name"), "komik");
  const id = int(fd, "contactId") ?? (await performerContactId(name));
  await db
    .update(contacts)
    .set({ ignoreInReport: true, ignoreReason: oneOf(IGNORE_REASONS, str(fd, "reason")) ?? "not_interested" })
    .where(eq(contacts.id, id));
  refresh();
}

/** Wycisz komika w Okazjach na `days` dni (np. właśnie do niego napisałem). */
export async function snoozePerformer(fd: FormData) {
  const name = required(str(fd, "name"), "komik");
  const id = int(fd, "contactId") ?? (await performerContactId(name));
  await setContactSnooze(id, isoDate(int(fd, "days") ?? 30));
}

/** `until` = data, do której wyciszony; data w przeszłości = „pokazuj już teraz”; null = automatycznie. */
export async function setContactSnooze(id: number, until: string | null) {
  await db.update(contacts).set({ snoozeUntil: until }).where(eq(contacts.id, id));
  refresh();
}

/** Wycisz kontakt w Okazjach na `days` dni (z karty kontaktu). */
export async function snoozeContact(id: number, days: number) {
  await setContactSnooze(id, isoDate(days));
}

/** Przestań pomijać komika w Okazjach. */
export async function unhideContact(id: number) {
  await db.update(contacts).set({ ignoreInReport: false, ignoreReason: null }).where(eq(contacts.id, id));
  refresh();
}

/** „Pokaż teraz” — znosi wyciszenie, także automatyczne po wspólnym wieczorze. */
export async function unsnoozeContact(id: number) {
  await setContactSnooze(id, isoDate(-1));
}

const isoDate = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 864e5).toISOString().slice(0, 10);

/** „Chcę zagrać” — zakłada granie w pipeline (status: zainteresowany) i podpina wydarzenie. */
export async function eventToGig(id: number) {
  const gigId = await gigFromEvent(id);
  updateTag(EVENTS_TAG);
  done(`/gigs/${gigId}`);
}

/**
 * „Wysłałem przez …” z Okazji: zakłada granie (albo bierze istniejące), zapisuje wiadomość
 * i zostawia mnie na liście, żeby od razu pisać do kolejnych.
 */
export async function messageFromEvent(fd: FormData) {
  const eventId = required(int(fd, "eventId"), "wydarzenie");
  const channel = required(str(fd, "channel"), "kanał");
  const gigId = int(fd, "gigId") ?? (await gigFromEvent(eventId));
  const name = str(fd, "name");
  const [gig] = await db.select({ headlinerId: gigs.headlinerId, context: gigs.context }).from(gigs).where(eq(gigs.id, gigId));
  // Piszę do komika spoza CRM — zakładam mu kontakt, żeby historia wiadomości miała gdzie trafić.
  let contactId = int(fd, "contactId") ?? gig?.headlinerId ?? null;
  if (!contactId && name && gig?.context !== "open_mic") contactId = await performerContactId(name);
  if (contactId && gig && !gig.headlinerId && gig.context !== "open_mic") {
    await db.update(gigs).set({ headlinerId: contactId }).where(eq(gigs.id, gigId));
  }
  await recordGigMessage(gigId, channel, contactId);
  updateTag(EVENTS_TAG);
  refresh();
}

async function gigFromEvent(id: number) {
  const [e] = await db.select().from(events).where(eq(events.id, id));
  if (!e) throw new Error("Nie ma takiego wydarzenia");
  if (e.gigId) return e.gigId;

  const allCities = await db.select({ id: cities.id, name: cities.name }).from(cities);
  const city = allCities.find((c) => normalize(c.name) === normalize(e.cityName ?? ""));
  const cityVenues = city ? await db.select({ id: venues.id, name: venues.name }).from(venues).where(eq(venues.cityId, city.id)) : [];
  const venue = cityVenues.find((v) => normalize(v.name) === normalize(e.venueName ?? ""));
  const people = await db
    .select({ id: contacts.id, name: contacts.name, aliases: contacts.aliases, ignoreInReport: contacts.ignoreInReport })
    .from(contacts);
  const headliner = matchContacts(`${e.title} ${e.performers ?? ""}`, people).find((c) => !c.ignoreInReport);
  const openMic = isOpenMic(e.title);

  const [gig] = await db
    .insert(gigs)
    .values({
      title: e.title,
      startsAt: e.startsAt,
      venueId: venue?.id ?? null,
      cityId: venue ? null : (city?.id ?? null),
      status: "interested",
      statusChangedAt: nowLocal(),
      context: openMic ? "open_mic" : "opener",
      headlinerId: openMic ? null : (headliner?.id ?? null),
      url: e.url,
      notes: venue ? null : [e.venueName, e.cityName].filter(Boolean).join(", ") || null,
    })
    .returning({ id: gigs.id });
  await db.update(events).set({ gigId: gig.id }).where(eq(events.id, id));
  return gig.id;
}

/** Szybkie przypisanie czasu dojazdu miastu z raportu („~2 h”, „dalej”). */
export async function setCityTravel(name: string, minutes: number) {
  await db
    .insert(cities)
    .values({ name, travelMinutes: minutes, notes: "szybka ocena z Okazji" })
    .onConflictDoUpdate({ target: cities.name, set: { travelMinutes: minutes } });
  refresh();
}

// ── Cele ────────────────────────────────────────────────────────────────

/** Cel liczby grań na miesiąc ("YYYY-MM"). */
export async function setMonthGoal(month: string, target: number) {
  const value = Math.max(1, Math.min(60, Math.round(target)));
  await db
    .insert(goals)
    .values({ key: `gigs:${month}`, target: value })
    .onConflictDoUpdate({ target: goals.key, set: { target: value, updatedAt: sql`(datetime('now'))` } });
  refresh();
}

export async function saveMonthGoal(fd: FormData) {
  await setMonthGoal(required(str(fd, "month"), "miesiąc"), required(int(fd, "target"), "cel"));
}

/** Cel materiału: ile minut do kiedy. */
export async function saveMaterialGoal(fd: FormData) {
  const target = Math.max(1, required(int(fd, "target"), "minuty"));
  const deadline = required(str(fd, "deadline"), "termin");
  await db
    .insert(goals)
    .values({ key: "material", target, deadline })
    .onConflictDoUpdate({ target: goals.key, set: { target, deadline, updatedAt: sql`(datetime('now'))` } });
  refresh();
}
