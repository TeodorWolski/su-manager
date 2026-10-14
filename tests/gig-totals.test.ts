import assert from "node:assert/strict";
import { test } from "node:test";
import { gigTotals, playedGroups, totalKind, type PlayedGig } from "../src/lib/gig-totals";

const g = (context: PlayedGig["context"], startsAt: string, extra: Partial<PlayedGig> = {}): PlayedGig => ({
  context,
  startsAt,
  headlinerId: null,
  venueId: null,
  cityName: null,
  ...extra,
});

test("licznik występów: podział na typy, rok, miasta, sceny, komicy", () => {
  const t = gigTotals(
    [
      g("open_mic", "2025-11-03T20:00", { venueId: 1, cityName: "Warszawa" }),
      g("open_mic", "2026-02-10T20:00", { venueId: 1, cityName: "warszawa" }),
      g("opener", "2026-03-01T19:00", { headlinerId: 7, venueId: 2, cityName: "Łódź" }),
      g("opener", "2026-04-01T19:00", { headlinerId: 7, venueId: 3, cityName: "Kraków" }),
      g("support", "2026-05-01T19:00", { headlinerId: 9 }),
      g("headline", "2026-06-01"),
      g("other", "2026-07-01"),
      g(null, "2026-08-01"),
    ],
    "2026-10-15",
  );
  assert.equal(t.total, 8);
  assert.equal(t.thisYear, 7);
  assert.deepEqual(t.byKind, { open_mic: 2, opener: 2, support: 1, headline: 1, other: 2 });
  assert.equal(t.noContext, 1);
  assert.equal(t.cities, 3, "Warszawa / warszawa to jedno miasto");
  assert.equal(t.venues, 3);
  assert.equal(t.headliners, 2);
  assert.equal(t.first, "2025-11-03T20:00");
});

test("pusto", () => {
  const t = gigTotals([], "2026-10-15");
  assert.equal(t.total, 0);
  assert.equal(t.first, null);
});

test("listy z licznika: miasta, sceny, komicy — najczęstsze najpierw", () => {
  const played = [
    g("open_mic", "2026-02-10T20:00", { venueId: 1, venueName: "Klub A", cityName: "Warszawa" }),
    g("opener", "2026-03-01T19:00", { venueId: 2, venueName: "Klub B", cityName: "warszawa", headlinerId: 7, headlinerName: "Kasia" }),
    g("support", "2026-04-01T19:00", { venueId: 2, venueName: "Klub B", cityName: "Łódź", headlinerId: 7, headlinerName: "Kasia" }),
    g("open_mic", "2026-05-01T19:00", { headlinerId: 9, headlinerName: "Nie liczy się", cityName: "Łódź" }),
  ];
  assert.deepEqual(playedGroups(played, "cities").map((c) => [c.key, c.count]), [["łódź", 2], ["warszawa", 2]]);
  assert.deepEqual(playedGroups(played, "venues").map((v) => [v.name, v.count, v.last]), [["Klub B", 2, "2026-04-01T19:00"], ["Klub A", 1, "2026-02-10T20:00"]]);
  assert.deepEqual(playedGroups(played, "headliners").map((h) => [h.key, h.name, h.count]), [["7", "Kasia", 2]]);
  assert.equal(totalKind(null), "other");
  assert.equal(totalKind("support"), "support");
});
