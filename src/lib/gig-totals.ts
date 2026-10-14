/**
 * Licznik występów od początku: zagrane = potwierdzone grania, które już się zaczęły
 * (odwołane i odrzucone się nie liczą), z podziałem na typ grania. Czysta logika
 * (dane: getGigTotals w queries.ts).
 */
import type { GigContext } from "@/db/schema";

/** Kolejność i grupy jak w mini kalendarzu: „Inne” = inne + bez typu. */
export const TOTAL_KINDS = ["open_mic", "opener", "support", "headline", "other"] as const;
export type TotalKind = (typeof TOTAL_KINDS)[number];

export type PlayedGig = {
  context: GigContext | null;
  startsAt: string;
  headlinerId: number | null;
  venueId: number | null;
  cityName: string | null;
};

export function gigTotals(played: PlayedGig[], today: string) {
  const byKind = Object.fromEntries(TOTAL_KINDS.map((k) => [k, 0])) as Record<TotalKind, number>;
  for (const g of played) byKind[g.context && g.context !== "other" ? g.context : "other"]++;
  const before = played.filter((g) => g.context === "opener" || g.context === "support");
  const first = played.map((g) => g.startsAt).sort()[0] ?? null;
  return {
    total: played.length,
    thisYear: played.filter((g) => g.startsAt.slice(0, 4) === today.slice(0, 4)).length,
    byKind,
    /** Bez typu (wpada do „Inne”) — podpowiedź, żeby uzupełnić kontekst. */
    noContext: played.filter((g) => !g.context).length,
    cities: new Set(played.flatMap((g) => (g.cityName ? [g.cityName.toLowerCase()] : []))).size,
    venues: new Set(played.flatMap((g) => (g.venueId ? [g.venueId] : []))).size,
    /** U ilu różnych komików grałem przed nimi (open mic przed X + support). */
    headliners: new Set(before.flatMap((g) => (g.headlinerId ? [g.headlinerId] : []))).size,
    first,
  };
}

export type GigTotals = ReturnType<typeof gigTotals>;
