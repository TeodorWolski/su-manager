/**
 * Planowanie: „Do ponowienia”, rytm tygodni i najgorętsze okazje. Bez `server-only` i bez
 * pamięci podręcznej Next — używa tego i ekran Dziś (queries.ts), i codzienny mail (scripts/scrape.ts).
 */
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { bits, cities, contacts, db, gigBits, gigLogs, gigs, goals, ideas, venues, writingSessions } from "@/db";
import { daysSince, followUpTiming, lastActivity, nextChannel } from "./follow-up";
import { hotOpportunities, type HotCandidate } from "./hot";
import { getOpportunities, loadUpcomingEvents, type EventRow } from "./opportunities";
import { getInsights, type RhythmOpportunity } from "./rhythm";
import { loadLeadTimes } from "./lead-data";
import { readyBits } from "./bit-ready";
import { computeMgm } from "./mgm";
import { weekStart } from "./rhythm";
import { addDays, nowLocal } from "./time";
import { countInWeek, dayStreak, editQueue, fixedBits, WEEKLY_TARGET, weekDots, weekStreak, type BitReaction } from "./writing";

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
        due: followUpTiming(g.startsAt, since, today, g.status).due,
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
  const from = addDays(today, -35);
  const [rows, opportunities, leads] = await Promise.all([
    db
      .select({ id: gigs.id, title: gigs.title, startsAt: gigs.startsAt, status: gigs.status, context: gigs.context })
      .from(gigs)
      .where(and(gte(gigs.startsAt, from), inArray(gigs.status, ["confirmed", "interested", "contacted", "waiting"]))),
    getOpportunities(undefined, loadEvents),
    loadLeadTimes(),
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
    lead: leads.leadFor(o.performer.contactId, o.isOpenMic ? "open_mic" : "opener"),
  }));
  return { ...getInsights(rows, ideas, today), hot: hotOpportunities(rows, candidates, today) };
}

export type Rhythm = Awaited<ReturnType<typeof getPlanning>>;

/** Pisanie: seria treningu puent, tydzień generowania / redakcji, kolejka „do poprawki” po scenie. */
export async function getWriting() {
  const today = nowLocal().slice(0, 10);
  const since = addDays(today, -180);
  const [sessions, reactions, bitList] = await Promise.all([
    db
      .select({ id: writingSessions.id, date: writingSessions.date, kind: writingSessions.kind, bitId: writingSessions.bitId, minutes: writingSessions.minutes, note: writingSessions.note })
      .from(writingSessions)
      .where(gte(writingSessions.date, since)),
    // Reakcje na bity z zalogowanych grań (bez odrzuconych bitów).
    db
      .select({ bitId: bits.id, name: bits.name, docUrl: bits.docUrl, gigDate: gigs.startsAt, reaction: gigBits.reaction })
      .from(gigBits)
      .innerJoin(bits, eq(bits.id, gigBits.bitId))
      .innerJoin(gigs, eq(gigs.id, gigBits.gigId))
      .innerJoin(gigLogs, eq(gigLogs.gigId, gigs.id))
      .where(and(sql`${gigBits.reaction} is not null`, sql`${bits.status} <> 'rejected'`)),
    db
      .select({ id: bits.id, name: bits.name, status: bits.status, docUrl: bits.docUrl })
      .from(bits)
      .where(sql`${bits.status} <> 'rejected'`)
      .orderBy(bits.name),
  ]);
  const punchDays = new Set(sessions.filter((s) => s.kind === "punchlines").map((s) => s.date));
  const queue = editQueue(reactions as BitReaction[], sessions);
  const week = weekStart(today);
  return {
    today,
    punchlines: { ...dayStreak(punchDays, today), dots: weekDots(punchDays, today) },
    generate: { done: countInWeek(sessions, "generate", week), target: WEEKLY_TARGET.generate, streak: weekStreak(sessions, "generate", today) },
    edit: { done: countInWeek(sessions, "edit", week), target: WEEKLY_TARGET.edit, streak: weekStreak(sessions, "edit", today) },
    queue,
    fixed: fixedBits(reactions as BitReaction[], sessions),
    todaySessions: sessions.filter((s) => s.date === today),
    /** Bity do wyboru przy sesji: najpierw kolejka do poprawki, potem do redakcji, w testach, drafty, sprawdzone. */
    bitOptions: (() => {
      const queued = new Set(queue.map((q) => q.bitId));
      const rank = { editing: 1, testing: 2, vomit: 3, tested: 4 } as Record<string, number>;
      return [...bitList].sort(
        (a, b) => Number(queued.has(b.id)) - Number(queued.has(a.id)) || (rank[a.status] ?? 9) - (rank[b.status] ?? 9),
      );
    })(),
  };
}

export type Writing = Awaited<ReturnType<typeof getWriting>>;

/**
 * Pisanie w danym okresie — do niedzielnego podsumowania: premisy z treningów, nowe pomysły,
 * bity, nad którymi pracowałem, i kolejka do poprawki z notatką z ostatniego grania.
 */
export async function getWritingDigest(from: string, to: string) {
  const [sessions, newIdeas, openIdeas, w, lastThoughts, mgm] = await Promise.all([
    db
      .select({ date: writingSessions.date, kind: writingSessions.kind, note: writingSessions.note, bitId: writingSessions.bitId, bitName: bits.name })
      .from(writingSessions)
      .leftJoin(bits, eq(bits.id, writingSessions.bitId))
      .where(and(gte(writingSessions.date, from), sql`${writingSessions.date} <= ${to}`))
      .orderBy(asc(writingSessions.date), asc(writingSessions.id)),
    db
      .select({ text: ideas.text })
      .from(ideas)
      .where(and(eq(ideas.status, "new"), gte(ideas.createdAt, from), sql`substr(${ideas.createdAt}, 1, 10) <= ${to}`)),
    db.select({ n: sql<number>`count(*)` }).from(ideas).where(eq(ideas.status, "new")),
    getWriting(),
    // Notatka po ostatnim graniu z danym bitem — kontekst do redakcji.
    db
      .select({ bitId: gigBits.bitId, startsAt: gigs.startsAt, thoughts: gigLogs.thoughts, venue: venues.name })
      .from(gigBits)
      .innerJoin(gigs, eq(gigs.id, gigBits.gigId))
      .innerJoin(gigLogs, eq(gigLogs.gigId, gigs.id))
      .leftJoin(venues, eq(venues.id, gigs.venueId))
      .orderBy(asc(gigs.startsAt)),
    getMgm(),
  ]);
  const days = new Set(sessions.filter((s) => s.kind === "punchlines").map((s) => s.date)).size;
  const count = (k: string) => sessions.filter((s) => s.kind === k).length;
  // Bity, nad którymi pracowałem: nazwa → rodzaje sesji.
  const worked = new Map<string, Set<string>>();
  for (const s of sessions) if (s.bitName) worked.set(s.bitName, new Set([...(worked.get(s.bitName) ?? []), s.kind]));
  const lastByBit = new Map(lastThoughts.map((t) => [t.bitId, t])); // posortowane rosnąco → zostaje ostatnie
  return {
    punchDays: days,
    generate: count("generate"),
    edit: count("edit"),
    targets: { generate: w.generate.target, edit: w.edit.target },
    streak: w.punchlines.streak,
    best: w.punchlines.best,
    premises: sessions.filter((s) => s.kind === "punchlines" && s.note).map((s) => ({ date: s.date, note: s.note! })),
    newIdeas: newIdeas.map((i) => i.text),
    openIdeas: Number(openIdeas[0]?.n ?? 0),
    worked: [...worked.entries()].map(([name, kinds]) => ({ name, kinds: [...kinds] })),
    queue: w.queue.map((q) => ({ ...q, last: lastByBit.get(q.bitId) ?? null })),
    fixed: w.fixed.filter((f) => f.date.slice(0, 10) >= from && f.date.slice(0, 10) <= to),
    mgm,
  };
}

export type WritingDigest = Awaited<ReturnType<typeof getWritingDigest>>;

/** MGM: minuty materiału napisanego w miesiącu (nowe bity), cel miesięczny, historia i seria. */
export async function getMgm() {
  const [rows, goalRows, plays] = await Promise.all([
    db.select({ id: bits.id, name: bits.name, createdAt: bits.createdAt, status: bits.status, lengthMin: bits.lengthMin }).from(bits),
    db.select({ key: goals.key, target: goals.target }).from(goals).where(sql`${goals.key} like 'mgm:%'`),
    db
      .select({ bitId: gigBits.bitId, gigId: gigBits.gigId, startsAt: gigs.startsAt, reaction: gigBits.reaction })
      .from(gigBits)
      .innerJoin(gigs, eq(gigBits.gigId, gigs.id)),
  ]);
  const targets = new Map(goalRows.map((g) => [g.key.slice(4), g.target]));
  const today = nowLocal().slice(0, 10);
  return { ...computeMgm(rows, targets, today), ready: readyBits(rows, plays, today.slice(0, 7)) };
}
