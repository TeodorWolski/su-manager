/**
 * Jakie powiadomienia wysłać o danej porze. Woła to /api/notify/[kind] (zewnętrzny cron):
 * - morning (~10:30): grania do ponowienia dziś + „napisz” do grań oznaczonych jako zainteresowany
 *   (wyprzedzenie komika i połowa tego czasu; domyślnie 14 i 7 dni przed),
 * - evening (~21:00, można też później): trening puent, jeśli dziś go nie było; ocena występu po graniu.
 * Każde przypomnienie idzie raz (app_state), więc cron może wołać kilka razy.
 */
import { and, asc, eq, gte, isNull, like, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { contacts, db, gigLogs, gigs } from "@/db";
import { getState, oncePerDay, setState } from "./app-state";
import { CHANNEL_SHORT } from "./labels";
import { loadLeadTimes } from "./lead-data";
import { loadMarketEvents } from "./market-data";
import { getFollowUps, getWriting } from "./planning";
import type { PushPayload } from "./push";
import { plural } from "./text";
import { effectiveStart, nowLocal } from "./time";

/**
 * „Zainteresowany” = chcę zagrać, ale jeszcze nie napisałem. Przypominam na tyle dni przed graniem,
 * ile wynosi wyprzedzenie dla tego komika / typu grania (src/lib/lead-time.ts, domyślnie 14), i drugi
 * raz w połowie tego czasu („ostatni dzwonek”). Każdy próg raz na granie.
 */
export const writeReminderDays = (lead: number) => [lead, Math.max(3, Math.round(lead / 2))] as const;
/** Najdalej, jak sięgamy po grania „zainteresowany” (= maks. wyprzedzenie). */
const WRITE_LOOKAHEAD_DAYS = 42;

const headliner = alias(contacts, "headliner");
const daysUntil = (today: string, startsAt: string) => Math.round((Date.parse(startsAt.slice(0, 10)) - Date.parse(today)) / 864e5);

/** Ile minut po starcie grania przypominam o ocenie (jak bramka oceny w apce). */
const REVIEW_AFTER_MIN = 90;

export async function notifications(kind: "morning" | "evening"): Promise<PushPayload[]> {
  const now = nowLocal();
  const today = now.slice(0, 10);
  const out: PushPayload[] = [];

  if (kind === "morning") {
    const due = await getFollowUps();
    if (due.length && (await oncePerDay("push-followups", today))) {
      const first = due[0];
      const next = first.next ? ` — spróbuj ${CHANNEL_SHORT[first.next] ?? first.next}` : "";
      out.push({
        title: `Do ponowienia: ${plural(due.length, "granie", "grania", "grań")}`,
        body: `${first.title}${first.headlinerName ? ` (${first.headlinerName})` : ""}, cisza ${first.quietDays} dni${next}.`,
        url: due.length === 1 ? `/gigs/${first.id}` : "/",
        tag: "followups",
      });
    }

    // Grania „zainteresowany”: przypomnij, żeby napisać (progi z wyprzedzenia, każdy raz na granie).
    const until = new Date(Date.parse(today) + WRITE_LOOKAHEAD_DAYS * 864e5).toISOString().slice(0, 10);
    const leads = await loadLeadTimes();
    const interested = await db
      .select({ id: gigs.id, title: gigs.title, startsAt: gigs.startsAt, headlinerName: headliner.name, headlinerId: gigs.headlinerId, context: gigs.context })
      .from(gigs)
      .leftJoin(headliner, eq(headliner.id, gigs.headlinerId))
      .where(
        and(
          eq(gigs.status, "interested"),
          gte(sql`substr(${gigs.startsAt}, 1, 10)`, today),
          lte(sql`substr(${gigs.startsAt}, 1, 10)`, until),
        ),
      )
      .orderBy(asc(gigs.startsAt));
    const toWrite: (typeof interested[number] & { soon: boolean })[] = [];
    for (const g of interested) {
      const left = daysUntil(today, g.startsAt);
      const [first, last] = writeReminderDays(leads.leadFor(g.headlinerId, g.context).days);
      if (left > first) continue; // jeszcze za wcześnie dla tego komika
      const stage = left <= last ? last : first;
      const key = `push-write-${g.id}-${stage}`;
      if (await getState(key)) continue;
      await setState(key, today);
      toWrite.push({ ...g, soon: stage === last });
    }
    if (toWrite.length) {
      const first = toWrite[0];
      const label = (g: (typeof toWrite)[number]) => `${g.headlinerName ?? g.title} (${g.startsAt.slice(8, 10)}.${g.startsAt.slice(5, 7)})`;
      const soon = toWrite.some((g) => g.soon);
      out.push({
        title: `${soon ? "Ostatni dzwonek — napisz" : "Napisz"}: ${plural(toWrite.length, "granie", "grania", "grań")}`,
        body: `${toWrite.slice(0, 3).map(label).join(", ")}${toWrite.length > 3 ? "…" : ""} — gotowy tekst w apce.`,
        url: toWrite.length === 1 ? `/gigs/${first.id}` : "/gigs?view=pipeline",
        tag: "write",
      });
    }

    const fresh = await newDatesNotice(today);
    if (fresh) out.push(fresh);
  }

  if (kind === "evening") {
    const w = await getWriting();
    if (!w.punchlines.doneToday && (await oncePerDay("push-punchlines", today))) {
      const s = w.punchlines.streak;
      out.push({
        title: s > 0 ? `🔥 Seria ${plural(s, "dzień", "dni", "dni")} — nie zrywaj` : "✍️ Trening puent",
        body: s > 0 ? "Dziś jeszcze bez treningu: premisa + 10 puent." : "Premisa + 10 puent na dziś? Zacznij serię.",
        url: "/writing",
        tag: "punchlines",
      });
    }
    // Potwierdzone grania dziś, po których minęło 90 min, a nie ma logu.
    const played = await db
      .select({ id: gigs.id, title: gigs.title, startsAt: gigs.startsAt })
      .from(gigs)
      .leftJoin(gigLogs, eq(gigLogs.gigId, gigs.id))
      .where(and(eq(gigs.status, "confirmed"), like(gigs.startsAt, `${today}%`), isNull(gigLogs.gigId), eq(gigs.skipReview, false)));
    const reviewBy = nowLocal(-REVIEW_AFTER_MIN);
    for (const g of played.filter((g) => effectiveStart(g.startsAt) <= reviewBy)) {
      if (!(await oncePerDay(`push-review-${g.id}`, today))) continue;
      out.push({ title: "Jak poszło? 🎤", body: `${g.title} — oceń występ, póki świeże.`, url: `/gigs/${g.id}/log`, tag: `review-${g.id}` });
    }
  }
  return out;
}

/** Pierwsze sprawdzenie „nowych terminów” sięga tyle godzin wstecz. */
const NEW_DATES_FIRST_LOOKBACK_H = 24;

/**
 * „Nowe terminy”: komicy z CRM, którzy od poprzedniego sprawdzenia wrzucili daty w zasięgu — napisz, zanim
 * zajmą sloty. Bez ukrytych w Okazjach i wyciszonych (odmowa / ghosting / ręcznie). Licznik „od kiedy”
 * w app_state, więc nic się nie powtarza ani nie przepada.
 */
async function newDatesNotice(today: string): Promise<PushPayload | null> {
  const nowUtc = new Date().toISOString().replace("T", " ").slice(0, 19);
  const since =
    (await getState("push-new-dates-since")) ??
    new Date(Date.now() - NEW_DATES_FIRST_LOOKBACK_H * 36e5).toISOString().replace("T", " ").slice(0, 19);
  const [market, snoozed] = await Promise.all([
    loadMarketEvents(),
    db.select({ id: contacts.id }).from(contacts).where(sql`${contacts.snoozeUntil} > ${today}`),
  ]);
  await setState("push-new-dates-since", nowUtc);
  const muted = new Set(snoozed.map((c) => c.id));
  const fresh = market.events.filter(
    (e) => e.contactId != null && e.firstSeenAt > since && e.inRange && e.startsAt.slice(0, 10) >= today && !market.hidden.has(e.key) && !muted.has(e.contactId),
  );
  if (!fresh.length) return null;
  const byContact = new Map<number, typeof fresh>();
  for (const e of fresh) byContact.set(e.contactId!, [...(byContact.get(e.contactId!) ?? []), e]);
  const people = [...byContact.values()].map((list) => {
    const first = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    return { id: list[0].contactId!, name: list[0].name, count: list.length, first };
  });
  const line = (p: (typeof people)[number]) =>
    `${p.name}: ${p.count} (najbliżej ${p.first.startsAt.slice(8, 10)}.${p.first.startsAt.slice(5, 7)}${p.first.cityName ? ` ${p.first.cityName}` : ""})`;
  return {
    title: people.length === 1 ? `🎟️ Nowe terminy: ${people[0].name}` : `🎟️ Nowe terminy: ${plural(people.length, "komik", "komików", "komików")}`,
    body: `${people.slice(0, 3).map(line).join(" · ")}${people.length > 3 ? "…" : ""} — napisz, zanim zajmą sloty.`,
    url: people.length === 1 ? `/contacts/${people[0].id}` : "/events?tab=friends",
    tag: "new-dates",
  };
}
