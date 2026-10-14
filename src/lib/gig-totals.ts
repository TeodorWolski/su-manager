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
  headlinerName?: string | null;
  venueId: number | null;
  venueName?: string | null;
  cityName: string | null;
};

/** Do którego typu na liczniku trafia granie („Inne” = inne + bez typu). */
export const totalKind = (context: GigContext | null): TotalKind => (context && context !== "other" ? context : "other");

export function gigTotals(played: PlayedGig[], today: string) {
  const byKind = Object.fromEntries(TOTAL_KINDS.map((k) => [k, 0])) as Record<TotalKind, number>;
  for (const g of played) byKind[totalKind(g.context)]++;
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

export type PlayedGroupBy = "cities" | "venues" | "headliners";

/**
 * Lista do „N miast / scen / komików” na liczniku: klucz (do filtra w linku), nazwa, liczba występów
 * i ostatni raz; najczęstsze najpierw. Komicy — tylko open mic przed X i support.
 */
export function playedGroups(played: PlayedGig[], by: PlayedGroupBy) {
  const groups = new Map<string, { key: string; name: string; count: number; last: string }>();
  for (const g of played) {
    const entry =
      by === "cities"
        ? g.cityName && { key: g.cityName.toLowerCase(), name: g.cityName }
        : by === "venues"
          ? g.venueId && { key: String(g.venueId), name: g.venueName ?? "?" }
          : (g.context === "opener" || g.context === "support") && g.headlinerId && { key: String(g.headlinerId), name: g.headlinerName ?? "?" };
    if (!entry) continue;
    const cur = groups.get(entry.key) ?? { ...entry, count: 0, last: "" };
    cur.count++;
    if (g.startsAt > cur.last) cur.last = g.startsAt;
    groups.set(entry.key, cur);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pl"));
}
