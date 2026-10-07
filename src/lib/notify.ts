/**
 * Jakie powiadomienia wysłać o danej porze. Woła to /api/notify/[kind] (zewnętrzny cron):
 * - morning (~10:30): grania do ponowienia dziś,
 * - evening (~21:00, można też później): trening puent, jeśli dziś go nie było; ocena występu po graniu.
 * Każde przypomnienie idzie raz (app_state), więc cron może wołać kilka razy.
 */
import { and, eq, isNull, like } from "drizzle-orm";
import { db, gigLogs, gigs } from "@/db";
import { oncePerDay } from "./app-state";
import { CHANNEL_SHORT } from "./labels";
import { getFollowUps, getWriting } from "./planning";
import type { PushPayload } from "./push";
import { plural } from "./text";
import { effectiveStart, nowLocal } from "./time";

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
