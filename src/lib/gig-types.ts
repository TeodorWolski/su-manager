/**
 * „Uzupełnij typ”: grania, którym typ trzeba poprawić, żeby licznik występów, balans i statystyki ocen
 * nie kłamały. Czysta logika (dane: listTypeSuspects w queries.ts).
 */
import type { GigContext } from "@/db/schema";

export type TypedGig = { context: GigContext | null; title: string; headlinerId: number | null };

/** „Open mic przed Tomkiem…” to w słowniku apki „przed kimś” (opener), nie open mic. */
const BEFORE = /\bprzed\s+\p{Lu}/u;

/** Powód do poprawki albo null, gdy typ wygląda dobrze. */
export function typeIssue(g: TypedGig): { reason: string; suggested: GigContext | null } | null {
  if (!g.context) return { reason: "bez typu", suggested: BEFORE.test(g.title) || g.headlinerId ? "opener" : null };
  if (g.context === "open_mic" && (BEFORE.test(g.title) || g.headlinerId)) {
    return { reason: g.headlinerId ? "open mic, ale ma headlinera" : "w tytule „przed …”", suggested: "opener" };
  }
  return null;
}

/** Nazwisko z tytułu „… przed Tomkiem Kołeckim” — do dopasowania headlinera z CRM (bez zakładania nowego). */
export const headlinerFromTitle = (title: string) => title.match(/\bprzed\s+(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?)/u)?.[1] ?? null;
