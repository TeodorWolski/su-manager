/**
 * Niedzielne podsumowanie tygodnia (mail, scripts/weekly.ts): co zagrałem, które bity siadły,
 * jak poszło pisanie, i jak wygląda przyszły tydzień względem rytmu 2–3 + najgorętsze okazje.
 * Bez `server-only` — uruchamia to skrypt z GitHub Actions.
 */
import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { bits, db, gigBits, gigLogs, gigs, interactions, venues } from "@/db";
import { GIG_CONTEXT_LABEL, GIG_OUTCOME_LABEL, REACTION_EMOJI } from "./labels";
import { getPlanning } from "./planning";
import { addDays, MAX_OPENERS_PER_WEEK, WEEK_MAX, WEEK_MIN, weekStart } from "./rhythm";
import { plural } from "./text";
import { effectiveStart, fmtDate, fmtDateTime, nowLocal } from "./time";

const APP_URL = process.env.APP_URL ?? "https://su-manager.vercel.app";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const muted = (s: string) => `<span style="color:#5b6b63;font-size:13px">${s}</span>`;
const h3 = (s: string) => `<h3 style="margin:22px 0 6px;font-size:15px">${s}</h3>`;

export async function getWeekly() {
  const now = nowLocal();
  const today = now.slice(0, 10);
  const from = weekStart(today);
  const to = addDays(from, 6);
  const inWeek = and(gte(sql`substr(${gigs.startsAt}, 1, 10)`, from), lte(sql`substr(${gigs.startsAt}, 1, 10)`, to));

  const [played, bitReactions, sent, outcomes, planning] = await Promise.all([
    db
      .select({ id: gigs.id, title: gigs.title, startsAt: gigs.startsAt, context: gigs.context, venueName: venues.name, rating: gigLogs.rating })
      .from(gigs)
      .leftJoin(venues, eq(venues.id, gigs.venueId))
      .leftJoin(gigLogs, eq(gigLogs.gigId, gigs.id))
      .where(and(eq(gigs.status, "confirmed"), inWeek))
      .orderBy(gigs.startsAt),
    db
      .select({ name: bits.name, reaction: gigBits.reaction })
      .from(gigBits)
      .innerJoin(bits, eq(bits.id, gigBits.bitId))
      .innerJoin(gigs, eq(gigs.id, gigBits.gigId))
      .where(and(inWeek, isNotNull(gigBits.reaction))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(interactions)
      .where(and(isNotNull(interactions.gigId), gte(interactions.date, from), lte(interactions.date, to))),
    db
      .select({ outcome: gigs.outcome, n: sql<number>`count(*)` })
      .from(gigs)
      .where(
        and(
          isNotNull(gigs.outcome),
          gte(sql`substr(${gigs.statusChangedAt}, 1, 10)`, from),
          lte(sql`substr(${gigs.statusChangedAt}, 1, 10)`, to),
          inArray(gigs.status, ["confirmed", "rejected"]),
        ),
      )
      .groupBy(gigs.outcome),
    getPlanning(),
  ]);

  const nextStart = addDays(from, 7);
  const next = planning.weeks.find((w) => w.start === nextStart) ?? null;
  // Tylko te, które już się odbyły (mail idzie w niedzielę wieczorem, ale ręcznie można odpalić wcześniej).
  return { from, to, played: played.filter((g) => effectiveStart(g.startsAt) < now), bitReactions, sent: Number(sent[0]?.n ?? 0), outcomes, next, hot: planning.hot };
}

export type Weekly = Awaited<ReturnType<typeof getWeekly>>;

export function renderWeekly(w: Weekly) {
  const rated = w.played.filter((g) => g.rating != null);
  const avg = rated.length ? rated.reduce((s, g) => s + g.rating!, 0) / rated.length : null;

  const gigsHtml = w.played.length
    ? `<table style="width:100%;border-collapse:collapse">${w.played
        .map(
          (g) => `<tr><td style="padding:6px 0;border-bottom:1px solid #e5ece8">
        <a href="${APP_URL}/gigs/${g.id}" style="color:#13824a;text-decoration:none;font-weight:600">${esc(g.title)}</a><br>
        ${muted(esc([fmtDateTime(g.startsAt), g.venueName, g.context && GIG_CONTEXT_LABEL[g.context]].filter(Boolean).join(" · ")))}
      </td><td style="text-align:right;white-space:nowrap">${g.rating != null ? `★ ${g.rating}` : muted("bez logu")}</td></tr>`,
        )
        .join("")}</table>`
    : muted("W tym tygodniu nic nie zagrałeś.");

  // Bity: suma reakcji z tygodnia, najlepsze i najsłabsze.
  const score = new Map<string, { up: number; down: number }>();
  for (const b of w.bitReactions) {
    const s = score.get(b.name) ?? { up: 0, down: 0 };
    if (b.reaction === 1) s.up++;
    if (b.reaction === -1) s.down++;
    score.set(b.name, s);
  }
  const bitLine = (pred: (s: { up: number; down: number }) => boolean) =>
    [...score.entries()]
      .filter(([, s]) => pred(s))
      .map(([n]) => esc(n))
      .join(", ");
  const ups = bitLine((s) => s.up > s.down);
  const downs = bitLine((s) => s.down > s.up);
  const bitsHtml = score.size
    ? [ups && `${REACTION_EMOJI[1]} ${ups}`, downs && `${REACTION_EMOJI[-1]} ${downs}`].filter(Boolean).join("<br>") || muted("Wszystko „tak sobie”.")
    : muted("Brak ocen bitów w logach.");

  const outcomesText = w.outcomes.map((o) => `${GIG_OUTCOME_LABEL[o.outcome!]}: ${o.n}`).join(" · ");
  const outreachHtml = `${plural(w.sent, "wysłana wiadomość", "wysłane wiadomości", "wysłanych wiadomości")}${outcomesText ? `<br>${esc(outcomesText)}` : ""}`;

  let nextHtml = muted("Brak danych o przyszłym tygodniu.");
  if (w.next) {
    const n = w.next.confirmed + w.next.pending;
    const notes = [
      n < WEEK_MIN && `za mało — warto dodać ${n === 0 ? "dwa" : "jedno"}`,
      w.next.confirmed > WEEK_MAX && "sporo — może coś przesunąć",
      w.next.openers > MAX_OPENERS_PER_WEEK && `${w.next.openers} przed komikami — może jedno zamienić na open mic`,
    ].filter(Boolean);
    nextHtml = `<b>${plural(w.next.confirmed, "potwierdzone", "potwierdzone", "potwierdzonych")}</b>${w.next.pending ? `, ${w.next.pending} w toku` : ""} (cel ${WEEK_MIN}–${WEEK_MAX}) · przed komikami ${w.next.openers}, open miki ${w.next.openMics}${notes.length ? `<br>${esc(notes.join("; "))}` : `<br>${muted("Równy rytm — tak trzymaj.")}`}`;
  }
  const hotHtml = w.hot.length
    ? w.hot
        .slice(0, 3)
        .map((h) => `• <a href="${esc(h.url)}" style="color:#13824a">${esc(h.title)}</a> ${muted(esc(`${fmtDate(h.startsAt)}${h.cityName ? `, ${h.cityName}` : ""}`))}`)
        .join("<br>")
    : "";

  const subject = `SU Manager: tydzień ${fmtDate(w.from)} – ${fmtDate(w.to)} · ${plural(w.played.length, "granie", "grania", "grań")}${avg != null ? ` · ★ ${avg.toFixed(1).replace(".", ",")}` : ""}`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;color:#1c2a23">
    <h2 style="margin:0 0 4px">Podsumowanie tygodnia</h2>
    ${muted(`${esc(fmtDate(w.from))} – ${esc(fmtDate(w.to))} · <a href="${APP_URL}" style="color:#13824a">Otwórz aplikację</a>`)}
    ${h3(`Zagrane · ${w.played.length}${avg != null ? ` · średnio ★ ${avg.toFixed(1).replace(".", ",")}` : ""}`)}${gigsHtml}
    ${h3("Bity")}${bitsHtml}
    ${h3("Pisanie")}${outreachHtml}
    ${h3("Przyszły tydzień")}${nextHtml}
    ${hotHtml ? `${h3("🔥 Warto napisać")}${hotHtml}` : ""}
  </div>`;
  return { subject, html };
}
