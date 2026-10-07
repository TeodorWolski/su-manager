import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dayStreak, editQueue, fixedBits, weekDots, weekStreak, type BitReaction, type SessionLite } from "@/lib/writing";

describe("trening puent — seria dni", () => {
  const days = new Set(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
  test("dziś jeszcze nie — seria trwa od wczoraj", () => {
    assert.deepEqual(dayStreak(days, "2026-10-07"), { streak: 4, doneToday: false, best: 4 });
  });
  test("dziś zrobione — liczy się dziś", () => {
    assert.equal(dayStreak(new Set([...days, "2026-10-07"]), "2026-10-07").streak, 5);
  });
  test("dzień przerwy zrywa serię", () => {
    assert.equal(dayStreak(days, "2026-10-08").streak, 0);
  });
  test("kropki tygodnia pon–niedz", () => {
    const dots = weekDots(days, "2026-10-07"); // środa
    assert.equal(dots.length, 7);
    assert.deepEqual(dots.slice(0, 3).map((d) => d.done), [true, true, false]); // pon 5.10, wt 6.10, śr 7.10
    assert.ok(dots[3].future);
  });
});

describe("generowanie / redakcja — cel tygodniowy", () => {
  const s = (date: string, kind: SessionLite["kind"] = "edit"): SessionLite => ({ date, kind, bitId: null });
  test("seria tygodni z celem 2", () => {
    const sessions = [s("2026-09-22"), s("2026-09-24"), s("2026-09-29"), s("2026-10-01"), s("2026-10-06")];
    assert.equal(weekStreak(sessions, "edit", "2026-10-07"), 2, "dwa poprzednie tygodnie, bieżący jeszcze 1/2");
    assert.equal(weekStreak([...sessions, s("2026-10-07")], "edit", "2026-10-07"), 3);
  });
});

describe("kolejka redakcji i zamknięte pętle", () => {
  const r = (bitId: number, gigDate: string, reaction: number): BitReaction => ({ bitId, name: `bit${bitId}`, docUrl: null, gigDate, reaction });
  const reactions = [r(1, "2026-10-01T20:00", -1), r(2, "2026-10-02T20:00", 1), r(3, "2026-09-20T20:00", 0), r(3, "2026-10-03T20:00", 1)];
  test("👎/😐 bez redakcji po graniu trafia do kolejki", () => {
    assert.deepEqual(editQueue(reactions, []).map((q) => q.bitId), [1]);
  });
  test("redakcja po graniu zdejmuje z kolejki, przed graniem — nie", () => {
    assert.deepEqual(editQueue(reactions, [{ date: "2026-10-02", kind: "edit", bitId: 1 }]).map((q) => q.bitId), []);
    assert.deepEqual(editQueue(reactions, [{ date: "2026-09-30", kind: "edit", bitId: 1 }]).map((q) => q.bitId), [1]);
  });
  test("poprawka siadła: 😐 → redakcja → 👍", () => {
    assert.deepEqual(fixedBits(reactions, [{ date: "2026-09-25", kind: "edit", bitId: 3 }]).map((f) => f.bitId), [3]);
    assert.deepEqual(fixedBits(reactions, []).length, 0, "bez redakcji to nie zasługa poprawki");
  });
});

describe("raport do Claude", async () => {
  const { writingReport } = await import("@/lib/writing-report");
  test("prośba na górze, regularność, premisy, pomysły i bity ze sceną", () => {
    const md = writingReport({
      from: "2026-09-10",
      to: "2026-10-07",
      days: 28,
      streak: 3,
      best: 5,
      sessions: [
        { date: "2026-10-05", kind: "punchlines", bitName: null, note: "teściowa na Tinderze" },
        { date: "2026-10-06", kind: "edit", bitName: "Tinder", note: null },
      ],
      ideas: [{ text: "kolejka w Żabce o 6 rano", createdAt: "2026-10-06 08:00:00" }],
      bits: [
        {
          name: "Tinder",
          status: "editing",
          lengthMin: 3,
          docUrl: "https://notion.so/tinder",
          notes: null,
          queued: true,
          sessions: [{ date: "2026-10-06", kind: "edit" }],
          stage: [{ date: "2026-10-01T20:00", where: "Resort", context: "open_mic", reaction: -1, rating: 3, thoughts: "puenta o swipe nie siadła" }],
        },
      ],
    });
    assert.match(md, /^Jestem komikiem stand-upowym/);
    assert.match(md, /Pomóż mi:/);
    assert.match(md, /Trening puent: 1\/28 dni · obecna seria: 3 dni \(rekord 5\)/);
    assert.match(md, /05\.10: teściowa na Tinderze/);
    assert.match(md, /kolejka w Żabce/);
    assert.match(md, /### Tinder ⚠ czeka na redakcję po scenie/);
    assert.match(md, /01\.10 \(Resort, Open mic, bit: 👎, cały występ: 3\/5\) — notatka po występie: „puenta o swipe nie siadła”/);
  });
});
