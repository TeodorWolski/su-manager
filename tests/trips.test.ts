import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCalendar } from "../src/lib/ics";
import { gigBalance, parseZl, suggestGig, type GigForTrip } from "../src/lib/trips";

const gigs: GigForTrip[] = [
  { id: 1, title: "Open mic Słupsk", startsAt: "2026-11-04T20:00", cityName: "Słupsk" },
  { id: 2, title: "Open mic Warszawa", startsAt: "2026-11-05T19:00", cityName: "Warszawa" },
  { id: 3, title: "Gdańsk", startsAt: "2026-11-09T20:00", cityName: "Gdańsk" },
];

test("dojazd do Słupska i powrót dzień po graniu → granie w Słupsku, nie warszawskie", () => {
  const back = { fromStation: "Słupsk", toStation: "Warszawa Centralna", departsAt: "2026-11-05T07:16", arrivesAt: "2026-11-05T11:31" };
  // Granie w Warszawie tego dnia się nie liczy — to dom, bilet jest powrotem ze Słupska.
  assert.equal(suggestGig(back, gigs)?.id, 1);
  assert.equal(suggestGig({ fromStation: "Warszawa Centralna", toStation: "Słupsk", departsAt: "2026-11-04T08:00" }, gigs)?.id, 1);
});

test("podróż bez grania w pobliżu → prywatna (null); „Gdańsk Główny” pasuje do Gdańska", () => {
  assert.equal(suggestGig({ fromStation: "Warszawa Centralna", toStation: "Kraków Główny", departsAt: "2026-11-05T08:00" }, gigs), null);
  assert.equal(suggestGig({ fromStation: "Warszawa Centralna", toStation: "Gdańsk Główny", departsAt: "2026-11-08T15:00" }, gigs)?.id, 3);
});

test("kwoty i bilans wyjazdu", () => {
  assert.equal(parseZl("88,41"), 8841);
  assert.equal(parseZl("88.4 zł"), 8840);
  assert.equal(parseZl("150"), 15000);
  assert.equal(parseZl("abc"), null);
  assert.deepEqual(gigBalance(30000, [8841, 7920]), { fee: 30000, costs: 16761, balance: 13239 });
  assert.equal(gigBalance(null, []), null);
});

test("kalendarz: pociąg o 17:10 zaczyna się o 17:00 (czas zimowy = 16:00 UTC), kończy przy przyjeździe", () => {
  const ics = buildCalendar([], "https://app", [
    { id: 7, fromStation: "Łódź Fabryczna", toStation: "Warszawa Centralna", departsAt: "2026-12-01T17:10", arrivesAt: "2026-12-01T18:35", train: "IC 1234", seat: null, gigId: null, gigTitle: null },
  ]);
  assert.match(ics, /DTSTART:20261201T160000Z/);
  assert.match(ics, /DTEND:20261201T173500Z/);
  assert.match(ics, /SUMMARY:🚆 Łódź Fabryczna → Warszawa Centralna \(IC 1234\)/);
  assert.match(ics, /Odjazd 17:10/);
});
