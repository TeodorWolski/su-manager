/**
 * Podpowiedź „ten bit jest już sprawdzony” — do MGM liczy się tylko status „Sprawdzony”,
 * a łatwo zapomnieć go przestawić. Bit (nie sprawdzony i nie odrzucony) jest gotowy, gdy:
 * - ma min. READY_THUMBS 👍 z różnych grań,
 * - wśród ostatnich READY_RECENT ocenionych grań nie ma 👎.
 * Tylko podpowiedź z przyciskiem — status zmieniam sam. Czysta logika (dane: getMgm w planning.ts).
 */
import { localMonth } from "./mgm";

export const READY_THUMBS = 3;
export const READY_RECENT = 2;

export type ReadyInputBit = { id: number; name: string; status: string; lengthMin: number | null; createdAt: string };
export type BitPlay = { bitId: number; gigId: number; startsAt: string; reaction: number | null };

export function readyBits(bitList: ReadyInputBit[], plays: BitPlay[], month: string) {
  return bitList
    .filter((b) => b.status !== "tested" && b.status !== "rejected")
    .flatMap((b) => {
      const rated = plays
        .filter((p) => p.bitId === b.id && p.reaction != null)
        .sort((x, y) => y.startsAt.localeCompare(x.startsAt));
      const thumbs = new Set(rated.filter((p) => p.reaction === 1).map((p) => p.gigId)).size;
      if (thumbs < READY_THUMBS || rated.slice(0, READY_RECENT).some((p) => p.reaction === -1)) return [];
      // Minuty wejdą do MGM miesiąca, w którym bit założono — nie zawsze bieżącego.
      return [{ id: b.id, name: b.name, lengthMin: b.lengthMin, thumbs, thisMonth: localMonth(b.createdAt) === month }];
    })
    .sort((x, y) => y.thumbs - x.thumbs);
}

export type ReadyBit = ReturnType<typeof readyBits>[number];
