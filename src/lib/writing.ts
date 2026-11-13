import type { WritingKind } from "@/db/schema";
import { weekStart } from "./rhythm";
import { addDays } from "./time";

/**
 * Regularność pisania. Trening puent codziennie (seria dni), generowanie i redakcja — cel tygodniowy
 * (seria tygodni z osiągniętym celem). Redakcja ma kolejkę: bity, które na scenie dostały 👎/😐,
 * a od tamtego grania nikt ich nie redagował. Czysta logika — dane: src/lib/planning.ts.
 */
export const WEEKLY_TARGET: Record<Exclude<WritingKind, "punchlines">, number> = { generate: 2, edit: 2 };

export const WRITING_LABEL: Record<WritingKind, string> = {
  punchlines: "Trening puent",
  generate: "Generowanie",
  edit: "Redakcja",
};
export const WRITING_HINT: Record<WritingKind, string> = {
  punchlines: "premisa + 10 puent",
  generate: "wypluwanie, zalążki, draft",
  edit: "poprawki po nagraniu / scenie",
};

export type SessionLite = { date: string; kind: WritingKind; bitId: number | null };

/**
 * Dni z rzędu z treningiem puent. Dziś jeszcze nie trenowałem — seria trwa od wczoraj
 * (zerwie się dopiero, jeśli dzień minie bez treningu).
 */
export function dayStreak(days: Set<string>, today: string) {
  const doneToday = days.has(today);
  let streak = 0;
  for (let d = doneToday ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) streak++;
  // Najdłuższa seria w historii.
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { streak, doneToday, best };
}

/** Pon–niedz bieżącego tygodnia z informacją, czy był trening. */
export function weekDots(days: Set<string>, today: string) {
  const start = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { day: d, done: days.has(d), future: d > today, today: d === today };
  });
}

/** Ile sesji danego rodzaju w tygodniu zaczynającym się `start`. */
export const countInWeek = (sessions: SessionLite[], kind: WritingKind, start: string) =>
  sessions.filter((s) => s.kind === kind && s.date >= start && s.date <= addDays(start, 6)).length;

/** Kolejne pełne tygodnie (wstecz od poprzedniego, + bieżący jeśli już osiągnięty) z celem dla rodzaju. */
export function weekStreak(sessions: SessionLite[], kind: Exclude<WritingKind, "punchlines">, today: string) {
  const target = WEEKLY_TARGET[kind];
  const current = weekStart(today);
  let streak = countInWeek(sessions, kind, current) >= target ? 1 : 0;
  for (let w = addDays(current, -7); countInWeek(sessions, kind, w) >= target; w = addDays(w, -7)) streak++;
  return streak;
}

export type BitReaction = { bitId: number; name: string; docUrl: string | null; gigDate: string; reaction: number };

/**
 * Do poprawki: ostatnia reakcja bitu na scenie to 😐 (0) albo 👎 (-1), a od tamtego grania
 * nie było sesji redakcji tego bitu. Najświeższe wpadki najpierw.
 */
export function editQueue(reactions: BitReaction[], sessions: SessionLite[]) {
  const latest = new Map<number, BitReaction>();
  for (const r of reactions) {
    const prev = latest.get(r.bitId);
    if (!prev || r.gigDate > prev.gigDate) latest.set(r.bitId, r);
  }
  const lastEdit = new Map<number, string>();
  for (const s of sessions) {
    if (s.kind === "edit" && s.bitId && s.date > (lastEdit.get(s.bitId) ?? "")) lastEdit.set(s.bitId, s.date);
  }
  return [...latest.values()]
    .filter((r) => r.reaction <= 0 && (lastEdit.get(r.bitId) ?? "") < r.gigDate.slice(0, 10))
    .sort((a, b) => b.gigDate.localeCompare(a.gigDate));
}

/**
 * „Poprawka siadła”: bit był redagowany po słabszej reakcji, a następne granie dało 👍.
 * Liczy zamknięte pętle — do podsumowań.
 */
export function fixedBits(reactions: BitReaction[], sessions: SessionLite[]) {
  const out: { bitId: number; name: string; date: string }[] = [];
  const byBit = new Map<number, BitReaction[]>();
  for (const r of reactions) byBit.set(r.bitId, [...(byBit.get(r.bitId) ?? []), r]);
  for (const [bitId, list] of byBit) {
    const sorted = list.sort((a, b) => a.gigDate.localeCompare(b.gigDate));
    for (let i = 1; i < sorted.length; i++) {
      const [before, after] = [sorted[i - 1], sorted[i]];
      const edited = sessions.some(
        (s) => s.kind === "edit" && s.bitId === bitId && s.date >= before.gigDate.slice(0, 10) && s.date <= after.gigDate.slice(0, 10),
      );
      if (before.reaction <= 0 && after.reaction === 1 && edited) out.push({ bitId, name: after.name, date: after.gigDate });
    }
  }
  return out;
}
