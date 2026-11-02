import { normalize } from "./text";

/**
 * Dopasowanie kontaktów z CRM do tekstu wydarzenia (tytuł + występujący).
 * Pisownia bywa różna („Tomek”/„Tomasz”, literówki, odmiana), więc:
 * - porównujemy po tokenach bez polskich znaków,
 * - token pasuje przy odległości Levenshteina ≤ 1 (dla dłuższych słów) albo wspólnym rdzeniu (odmiana),
 * - wariant imię+nazwisko musi trafić wszystkimi tokenami; aliasy (np. „Viking”) mogą być jednym słowem.
 */

export const tokens = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean);

function levenshtein(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function tokenMatches(want: string, have: string) {
  if (want === have) return true;
  if (want.length >= 5 && levenshtein(want, have) <= 1) return true;
  // odmiana: „Kołecki” ↔ „Kołeckim”, „Stramik” ↔ „Stramikiem”
  const stem = want.slice(0, Math.max(5, want.length - 2));
  return want.length >= 6 && have.length >= stem.length && have.startsWith(stem);
}

export type Matchable = { id: number; name: string; aliases: string | null };

/** Warianty zapisu kontaktu: pełne imię i nazwisko + aliasy. Krótkie (≤3 litery) jednowyrazowe pomijamy. */
export function variants(c: Matchable): string[][] {
  const all = [c.name, ...(c.aliases?.split(",") ?? [])].map(tokens).filter((v) => v.length);
  return all.filter((v) => v.length > 1 || v[0].length >= 4);
}

/**
 * Wyszukiwarka: każde słowo frazy (≥2 litery) trafia w któreś słowo tekstu — w obie strony,
 * bo odmieniona może być i fraza („Modzelewskiego”), i tekst („z Modzelewskim”).
 */
export function matchesQuery(query: string, text: string) {
  const want = tokens(query).filter((w) => w.length >= 2);
  const have = tokens(text);
  return want.length > 0 && want.every((w) => have.some((h) => tokenMatches(w, h) || tokenMatches(h, w)));
}

export function matchContacts<T extends Matchable>(text: string, contacts: T[]): T[] {
  const have = tokens(text);
  return contacts.filter((c) =>
    variants(c).some((variant) => variant.every((w) => have.some((h) => tokenMatches(w, h)))),
  );
}

/**
 * Zapas, gdy imię jest mocno odmienione („Tomkiem” ↔ „Tomek”): samo nazwisko (ostatnie słowo pełnego zapisu),
 * ale tylko jeśli wskazuje jedną osobę (przy kilku — rozstrzyga początek imienia); inaczej nic, lepiej nie zgadywać.
 */
export function matchBySurname<T extends Matchable>(text: string, contacts: T[]): T | null {
  const have = tokens(text);
  const hits = contacts.filter((c) => {
    const full = tokens(c.name);
    return full.length > 1 && have.some((h) => tokenMatches(full[full.length - 1], h));
  });
  if (hits.length <= 1) return hits[0] ?? null;
  // Kilka osób o tym nazwisku (Kołecki / Kołecka) — rozstrzyga początek imienia („Tom…” w „Tomkiem”).
  const byName = hits.filter((c) => have.some((h) => h.startsWith(tokens(c.name)[0].slice(0, 3))));
  return byName.length === 1 ? byName[0] : null;
}
