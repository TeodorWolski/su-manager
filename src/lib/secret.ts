/**
 * Porównywanie sekretów (hasło, tokeny tras bez sesji). Czysta logika, żeby dało się ją testować.
 */
import { timingSafeEqual } from "node:crypto";

/**
 * Czy podana wartość to oczekiwany sekret — w stałym czasie, żeby czas odpowiedzi nie zdradzał,
 * ile znaków się zgadza. Nieustawiony albo pusty sekret nie pasuje do niczego: brak zmiennej
 * w środowisku ma zamykać trasę, nie otwierać.
 */
export function secretMatches(given: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual rzuca przy różnych długościach (w bajtach, nie znakach).
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Token z nagłówka `Authorization: Bearer <token>`; pusty tekst, gdy nagłówka nie ma. */
export const bearerToken = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
