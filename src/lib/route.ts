/**
 * „Trasa”: jadę z A do B, w B muszę być dnia D — jakie grania po drodze przez N dni wcześniej?
 * Czysta logika (bez bazy): korytarz wzdłuż linii trasy, każdy dzień ma „idealny” postęp
 * (dzień 1 bliżej startu, ostatni przy celu), a plan wybiera max. jedno granie na dzień tak,
 * żeby jechać cały czas do przodu.
 */
import { addDays } from "./time";

/** Szerokości korytarza do wyboru (km od linii trasy, w linii prostej). */
export const ROUTE_CORRIDORS = [30, 50, 80] as const;
export const ROUTE_MAX_DAYS = 5;
/** O ile postęp grania może odbiegać od idealnego dla danego dnia (ułamek trasy). */
const PROGRESS_SLACK = 0.35;
/** Dopuszczalne cofnięcie między kolejnymi dniami planu (ułamek trasy) — „po drodze”, nie w kółko. */
const BACKTRACK = 0.05;

export type RouteCandidate = {
  id: number;
  day: string; // YYYY-MM-DD
  progress: number; // 0 = start, 1 = cel
  offKm: number;
  /** Bazowa atrakcyjność (znajomy, open mic, pełna sala…), liczona przez wołającego. */
  base: number;
};

export type RouteDay<T> = {
  day: string;
  /** Idealny postęp tego dnia (0–1) — do podpisu „ok. 120 km od startu”. */
  ideal: number;
  pick: (T & RouteCandidate & { score: number }) | null;
  alternatives: (T & RouteCandidate & { score: number })[];
  /** Mam już tego dnia granie — nie proponuję nic nowego. */
  busy: boolean;
};

/** Dni drogi: N dni przed dniem przyjazdu (bez samego dnia przyjazdu). */
export function routeDays(arriveBy: string, days: number) {
  return Array.from({ length: days }, (_, i) => addDays(arriveBy, i - days));
}

/** Idealny postęp k-tego dnia (1..N): równe odcinki, ostatni dzień tuż przed celem. */
const idealFor = (k: number, n: number) => Math.min(0.95, (k / n) * 0.9);

export function planRoute<T extends RouteCandidate>(
  candidates: T[],
  { days, corridorKm, busyDays }: { days: string[]; corridorKm: number; busyDays: Set<string> },
): RouteDay<T>[] {
  const n = days.length;
  const perDay = days.map((day, i) => {
    const ideal = idealFor(i + 1, n);
    const busy = busyDays.has(day);
    const options = busy
      ? []
      : candidates
          .filter(
            (c) =>
              c.day === day &&
              c.offKm <= corridorKm &&
              c.progress >= -0.05 &&
              c.progress <= 1.05 &&
              Math.abs(c.progress - ideal) <= PROGRESS_SLACK,
          )
          .map((c) => ({
            ...c,
            // Im bliżej idealnego punktu dnia i linii trasy, tym lepiej — ale granie na trasie
            // trochę „nie w swoim dniu” wciąż jest lepsze niż żadne (stąd łagodne wagi).
            score: c.base - Math.abs(c.progress - ideal) * 2 - (c.offKm / corridorKm),
          }))
          .sort((a, b) => b.score - a.score);
    return { day, ideal, busy, options };
  });

  // Programowanie dynamiczne: max. suma punktów, postęp niemalejący (z małym luzem), dzień bez grania = 0.
  type State = { total: number; progress: number; picks: (T & RouteCandidate & { score: number } | null)[] };
  let states: State[] = [{ total: 0, progress: -Infinity, picks: [] }];
  for (const d of perDay) {
    const next: State[] = [];
    for (const s of states) {
      next.push({ ...s, picks: [...s.picks, null] });
      for (const o of d.options.slice(0, 12)) {
        if (o.progress + BACKTRACK < s.progress) continue;
        // +1 za każde granie: wolę zagrać niż mieć pusty dzień, nawet gdy punktacja wyszła słabo.
        next.push({ total: s.total + o.score + 1, progress: o.progress, picks: [...s.picks, o] });
      }
    }
    // Przycinamy do najlepszych stanów — przy ≤5 dniach i ≤12 opcjach to i tak drobiazg.
    states = next.sort((a, b) => b.total - a.total).slice(0, 200);
  }
  const best = states[0];

  return perDay.map((d, i) => {
    const pick = best.picks[i] ?? null;
    return {
      day: d.day,
      ideal: d.ideal,
      busy: d.busy,
      pick,
      alternatives: d.options.filter((o) => o.id !== pick?.id).slice(0, 4),
    };
  });
}

/** „30.10 Słupsk 3 dni”, „w drodze do Słupska na 30 października, 2 dni” → liczba dni (domyślnie 2). */
export function parseDays(text: string) {
  const m = text.match(/(\d)\s*(?:dni|dzie|doby)/i);
  const n = m ? Number(m[1]) : 2;
  return Math.max(1, Math.min(ROUTE_MAX_DAYS, n));
}
