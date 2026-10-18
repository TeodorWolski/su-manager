import assert from "node:assert/strict";
import { test } from "node:test";
import { myGigForEvent, type DayGig } from "../src/lib/dedupe";

const gig = (id: number, title: string, startsAt: string, extra: Partial<DayGig> = {}): DayGig => ({
  id,
  title,
  startsAt,
  headlinerId: null,
  cityName: "Warszawa",
  ...extra,
});
const ev = (title: string, startsAt: string) => ({ title, startsAt, cityName: "Warszawa" });

test("inne granie tego dnia w tym samym mieście to nie „Twoje granie” — da się dodać kolejne", () => {
  const mine = [gig(1, "Open mic Świetlica Wolności", "2026-10-20T18:00")];
  const r = myGigForEvent(mine, ev("Stand-up Lokal: Bartek Zajda", "2026-10-20T21:00"), []);
  assert.equal(r.mine, null);
  assert.deepEqual(r.others.map((g) => g.id), [1]);
});

test("ten sam występ (sameShow) albo ten sam komik o tej porze → moje", () => {
  const mine = [gig(1, "Open mic Świetlica Wolności", "2026-10-20T18:00"), gig(2, "Przed Kasią", "2026-10-20T20:00", { headlinerId: 7 })];
  assert.equal(myGigForEvent(mine, ev("Open Mic — Świetlica Wolności", "2026-10-20T18:30"), []).mine?.id, 1);
  const r = myGigForEvent(mine, ev("Kasia Testowa — nowy program", "2026-10-20T20:30"), [7]);
  assert.equal(r.mine?.id, 2);
  assert.deepEqual(r.others.map((g) => g.id), [1]);
});

test("ten sam komik dwa razy jednego wieczoru: drugi pokaz to nie moje granie", () => {
  const mine = [gig(2, "Przed Kasią", "2026-10-20T18:00", { headlinerId: 7 })];
  assert.equal(myGigForEvent(mine, ev("Kasia Testowa", "2026-10-20T20:30"), [7]).mine, null);
});

test("inny dzień — nic", () => {
  const r = myGigForEvent([gig(1, "Open mic", "2026-10-21T18:00")], ev("Open mic", "2026-10-20T18:00"), []);
  assert.equal(r.mine, null);
  assert.equal(r.others.length, 0);
});
