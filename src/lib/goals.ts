import "server-only";
import { eq, sql } from "drizzle-orm";
import { bits, db, gigs, goals } from "@/db";
import { effectiveStart, nowLocal } from "./time";

/** „Super target”: 10 grań w miesiącu. Domyślny, gdy na dany miesiąc nie ustawiono celu. */
export const DEFAULT_MONTHLY_GIGS = 10;
/** Domyślny cel materiału: 15 min sprawdzonego materiału do końca roku. */
export const DEFAULT_MATERIAL_MIN = 15;
/** Ile poprzednich miesięcy pokazywać w historii celów. */
const HISTORY_MONTHS = 6;

export const monthKey = (month: string) => `gigs:${month}`;
export const MATERIAL_KEY = "material";

const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};

export async function getGoals() {
  const now = nowLocal();
  const today = now.slice(0, 10);
  const month = now.slice(0, 7);

  const [goalRows, confirmed, material] = await Promise.all([
    db.select().from(goals),
    db.select({ startsAt: gigs.startsAt }).from(gigs).where(eq(gigs.status, "confirmed")),
    db
      .select({ status: bits.status, minutes: sql<number>`coalesce(sum(${bits.lengthMin}), 0)`, count: sql<number>`count(*)` })
      .from(bits)
      .groupBy(bits.status),
  ]);
  const goalMap = new Map(goalRows.map((g) => [g.key, g]));
  const targetFor = (m: string) => goalMap.get(monthKey(m))?.target ?? DEFAULT_MONTHLY_GIGS;

  // Zagrane = potwierdzone i już po starcie; zaplanowane = potwierdzone, jeszcze przed nami.
  const played = new Map<string, number>();
  let plannedThisMonth = 0;
  for (const g of confirmed) {
    const m = g.startsAt.slice(0, 7);
    if (effectiveStart(g.startsAt) < now) played.set(m, (played.get(m) ?? 0) + 1);
    else if (m === month) plannedThisMonth++;
  }

  const firstMonth = [...played.keys()].sort()[0] ?? month;
  const history: { month: string; played: number; target: number; hit: boolean }[] = [];
  for (let m = prevMonth(month); m >= firstMonth && history.length < HISTORY_MONTHS; m = prevMonth(m)) {
    const p = played.get(m) ?? 0;
    history.push({ month: m, played: p, target: targetFor(m), hit: p >= targetFor(m) });
  }

  const current = {
    month,
    played: played.get(month) ?? 0,
    planned: plannedThisMonth,
    target: targetFor(month),
    isSet: goalMap.has(monthKey(month)),
    /** Ile grań „powinno” być na dziś, gdyby rozłożyć cel równo na miesiąc. */
    pace: (targetFor(month) * Number(today.slice(8, 10))) / daysInMonth(month),
    daysLeft: daysInMonth(month) - Number(today.slice(8, 10)),
  };

  // Seria: kolejne miesiące wstecz z osiągniętym celem (+ bieżący, jeśli już osiągnięty).
  let streak = current.played >= current.target ? 1 : 0;
  for (const h of history) {
    if (!h.hit) break;
    streak++;
  }
  const best = [...played.entries()].sort((a, b) => b[1] - a[1])[0];

  const byStatus = Object.fromEntries(material.map((r) => [r.status, r]));
  const materialGoal = goalMap.get(MATERIAL_KEY);
  const deadline = materialGoal?.deadline ?? `${today.slice(0, 4)}-12-31`;
  return {
    month: current,
    history,
    streak,
    best: best ? { month: best[0], played: best[1] } : null,
    material: {
      tested: Number(byStatus.tested?.minutes ?? 0),
      testing: Number(byStatus.testing?.minutes ?? 0),
      vomit: Number(byStatus.vomit?.minutes ?? 0),
      bits: material.reduce((s, r) => s + Number(r.count), 0),
      target: materialGoal?.target ?? DEFAULT_MATERIAL_MIN,
      deadline,
      isSet: !!materialGoal,
      daysLeft: Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(today)) / 864e5)),
    },
  };
}

export type GoalsOverview = Awaited<ReturnType<typeof getGoals>>;
