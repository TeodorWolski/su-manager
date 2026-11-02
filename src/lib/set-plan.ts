/**
 * Propozycja setu na dzisiejsze granie (karta „Przed wyjściem na scenę” na Dziś). Czysta logika.
 * Pewniaki (Sprawdzone, potem w testach z dobrymi reakcjami) wypełniają czas, w środek wchodzi jeden
 * bit do przetestowania; kolejność: najmocniejszy na otwarcie, drugi najmocniejszy na zamknięcie.
 * Tylko podpowiedź — set i tak układasz sam.
 */
import type { GigContext } from "@/db/schema";

/** Ile minut zwykle dostaję, gdy nie wiem nic o tym miejscu. */
export const SET_MINUTES_BY_CONTEXT: Record<GigContext, number> = { open_mic: 5, opener: 10, support: 15, headline: 30, other: 5 };
/** Bit bez wpisanej długości liczymy jako tyle minut (z „~”). */
export const DEFAULT_BIT_MIN = 2;

export type SetBit = {
  id: number;
  name: string;
  status: string;
  lengthMin: number | null;
  ups: number;
  downs: number;
  timesPlayed: number;
};

export type SetItem = { id: number; name: string; minutes: number; guessed: boolean; role: "otwarcie" | "środek" | "test" | "zamknięcie"; why: string };

/** Siła pewniaka: Sprawdzony > w testach, potem bilans 👍/👎 (👎 waży więcej) i doświadczenie na scenie. */
const strength = (b: SetBit) => (b.status === "tested" ? 100 : 0) + (b.ups - b.downs * 1.5) * 10 + Math.min(b.timesPlayed, 10);

const why = (b: SetBit) =>
  [b.status === "tested" ? "sprawdzony" : "w testach", b.timesPlayed ? `${b.ups}× 👍${b.downs ? `, ${b.downs}× 👎` : ""}` : "jeszcze niegrany"].join(" · ");

export function proposeSet(bits: SetBit[], targetMin: number) {
  const minutes = (b: SetBit) => b.lengthMin ?? DEFAULT_BIT_MIN;
  // Do testu: w testach, najmniej razy grany (świeży materiał najbardziej potrzebuje sceny). Taki, który po
  // kilku graniach ma więcej 👎 niż 👍, czeka raczej na redakcję niż na scenę.
  const test = [...bits]
    .filter((b) => b.status === "testing" && !(b.timesPlayed >= 2 && b.downs > b.ups))
    .sort((a, b) => a.timesPlayed - b.timesPlayed || a.downs - b.downs)[0];
  const strong = bits
    .filter((b) => (b.status === "tested" || b.status === "testing") && b.id !== test?.id && b.ups >= b.downs)
    .sort((a, b) => strength(b) - strength(a));

  // Czas: najpierw zostaw miejsce na test, resztę wypełnij pewniakami (bez przekraczania o więcej niż minutę).
  const budget = targetMin - (test ? minutes(test) : 0);
  const picked: SetBit[] = [];
  let used = 0;
  for (const b of strong) {
    if (used + minutes(b) > budget + 1) continue;
    picked.push(b);
    used += minutes(b);
    if (used >= budget) break;
  }
  const item = (b: SetBit, role: SetItem["role"]): SetItem => ({ id: b.id, name: b.name, minutes: minutes(b), guessed: b.lengthMin == null, role, why: why(b) });
  const [opener, closer, ...middle] = picked;
  const items: SetItem[] = [
    ...(opener ? [item(opener, "otwarcie")] : []),
    ...(test ? [item(test, "test")] : []),
    ...middle.map((b) => item(b, "środek")),
    ...(closer ? [item(closer, "zamknięcie")] : []),
  ];
  return { items, totalMin: items.reduce((s, i) => s + i.minutes, 0), targetMin };
}
