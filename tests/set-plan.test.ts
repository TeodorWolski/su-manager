import assert from "node:assert/strict";
import { test } from "node:test";
import { proposeSet, type SetBit } from "../src/lib/set-plan";

const bit = (id: number, status: string, lengthMin: number | null, ups = 0, downs = 0, timesPlayed = ups + downs): SetBit => ({
  id,
  name: `Bit ${id}`,
  status,
  lengthMin,
  ups,
  downs,
  timesPlayed,
});

test("5 min: najmocniejszy na otwarcie, test w środku, drugi na zamknięcie", () => {
  const set = proposeSet(
    [bit(1, "tested", 2, 4), bit(2, "tested", 1, 6), bit(3, "testing", 1, 1, 0), bit(4, "testing", 2, 0, 0, 0), bit(5, "vomit", 1)],
    5,
  );
  assert.deepEqual(
    set.items.map((i) => [i.id, i.role]),
    [
      [2, "otwarcie"],
      [4, "test"],
      [1, "zamknięcie"],
    ],
  );
  assert.equal(set.totalMin, 5);
});

test("odrzucone, drafty i bity na minusie nie wchodzą; bez długości = ~2 min", () => {
  const set = proposeSet([bit(1, "tested", null, 3), bit(2, "testing", 3, 0, 3, 3), bit(3, "rejected", 1, 9), bit(4, "editing", 1, 5)], 10);
  assert.deepEqual(set.items.map((i) => i.id), [1]);
  assert.equal(set.items[0].guessed, true);
  assert.equal(set.totalMin, 2);
});

test("dłuższy set: pewniaki do limitu (max +1 min)", () => {
  const bits = [1, 2, 3, 4, 5, 6].map((i) => bit(i, "tested", 3, 10 - i));
  const set = proposeSet(bits, 10);
  assert.ok(set.totalMin <= 11);
  assert.equal(set.items[0].id, 1);
  assert.equal(set.items.at(-1)!.id, 2);
});
