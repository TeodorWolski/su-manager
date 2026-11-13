import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { addDays, dayOf, daysBetween } from "./time";

/**
 * Rytm grania: wolę 2–3 grania co tydzień niż serię dzień po dniu i potem pustkę.
 * Nic nie blokuje — tylko podpowiada na ekranie Dziś.
 */
export const WEEK_MIN = 2;
export const WEEK_MAX = 3;
/**
 * Balans w tygodniu: grania przed komikiem (opener/support) i open miki pół na pół.
 * 2+1 w którąkolwiek stronę jest OK; 3 przed komikami w jednym tygodniu już nie.
 */
export const MAX_OPENERS_PER_WEEK = 2;
/** Od tylu grań dzień po dniu ostrzegam o serii. */
export const STREAK_WARN = 4;
/** Ile tygodni wstecz i do przodu pokazuje pasek rytmu (plus bieżący). */
const WEEKS_BACK = 4;
const WEEKS_AHEAD = 3;

export type RhythmGig = { id: number; title: string; startsAt: string; status: string; context: string | null };

/** Typ grania do balansu: przed komikiem albo open mic (headline / inne się nie liczą). */
export const gigKind = (context: string | null): "opener" | "openMic" | null =>
  context === "opener" || context === "support" ? "opener" : context === "open_mic" ? "openMic" : null;
export type RhythmOpportunity = { eventId: number; title: string; startsAt: string; cityName: string | null; href: string };

export type Week = {
  start: string;
  end: string;
  /** Zagrane (minione) albo potwierdzone (przyszłe). */
  confirmed: number;
  /** O które się staram (zainteresowany / napisałem / czekam). */
  pending: number;
  /** Z potwierdzonych i w toku: ile przed komikiem, ile open miców. */
  openers: number;
  openMics: number;
  when: "past" | "current" | "future";
};

export type Insight =
  | { kind: "add"; week: Week; label: string; suggestions: RhythmOpportunity[] }
  | { kind: "busy"; week: Week; label: string }
  | { kind: "balance"; week: Week; label: string }
  | { kind: "streak"; from: string; to: string; days: number; withPending: boolean }
  | { kind: "pastStreak"; from: string; to: string; days: number }
  | { kind: "uneven"; counts: number[] };

export const PENDING = ["interested", "contacted", "waiting"];

/** Poniedziałek tygodnia, w którym jest `date`. */
export function weekStart(date: string) {
  const dow = (new Date(Date.parse(date)).getUTCDay() + 6) % 7; // pon = 0
  return addDays(date, -dow);
}

export const fmtDay = (date: string) => format(parseISO(date), "EEE d.MM", { locale: pl });
export const fmtRange = (from: string, to: string) =>
  from.slice(5, 7) === to.slice(5, 7)
    ? `${format(parseISO(from), "d")}–${format(parseISO(to), "d MMM", { locale: pl })}`
    : `${format(parseISO(from), "d MMM", { locale: pl })} – ${format(parseISO(to), "d MMM", { locale: pl })}`;

function balanceOf(gigs: RhythmGig[]) {
  return {
    openers: gigs.filter((g) => gigKind(g.context) === "opener").length,
    openMics: gigs.filter((g) => gigKind(g.context) === "openMic").length,
  };
}

const weekLabel = (w: Week) => (w.when === "current" ? "Ten tydzień" : `Tydzień ${fmtRange(w.start, w.end)}`);

export function buildWeeks(gigs: RhythmGig[], today: string): Week[] {
  const current = weekStart(today);
  const weeks: Week[] = [];
  for (let i = -WEEKS_BACK; i <= WEEKS_AHEAD; i++) {
    const start = addDays(current, i * 7);
    const end = addDays(start, 6);
    const inWeek = gigs.filter((g) => dayOf(g.startsAt) >= start && dayOf(g.startsAt) <= end);
    weeks.push({
      start,
      end,
      confirmed: inWeek.filter((g) => g.status === "confirmed").length,
      pending: inWeek.filter((g) => PENDING.includes(g.status) && dayOf(g.startsAt) >= today).length,
      ...balanceOf(inWeek.filter((g) => g.status === "confirmed" || (PENDING.includes(g.status) && dayOf(g.startsAt) >= today))),
      when: i < 0 ? "past" : i === 0 ? "current" : "future",
    });
  }
  return weeks;
}

/** Ciągi co najmniej STREAK_WARN dni z rzędu z graniem (potwierdzonym albo w toku — w toku tylko przyszłe). */
function streaks(gigs: RhythmGig[], today: string) {
  const days = [
    ...new Set(
      gigs
        .filter((g) => g.status === "confirmed" || (PENDING.includes(g.status) && dayOf(g.startsAt) >= today))
        .map((g) => dayOf(g.startsAt)),
    ),
  ].sort();
  const pendingDays = new Set(gigs.filter((g) => PENDING.includes(g.status)).map((g) => dayOf(g.startsAt)));
  const runs: { from: string; to: string; days: number; withPending: boolean }[] = [];
  let from = days[0];
  for (let i = 0; i < days.length; i++) {
    const next = days[i + 1];
    if (next && next === addDays(days[i], 1)) continue;
    const run = days.filter((d) => d >= from && d <= days[i]);
    if (run.length >= STREAK_WARN) {
      runs.push({ from, to: days[i], days: run.length, withPending: run.some((d) => pendingDays.has(d)) });
    }
    from = next;
  }
  return runs;
}

/**
 * Wolne dni w tygodniu, gdzie są okazje — najpierw dni bez grania obok (żeby nie robić serii),
 * potem znajomi / open miki przed resztą (kolejność `opportunities` zostaje).
 */
function suggestFor(week: Week, gigs: RhythmGig[], opportunities: RhythmOpportunity[], today: string) {
  const busy = new Set(
    gigs.filter((g) => g.status === "confirmed" || PENDING.includes(g.status)).map((g) => dayOf(g.startsAt)),
  );
  const isolated = (d: string) => !busy.has(addDays(d, -1)) && !busy.has(addDays(d, 1));
  const seen = new Set<string>();
  return opportunities
    .filter((o) => {
      const d = dayOf(o.startsAt);
      return d >= week.start && d <= week.end && d >= today && !busy.has(d);
    })
    .sort((a, b) => Number(isolated(dayOf(b.startsAt))) - Number(isolated(dayOf(a.startsAt))))
    .filter((o) => !seen.has(dayOf(o.startsAt)) && seen.add(dayOf(o.startsAt)))
    .slice(0, 2);
}

export function getInsights(gigs: RhythmGig[], opportunities: RhythmOpportunity[], today: string): {
  weeks: Week[];
  insights: Insight[];
} {
  const weeks = buildWeeks(gigs, today);
  const insights: Insight[] = [];

  const runs = streaks(gigs, today);
  for (const s of runs.filter((r) => r.to >= today)) insights.push({ kind: "streak", ...s });

  // Bieżący tydzień (jeśli zostały w nim co najmniej 2 dni) i następny.
  const current = weeks.find((w) => w.when === "current")!;
  const daysLeft = daysBetween(today, current.end) + 1;
  const candidates = [
    ...(daysLeft >= 2 ? [{ week: current, label: "W tym tygodniu" }] : []),
    { week: weeks[weeks.indexOf(current) + 1], label: "W przyszłym tygodniu" },
  ];
  for (const { week, label } of candidates) {
    if (week.confirmed + week.pending < WEEK_MIN) {
      insights.push({ kind: "add", week, label, suggestions: suggestFor(week, gigs, opportunities, today) });
    }
  }
  for (const week of weeks.filter((w) => w.when !== "past" && w.openers > MAX_OPENERS_PER_WEEK)) {
    insights.push({ kind: "balance", week, label: weekLabel(week) });
  }
  for (const week of weeks.filter((w) => w.when !== "past" && w.confirmed > WEEK_MAX)) {
    insights.push({
      kind: "busy",
      week,
      label: week.when === "current" ? "Ten tydzień" : `Tydzień ${fmtRange(week.start, week.end)}`,
    });
  }

  // Wstecz (ostatnie WEEKS_BACK tygodni): seria dzień po dniu albo dużo naraz i pusto obok.
  const lastSeries = runs.filter((r) => r.to < today && r.to >= addDays(today, -WEEKS_BACK * 7)).at(-1);
  const past = weeks.filter((w) => w.when === "past").map((w) => w.confirmed);
  if (lastSeries) insights.push({ kind: "pastStreak", from: lastSeries.from, to: lastSeries.to, days: lastSeries.days });
  else if (Math.max(...past) > WEEK_MAX + 1 && past.some((n) => n === 0)) insights.push({ kind: "uneven", counts: past });

  return { weeks, insights };
}
