import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeMgm, DEFAULT_MGM_MIN, localMonth } from "@/lib/mgm";

describe("MGM — materiał napisany w miesiącu", () => {
  const b = (createdAt: string, status: string, lengthMin: number | null) => ({ createdAt, status, lengthMin });
  const bits = [
    b("2026-10-02 10:00:00", "tested", 3),
    b("2026-10-05 10:00:00", "testing", 2),
    b("2026-10-06 10:00:00", "vomit", null), // bez długości — liczy się jako bit, nie minuty
    b("2026-10-07 10:00:00", "rejected", 4), // odrzucony — nie liczy się
    b("2026-09-10 10:00:00", "tested", 6),
    b("2026-08-10 10:00:00", "editing", 1),
  ];

  test("bieżący miesiąc: sprawdzone vs niesprawdzone, bez odrzuconych", () => {
    const m = computeMgm(bits, new Map(), "2026-10-15");
    assert.deepEqual(
      { tested: m.tested, untested: m.untested, total: m.total, bits: m.bits, noLength: m.noLength, target: m.target, isSet: m.isSet },
      { tested: 3, untested: 2, total: 5, bits: 3, noLength: 1, target: DEFAULT_MGM_MIN, isSet: false },
    );
  });

  test("cel z ustawień, historia i seria miesięcy", () => {
    const m = computeMgm(bits, new Map([["2026-10", 4], ["2026-09", 5], ["2026-08", 2]]), "2026-10-15");
    assert.equal(m.target, 4);
    assert.deepEqual(m.history.map((h) => [h.month, h.total, h.hit]), [["2026-09", 6, true], ["2026-08", 1, false]]);
    assert.equal(m.streak, 2, "październik (5 ≥ 4) + wrzesień (6 ≥ 5), sierpień przerywa");
  });

  test("miesiąc po czasie warszawskim, nie UTC", () => {
    assert.equal(localMonth("2026-10-31 23:30:00"), "2026-11"); // 00:30 1 listopada w Warszawie
    assert.equal(localMonth("2026-10-31 21:00:00"), "2026-10");
  });
});
