/**
 * Jakie powiadomienia wysłać o danej porze. Woła to /api/notify/[kind] (zewnętrzny cron):
 * - morning (~10:30): grania do ponowienia dziś + „napisz” do grań oznaczonych jako zainteresowany
 *   na 14 i 7 dni przed,
 * - evening (~21:00, można też później): trening puent, jeśli dziś go nie było; ocena występu po graniu.
 * Każde przypomnienie idzie raz (app_state), więc cron może wołać kilka razy.
 */
import { and, asc, eq, gte, isNull, like, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { contacts, db, gigLogs, gigs } from "@/db";
import { getState, oncePerDay, setState } from "./app-state";
import { CHANNEL_SHORT } from "./labels";
import { getFollowUps, getWriting } from "./planning";
import type { PushPayload } from "./push";
import { plural } from "./text";
import { effectiveStart, nowLocal } from "./time";

/**
 * „Zainteresowany” = chcę zagrać, ale jeszcze nie napisałem. Przypominam na tyle dni przed graniem
 * (każdy próg raz na granie) — 14 dni to dość, żeby zaklepać miejsce, 7 to ostatni dzwonek.
 */
export const WRITE_REMINDER_DAYS = [14, 7] as const;

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

    // Grania „zainteresowany” za ≤14 dni: przypomnij, żeby napisać (próg 14 i 7 dni, każdy raz na granie).
    const until = new Date(Date.parse(today) + WRITE_REMINDER_DAYS[0] * 864e5).toISOString().slice(0, 10);
    const interested = await db
      .select({ id: gigs.id, title: gigs.title, startsAt: gigs.startsAt, headlinerName: headliner.name })
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
    const toWrite: typeof interested = [];
    for (const g of interested) {
      const left = daysUntil(today, g.startsAt);
      const stage = [...WRITE_REMINDER_DAYS].reverse().find((d) => left <= d)!; // najbliższy próg: 7 albo 14
      const key = `push-write-${g.id}-${stage}`;
      if (await getState(key)) continue;
      await setState(key, today);
      toWrite.push(g);
    }
    if (toWrite.length) {
      const first = toWrite[0];
      const label = (g: (typeof toWrite)[number]) => `${g.headlinerName ?? g.title} (${g.startsAt.slice(8, 10)}.${g.startsAt.slice(5, 7)})`;
      const soon = toWrite.some((g) => daysUntil(today, g.startsAt) <= WRITE_REMINDER_DAYS[1]);
      out.push({
        title: `${soon ? "Ostatni dzwonek — napisz" : "Napisz"}: ${plural(toWrite.length, "granie", "grania", "grań")}`,
        body: `${toWrite.slice(0, 3).map(label).join(", ")}${toWrite.length > 3 ? "…" : ""} — gotowy tekst w apce.`,
        url: toWrite.length === 1 ? `/gigs/${first.id}` : "/gigs?view=pipeline",
        tag: "write",
      });
    }
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
