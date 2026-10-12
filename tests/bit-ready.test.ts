import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readyBits, type BitPlay } from "../src/lib/bit-ready";

const bit = (id: number, status = "testing", createdAt = "2026-10-02 10:00:00") => ({ id, name: `Bit ${id}`, status, lengthMin: 2, createdAt });
const play = (bitId: number, gigId: number, day: number, reaction: number | null): BitPlay => ({
  bitId,
  gigId,
  startsAt: `2026-10-${String(day).padStart(2, "0")}T20:00`,
  reaction,
});

describe("gotowy do zaliczenia", () => {
  test("3× 👍 z różnych grań i bez 👎 na końcu → gotowy", () => {
    const r = readyBits([bit(1)], [play(1, 1, 3, 1), play(1, 2, 5, 0), play(1, 3, 7, 1), play(1, 4, 9, 1)], "2026-10");
    assert.deepEqual(r, [{ id: 1, name: "Bit 1", lengthMin: 2, thumbs: 3, thisMonth: true }]);
  });

  test("za mało 👍 albo 👎 w ostatnich dwóch → nie", () => {
    const plays = [play(1, 1, 3, 1), play(1, 2, 5, 1), play(2, 1, 3, 1), play(2, 2, 5, 1), play(2, 3, 7, 1), play(2, 4, 9, -1)];
    assert.deepEqual(readyBits([bit(1), bit(2)], plays, "2026-10"), []);
  });

  test("👎 dawno temu nie przeszkadza; grania bez reakcji pomijane", () => {
    const plays = [play(1, 1, 1, -1), play(1, 2, 3, 1), play(1, 3, 5, 1), play(1, 4, 7, 1), play(1, 5, 9, null)];
    assert.equal(readyBits([bit(1)], plays, "2026-10").length, 1);
  });

  test("sprawdzony / odrzucony się nie pojawia; bit z innego miesiąca → thisMonth false", () => {
    const plays = [1, 2, 3].flatMap((g) => [play(1, g, g, 1), play(2, g, g, 1), play(3, g, g, 1)]);
    const r = readyBits([bit(1, "tested"), bit(2, "rejected"), bit(3, "editing", "2026-09-10 10:00:00")], plays, "2026-10");
    assert.deepEqual(r.map((b) => [b.id, b.thisMonth]), [[3, false]]);
  });
});
