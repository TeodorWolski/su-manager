import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { followUpTiming } from "@/lib/follow-up";

describe("kiedy ponowić", () => {
  // Granie daleko: 15.11; ostatni ruch 1.10.
  test("„napisałem” — dopiero ~10 dni przed graniem", () => {
    assert.deepEqual(followUpTiming("2026-11-15T20:00", "2026-10-01", "2026-10-07", "contacted"), { remindOn: "2026-11-05", due: false });
  });
  test("„czekam” — po 5 dniach ciszy, choć granie daleko", () => {
    assert.deepEqual(followUpTiming("2026-11-15T20:00", "2026-10-01", "2026-10-07", "waiting"), { remindOn: "2026-10-06", due: true });
    assert.equal(followUpTiming("2026-11-15T20:00", "2026-10-04", "2026-10-07", "waiting").due, false, "3 dni ciszy to jeszcze za wcześnie");
  });
  test("„czekam” przy bliskim graniu — wcześniejszy z progów (10 dni przed, min. 2 dni ciszy)", () => {
    assert.equal(followUpTiming("2026-10-15T20:00", "2026-10-04", "2026-10-07", "waiting").remindOn, "2026-10-06");
  });
});
