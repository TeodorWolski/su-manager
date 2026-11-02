"use server";

import { desc, eq, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { matchContacts } from "@/lib/match";
import { EVENTS_TAG, isOpenMic, MUTE_AFTER_OUTCOME_DAYS } from "@/lib/opportunities";
import { seriesKey } from "@/lib/recurring";
import { syncRecurring } from "@/lib/recurring-sync";
import { normalize } from "@/lib/text";
import { tripContext } from "@/lib/trip-ingest";
import { parseZl } from "@/lib/trips";
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
  RECURRENCE_INTERVALS,
  recurringSeries,
  supports,
  trips,
  WRITING_KINDS,
  writingSessions,
  ideas,
  pushSubscriptions,
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

/** Miasto po nazwie (bez polskich znaków i wielkości liter) albo nowe — z „Wpisz inne…” w formularzu. */
async function cityIdByName(name: string) {
  const all = await db.select({ id: cities.id, name: cities.name }).from(cities);
  const found = all.find((c) => normalize(c.name) === normalize(name));
  if (found) return found.id;
  const [row] = await db.insert(cities).values({ name }).returning({ id: cities.id });
  return row.id;
}

/** Scena po nazwie (w danym mieście, jeśli podane) albo nowa. */
async function venueIdByName(name: string, cityId: number | null) {
  const all = await db.select({ id: venues.id, name: venues.name, cityId: venues.cityId }).from(venues);
  const found = all.find((v) => normalize(v.name) === normalize(name) && (!cityId || !v.cityId || v.cityId === cityId));
  if (found) return found.id;
  const [row] = await db.insert(venues).values({ name, cityId }).returning({ id: venues.id });
  return row.id;
}

export async function saveGig(fd: FormData) {
  await requireSession();
  const id = int(fd, "id");
  // „Wpisz inne…”: nowe miasto / scena / komik — po nazwie istniejący albo nowy wpis w katalogu.
  const newCity = str(fd, "cityName");
  const cityId = newCity ? await cityIdByName(newCity) : int(fd, "cityId");
  const newVenue = str(fd, "venueName");
  const venueId = newVenue ? await venueIdByName(newVenue, cityId) : int(fd, "venueId");
  const newHeadliner = str(fd, "headlinerName");
  const headlinerId = newHeadliner ? await performerContactId(newHeadliner) : int(fd, "headlinerId");
  const values = {
    title: required(str(fd, "title"), "nazwa"),
    startsAt: required(str(fd, "startsAt"), "data"),
    venueId,
    // Nowa scena dostała miasto — granie nie potrzebuje go osobno (jak przy wyborze sceny z listy).
    cityId: newVenue ? null : cityId,
    status: oneOf(GIG_STATUSES, str(fd, "status")) ?? "interested",
    context: oneOf(GIG_CONTEXTS, str(fd, "context")),
    headlinerId,
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
  for (const name of (str(fd, "lineupNew") ?? "").split(",").map((n) => n.trim()).filter(Boolean)) {
    const contactId = await performerContactId(name);
    if (!lineup.includes(contactId)) lineup.push(contactId);
  }
  await db.delete(gigContacts).where(eq(gigContacts.gigId, gigId));
  if (lineup.length) {
    await db.insert(gigContacts).values(lineup.map((contactId) => ({ gigId: gigId!, contactId })));
  }
  done(`/gigs/${gigId}`);
}

export async function setGigStatus(id: number, status: GigStatus) {
  await requireSession();
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
  await requireSession();
  await recordGigMessage(gigId, required(str(fd, "channel"), "kanał"));
  refresh();
}

// ── Supporty ────────────────────────────────────────────────────────────

/** Para headliner → support: dopisuje albo odświeża („aktualny”, ostatnio potwierdzony dziś). */
async function touchSupport(headlinerId: number, supportId: number) {
  if (headlinerId === supportId) return;
  const values = { active: true, lastSeen: nowLocal().slice(0, 10) };
  await db
    .insert(supports)
    .values({ headlinerId, supportId, ...values })
    .onConflictDoUpdate({ target: [supports.headlinerId, supports.supportId], set: values });
}

/** Support z formularza: wybrany z listy (`supportId`) albo wpisany (`supportName` → kontakt, fuzzy jak w scraperze). */
async function supportFromForm(fd: FormData) {
  const name = str(fd, "supportName");
  return name ? performerContactId(name) : required(int(fd, "supportId"), "support");
}

/**
 * „Napisałem do supportu” przy graniu przed headlinerem: wiadomość idzie do supportu (on pyta headlinera),
 * granie dalej jest przed headlinerem, a para trafia do bazy supportów.
 */
export async function logSupportMessage(gigId: number, fd: FormData) {
  await requireSession();
  const [gig] = await db.select({ headlinerId: gigs.headlinerId }).from(gigs).where(eq(gigs.id, gigId));
  if (!gig?.headlinerId) throw new Error("Najpierw ustaw, przed kim jest granie");
  const supportId = await supportFromForm(fd);
  await touchSupport(gig.headlinerId, supportId);
  await recordGigMessage(gigId, required(str(fd, "channel"), "kanał"), supportId);
  refresh();
}

/** Ręcznie na karcie headlinera: „ten robi u niego support”. */
export async function addSupport(headlinerId: number, fd: FormData) {
  await requireSession();
  await touchSupport(headlinerId, await supportFromForm(fd));
  refresh();
}

/** Supporty się zmieniają — „już nie robi” zostawia historię, ale nie podpowiada go więcej. */
export async function setSupportActive(id: number, active: boolean) {
  await requireSession();
  await db.update(supports).set({ active }).where(eq(supports.id, id));
  refresh();
}

export async function deleteSupport(id: number) {
  await requireSession();
  await db.delete(supports).where(eq(supports.id, id));
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
  await requireSession();
  const [last] = await db
    .select({ id: interactions.id, contactId: interactions.contactId })
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
  // Pisałem przez supportu i to on milczy — headliner nic nie wie, więc go nie wyciszam ani nie zmieniam relacji.
  if (outcome === "ghosted" && last?.contactId && last.contactId !== contactId) return refresh();
  if (outcome === "no_openers") {
    await db.update(contacts).set({ ignoreInReport: true, ignoreReason: "no_openers" }).where(eq(contacts.id, contactId));
    return refresh();
  }
  const relation = outcome === "agreed" ? "agreed" : outcome === "declined" ? "declined" : "no_reply";
  const [c] = await db
    .select({ relation: contacts.relation, snoozeUntil: contacts.snoozeUntil })
    .from(contacts)
    .where(eq(contacts.id, contactId));
  if (c && SOFT_RELATIONS.includes(c.relation)) {
    await db.update(contacts).set({ relation }).where(eq(contacts.id, contactId));
  }
  // Odmowa / ghosting — chwilę nie pytam znowu (nie skracam dłuższego wyciszenia).
  if (c && (outcome === "declined" || outcome === "ghosted")) {
    const until = isoDate(MUTE_AFTER_OUTCOME_DAYS[outcome]);
    if (!c.snoozeUntil || c.snoozeUntil < until) {
      await db.update(contacts).set({ snoozeUntil: until }).where(eq(contacts.id, contactId));
    }
  }
  refresh();
}

export async function deleteGigMessage(id: number) {
  await requireSession();
  await db.delete(interactions).where(eq(interactions.id, id));
  refresh();
}

export async function deleteGig(id: number) {
  await requireSession();
  await db.delete(gigs).where(eq(gigs.id, id));
  done("/gigs");
}

export async function saveLog(fd: FormData) {
  await requireSession();
  const gigId = await writeLog(fd);
  done(str(fd, "returnTo") ?? `/gigs/${gigId}`);
}

/**
 * Log zapisany w telefonie bez zasięgu (log-form / offline.html) i wysłany, gdy sieć wróci.
 * Bez przekierowania — wysyła go w tle OfflineSync. Zapis jest idempotentny (upsert), więc
 * powtórka po zerwanym połączeniu nic nie psuje.
 */
export async function syncQueuedLog(fd: FormData) {
  await requireSession();
  await writeLog(fd);
  refresh();
  return true;
}

async function writeLog(fd: FormData) {
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

  const newHeadliner = str(fd, "headlinerName");
  await db
    .update(gigs)
    .set({
      context: oneOf(GIG_CONTEXTS, str(fd, "context")),
      headlinerId: newHeadliner ? await performerContactId(newHeadliner) : int(fd, "headlinerId"),
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
  return gigId;
}

/** Ucieczka z bramki oceny, gdy granie się nie odbyło. */
export async function markGigCancelled(id: number) {
  await requireSession();
  await setGigStatus(id, "cancelled");
}

// ── Kontakty ────────────────────────────────────────────────────────────

export async function saveContact(fd: FormData) {
  await requireSession();
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
  await requireSession();
  await db.delete(contacts).where(eq(contacts.id, id));
  done("/contacts");
}

export async function addInteraction(fd: FormData) {
  await requireSession();
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
  await requireSession();
  await db.delete(interactions).where(eq(interactions.id, id));
  done(`/contacts/${contactId}`);
}

// ── Sceny ───────────────────────────────────────────────────────────────

export async function saveVenue(fd: FormData) {
  await requireSession();
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
  await requireSession();
  await db.update(venues).set({ verdict }).where(eq(venues.id, id));
  refresh();
}

export async function deleteVenue(id: number) {
  await requireSession();
  await db.delete(venues).where(eq(venues.id, id));
  done("/venues");
}

// ── Materiał ────────────────────────────────────────────────────────────

export async function saveBit(fd: FormData) {
  await requireSession();
  const id = int(fd, "id");
  const values = {
    name: required(str(fd, "name"), "nazwa"),
    status: oneOf(BIT_STATUSES, str(fd, "status")) ?? "testing",
    lengthMin: int(fd, "lengthMin"),
    notes: str(fd, "notes"),
    docUrl: str(fd, "docUrl"),
  };
  if (id) {
    await db.update(bits).set(values).where(eq(bits.id, id));
    done(`/bits/${id}`);
  }
  const [row] = await db.insert(bits).values(values).returning({ id: bits.id });
  done(`/bits/${row.id}`);
}

/** „Gotowy do zaliczenia” → Sprawdzony jednym tapem (podpowiedź z MGM / karty bitu). */
export async function markBitTested(id: number) {
  await requireSession();
  await db.update(bits).set({ status: "tested" }).where(eq(bits.id, id));
  refresh();
}

export async function deleteBit(id: number) {
  await requireSession();
  await db.delete(bits).where(eq(bits.id, id));
  done("/bits");
}

/**
 * Sesja pisania jednym tapem: rodzaj (trening puent / generowanie / redakcja), opcjonalnie bit,
 * minuty i notka (np. premisa). Data = dziś (lokalnie).
 */
export async function logWriting(fd: FormData) {
  await requireSession();
  const kind = required(oneOf(WRITING_KINDS, str(fd, "kind")), "rodzaj");
  // Generowanie może od razu założyć nowy bit-draft („Wpisz inne…” → status Vomit).
  const newBit = str(fd, "newBitName");
  const bitId = newBit
    ? (await db.insert(bits).values({ name: newBit, status: "vomit" }).returning({ id: bits.id }))[0].id
    : int(fd, "bitId");
  // Redakcja zawsze dotyczy konkretnego bitu.
  if (kind === "edit" && !bitId) throw new Error("Wybierz bit, który redagowałeś");
  await db.insert(writingSessions).values({
    date: nowLocal().slice(0, 10),
    kind,
    minutes: int(fd, "minutes"),
    bitId,
    note: str(fd, "note"),
  });
  refresh();
}

// ── Powiadomienia ───────────────────────────────────────────────────────

/** Zapis urządzenia do powiadomień (subskrypcja Web Push z przeglądarki). */
export async function subscribePush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await requireSession();
  const values = { p256dh: sub.keys.p256dh, auth: sub.keys.auth };
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, ...values })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
}

/** Czy serwer zna to urządzenie — jeśli nie (martwa subskrypcja usunięta przy wysyłce), OfflineSync zapisze nową. */
export async function pushKnown(endpoint: string) {
  await requireSession();
  const [row] = await db.select({ e: pushSubscriptions.endpoint }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return !!row;
}

export async function unsubscribePush(endpoint: string) {
  await requireSession();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function sendTestPush() {
  await requireSession();
  const { sendPush } = await import("@/lib/push");
  const n = await sendPush({ title: "SU Manager 🎤", body: "Powiadomienia działają.", url: "/", tag: "test" });
  return n;
}

// ── Pomysły ─────────────────────────────────────────────────────────────

/** Pomysł na szybko — jedno pole, zapis jednym tapem. */
export async function addIdea(fd: FormData) {
  await requireSession();
  await db.insert(ideas).values({ text: required(str(fd, "text"), "pomysł") });
  refresh();
}

/** Pomysł → bit roboczy (Vomit): krótka nazwa z początku, cały tekst w notatkach. */
export async function ideaToBit(id: number) {
  await requireSession();
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!idea) throw new Error("Nie ma takiego pomysłu");
  const name = idea.text.length > 50 ? `${idea.text.slice(0, 47).trimEnd()}…` : idea.text;
  const [bit] = await db.insert(bits).values({ name, status: "vomit", notes: idea.text }).returning({ id: bits.id });
  await db.update(ideas).set({ status: "used", bitId: bit.id }).where(eq(ideas.id, id));
  done(`/bits/${bit.id}`);
}

/** Pomysł jako premisa dzisiejszego treningu puent — loguje trening. */
export async function ideaAsPremise(id: number) {
  await requireSession();
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!idea) throw new Error("Nie ma takiego pomysłu");
  await db.insert(writingSessions).values({ date: nowLocal().slice(0, 10), kind: "punchlines", note: idea.text });
  await db.update(ideas).set({ status: "used" }).where(eq(ideas.id, id));
  refresh();
}

export async function setIdeaStatus(id: number, status: "new" | "dropped") {
  await requireSession();
  await db.update(ideas).set({ status }).where(eq(ideas.id, id));
  refresh();
}

export async function deleteWriting(id: number) {
  await requireSession();
  await db.delete(writingSessions).where(eq(writingSessions.id, id));
  refresh();
}

// ── Miasta ──────────────────────────────────────────────────────────────

export async function saveCity(fd: FormData) {
  await requireSession();
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
  await requireSession();
  await db.delete(cities).where(eq(cities.id, id));
  done("/cities");
}

// ── Okazje (scraper) ────────────────────────────────────────────────────

export async function dismissEvent(id: number) {
  await requireSession();
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
  await requireSession();
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
  await requireSession();
  const name = required(str(fd, "name"), "komik");
  const id = int(fd, "contactId") ?? (await performerContactId(name));
  await setContactSnooze(id, isoDate(int(fd, "days") ?? 30));
}

/** `until` = data, do której wyciszony; data w przeszłości = „pokazuj już teraz”; null = automatycznie. */
export async function setContactSnooze(id: number, until: string | null) {
  await requireSession();
  await db.update(contacts).set({ snoozeUntil: until }).where(eq(contacts.id, id));
  refresh();
}

/** Wycisz kontakt w Okazjach na `days` dni (z karty kontaktu). */
export async function snoozeContact(id: number, days: number) {
  await requireSession();
  await setContactSnooze(id, isoDate(days));
}

/** Przestań pomijać komika w Okazjach. */
export async function unhideContact(id: number) {
  await requireSession();
  await db.update(contacts).set({ ignoreInReport: false, ignoreReason: null }).where(eq(contacts.id, id));
  refresh();
}

/** „Pokaż teraz” — znosi wyciszenie, także automatyczne po wspólnym wieczorze. */
export async function unsnoozeContact(id: number) {
  await requireSession();
  await setContactSnooze(id, isoDate(-1));
}

const isoDate = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 864e5).toISOString().slice(0, 10);

/** „Chcę zagrać” — zakłada granie w pipeline (status: zainteresowany) i podpina wydarzenie. */
export async function eventToGig(id: number) {
  await requireSession();
  const gigId = await gigFromEvent(id);
  updateTag(EVENTS_TAG);
  done(`/gigs/${gigId}`);
}

/**
 * „Wysłałem przez …” z Okazji: zakłada granie (albo bierze istniejące), zapisuje wiadomość
 * i zostawia mnie na liście, żeby od razu pisać do kolejnych.
 */
export async function messageFromEvent(fd: FormData) {
  await requireSession();
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
  // Przez supportu: wiadomość do niego, granie dalej przed headlinerem.
  const supportId = int(fd, "supportId");
  if (supportId && contactId) await touchSupport(contactId, supportId);
  await recordGigMessage(gigId, channel, supportId ?? contactId);
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

/**
 * „Cykliczne?” przy wydarzeniu: co tydzień / co 2 / co 4 tygodnie / co miesiąc („manual”),
 * „off” = to nie jest cykliczne (wyłącza też wykrywanie), „auto” = zdaj się na wykrywanie.
 * Od razu przelicza przewidywane terminy.
 */
export async function markRecurring(eventId: number, choice: string) {
  await requireSession();
  const [e] = await db.select().from(events).where(eq(events.id, eventId));
  if (!e) throw new Error("Nie ma takiego wydarzenia");
  const key = seriesKey(e);
  if (choice === "auto") {
    await db.delete(recurringSeries).where(eq(recurringSeries.key, key));
  } else {
    const interval = oneOf(RECURRENCE_INTERVALS, choice);
    if (!interval && choice !== "off") throw new Error("Nieznany rytm");
    const values = {
      mode: interval ? ("manual" as const) : ("off" as const),
      interval,
      title: e.title,
      cityName: e.cityName,
      venueName: e.venueName,
      url: e.url || null,
      anchor: e.startsAt,
    };
    await db
      .insert(recurringSeries)
      .values({ key, ...values })
      .onConflictDoUpdate({ target: recurringSeries.key, set: values });
  }
  await syncRecurring();
  updateTag(EVENTS_TAG);
  refresh();
}

/** Wyłącz / przywróć serię z ekranu „Cykliczne” (po kluczu, bez wydarzenia pod ręką). */
export async function setSeriesMode(key: string, mode: "off" | "auto", title: string) {
  await requireSession();
  if (mode === "auto") await db.delete(recurringSeries).where(eq(recurringSeries.key, key));
  else {
    await db
      .insert(recurringSeries)
      .values({ key, mode: "off", interval: null, title })
      .onConflictDoUpdate({ target: recurringSeries.key, set: { mode: "off", interval: null } });
  }
  await syncRecurring();
  updateTag(EVENTS_TAG);
  refresh();
}

/** Szybkie przypisanie czasu dojazdu miastu z raportu („~2 h”, „dalej”). */
export async function setCityTravel(name: string, minutes: number) {
  await requireSession();
  await db
    .insert(cities)
    .values({ name, travelMinutes: minutes, notes: "szybka ocena z Okazji" })
    .onConflictDoUpdate({ target: cities.name, set: { travelMinutes: minutes } });
  refresh();
}

// ── Cele ────────────────────────────────────────────────────────────────

/** Cel liczby grań na miesiąc ("YYYY-MM"). */
export async function setMonthGoal(month: string, target: number) {
  await requireSession();
  const value = Math.max(1, Math.min(60, Math.round(target)));
  await db
    .insert(goals)
    .values({ key: `gigs:${month}`, target: value })
    .onConflictDoUpdate({ target: goals.key, set: { target: value, updatedAt: sql`(datetime('now'))` } });
  refresh();
}

export async function saveMonthGoal(fd: FormData) {
  await requireSession();
  await setMonthGoal(required(str(fd, "month"), "miesiąc"), required(int(fd, "target"), "cel"));
}

/** MGM: cel minut nowego materiału na miesiąc ("YYYY-MM"). */
export async function setMgmGoal(month: string, target: number) {
  await requireSession();
  const value = Math.max(1, Math.min(120, Math.round(target)));
  await db
    .insert(goals)
    .values({ key: `mgm:${month}`, target: value })
    .onConflictDoUpdate({ target: goals.key, set: { target: value, updatedAt: sql`(datetime('now'))` } });
  refresh();
}

export async function saveMgmGoal(fd: FormData) {
  await requireSession();
  await setMgmGoal(required(str(fd, "month"), "miesiąc"), required(int(fd, "target"), "cel"));
}

// ── Podróże ─────────────────────────────────────────────────────────────

/**
 * Do ekranu importu biletu (/trips/import — strona bez logowania, dane tylko w przeglądarce):
 * grania ±3 dni od podróży do wyboru, podpowiedziane granie i czy ten bilet już jest.
 */
export async function tripImportContext(trip: { fromStation: string; toStation: string; departsAt: string; arrivesAt: string | null; reference: string | null }) {
  await requireSession();
  return tripContext(trip);
}

/** Zapis podróży z ekranu importu (albo ręcznie). Ten sam numer referencyjny = aktualizacja, nie duplikat. */
export async function saveTrip(fd: FormData) {
  await requireSession();
  const values = {
    gigId: int(fd, "gigId"),
    carrier: str(fd, "carrier"),
    train: str(fd, "train"),
    fromStation: required(str(fd, "fromStation"), "skąd"),
    toStation: required(str(fd, "toStation"), "dokąd"),
    departsAt: required(str(fd, "departsAt"), "odjazd"),
    arrivesAt: str(fd, "arrivesAt"),
    priceGr: parseZl(str(fd, "price")),
    seat: str(fd, "seat"),
    reference: str(fd, "reference"),
    url: str(fd, "url"),
    notes: str(fd, "notes"),
  };
  const [row] = await db
    .insert(trips)
    .values(values)
    .onConflictDoUpdate({ target: trips.reference, set: values })
    .returning({ id: trips.id });
  done(values.gigId ? `/gigs/${values.gigId}` : `/trips?saved=${row.id}`);
}

export async function setTripGig(id: number, gigId: number | null) {
  await requireSession();
  await db.update(trips).set({ gigId }).where(eq(trips.id, id));
  refresh();
}

export async function deleteTrip(id: number) {
  await requireSession();
  await db.delete(trips).where(eq(trips.id, id));
  refresh();
}

/** Honorarium za granie (karta grania → „Pieniądze”); puste pole kasuje kwotę. */
export async function setGigFee(gigId: number, fd: FormData) {
  await requireSession();
  await db.update(gigs).set({ feeGr: parseZl(str(fd, "fee")) }).where(eq(gigs.id, gigId));
  refresh();
}
