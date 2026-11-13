import assert from "node:assert/strict";
import { test } from "node:test";
import { roundedMedian } from "../src/lib/median";
import { addDays, dayOf, daysBetween } from "../src/lib/time";

test("dayOf: sama data ze znacznika lokalnego i technicznego (UTC)", () => {
  assert.equal(dayOf("2026-10-14T20:00"), "2026-10-14");
  assert.equal(dayOf("2026-10-14 08:00:00"), "2026-10-14");
  assert.equal(dayOf("2026-10-14"), "2026-10-14");
});

test("addDays: przez granicę miesiąca, roku i zmianę czasu; godzina w znaczniku nie przesuwa dnia", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-10-24", 2), "2026-10-26", "25.10 — zmiana czasu na zimowy");
  assert.equal(addDays("2026-03-28", 2), "2026-03-30", "29.03 — zmiana czasu na letni");
  assert.equal(addDays("2026-10-14T00:30", 1), "2026-10-15");
  assert.equal(addDays("2026-10-14T23:30", -7), "2026-10-07");
});

test("daysBetween: ze znakiem, liczy dni kalendarzowe (bez godzin), też przez zmianę czasu", () => {
  assert.equal(daysBetween("2026-10-14", "2026-10-28"), 14);
  assert.equal(daysBetween("2026-10-28", "2026-10-14"), -14);
  assert.equal(daysBetween("2026-10-14T23:59", "2026-10-15T00:01"), 1);
  assert.equal(daysBetween("2026-10-14T08:00", "2026-10-14T23:00"), 0);
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
  assert.equal(daysBetween("2026-10-10 08:00:00", "2026-12-01T19:00"), 52, "UTC z bazy → lokalna data grania");
});

test("mediana zaokrąglona: nieparzysta liczba — środkowa, parzysta — średnia środkowych; nie zmienia wejścia", () => {
  assert.equal(roundedMedian([51, 39, 56]), 51);
  assert.equal(roundedMedian([10, 13]), 12, "11,5 → 12");
  assert.equal(roundedMedian([7]), 7);
  const input = [3, 1, 2];
  roundedMedian(input);
  assert.deepEqual(input, [3, 1, 2]);
});
