import assert from "node:assert/strict";
import { test } from "node:test";
import { describeWindow, gigWindow } from "../src/lib/away";
import { buildCalendar, type CalendarGig } from "../src/lib/ics";
import { addMinutes } from "../src/lib/time";

const gig = (startsAt: string, cityName: string | null, travelMinutes: number | null = null, hasLodging = false) => ({
  startsAt,
  cityName,
  travelMinutes,
  hasLodging,
});

test("addMinutes: czas lokalny bez strefy, przez północ i zmianę czasu bez przesunięcia", () => {
  assert.equal(addMinutes("2026-12-09T19:00", -230), "2026-12-09T15:10");
  assert.equal(addMinutes("2026-12-09T23:00", 90), "2026-12-10T00:30");
  assert.equal(addMinutes("2027-03-28T01:00", 150), "2027-03-28T03:30");
  assert.equal(addMinutes("2026-12-09", 0), "2026-12-09T20:00", "sama data = granie o 20:00");
});

test("Warszawa i okolice: wieczór 18–23 (dłuższy, gdy scena wcześnie albo późno); miasto spoza mapy też", () => {
  assert.deepEqual(gigWindow(gig("2026-12-09T19:00", "Warszawa")), { from: "2026-12-09T18:00", to: "2026-12-09T23:00", away: false, overnight: false });
  assert.deepEqual(gigWindow(gig("2026-12-09T17:00", "Sochaczew", 45)).from, "2026-12-09T16:00");
  assert.deepEqual(gigWindow(gig("2026-12-09T21:30", "Warszawa")).to, "2026-12-10T00:00");
  assert.equal(gigWindow(gig("2026-12-09T19:00", "Xyzzy")).away, false);
});

test("Gdańsk z noclegiem: wyjazd po południu (dojazd + godzina przed sceną), powrót następnego dnia — kardiolog o 15:45 w środku", () => {
  const w = gigWindow(gig("2026-12-09T19:00", "Gdańsk", 170, true));
  assert.deepEqual(w, { from: "2026-12-09T15:10", to: "2026-12-10T12:00", away: true, overnight: true });
  assert.equal(describeWindow(w, "Gdańsk"), "wyjazd (Gdańsk): od 15:10, powrót 10.12 ok. 12:00");
});

test("Łódź bez noclegu: powrót tego samego wieczoru; bez czasu dojazdu — szacunek z odległości", () => {
  assert.deepEqual(gigWindow(gig("2026-12-09T19:00", "Łódź", 75)), { from: "2026-12-09T16:45", to: "2026-12-09T22:45", away: true, overnight: false });
  const guessed = gigWindow(gig("2026-12-09T19:00", "Łódź"));
  assert.ok(guessed.away && guessed.from < "2026-12-09T17:00" && guessed.from > "2026-12-09T16:00", guessed.from);
});

test("bilety wygrywają z szacunkiem: od odjazdu (z dojazdem na dworzec) do przyjazdu z powrotem", () => {
  const w = gigWindow(gig("2026-12-09T19:00", "Gdańsk", 170, true), [
    { departsAt: "2026-12-09T12:05", arrivesAt: "2026-12-09T14:50" },
    { departsAt: "2026-12-10T08:10", arrivesAt: "2026-12-10T11:01" },
  ]);
  assert.deepEqual(w, { from: "2026-12-09T11:35", to: "2026-12-10T11:01", away: true, overnight: true });
  const sameNight = gigWindow(gig("2026-12-09T19:00", "Łódź", 75), [{ departsAt: "2026-12-09T21:40", arrivesAt: "2026-12-09T23:05" }]);
  assert.deepEqual([sameNight.to, sameNight.overnight], ["2026-12-09T23:05", false]);
});

test("feed kalendarza: granie poza Warszawą dostaje wpis „🧳 Wyjazd” na cały czas poza domem; w Warszawie nie", () => {
  const base: Omit<CalendarGig, "id" | "title" | "cityName" | "travelMinutes" | "hasLodging"> = {
    startsAt: "2026-12-09T19:00",
    venueName: null,
    url: null,
    notes: null,
    headlinerName: null,
    context: "opener",
  };
  const ics = buildCalendar(
    [
      { ...base, id: 1, title: "Stand-up w Gdańsku", cityName: "Gdańsk", travelMinutes: 170, hasLodging: true },
      { ...base, id: 2, title: "Open mic", cityName: "Warszawa", travelMinutes: 0, hasLodging: false },
    ],
    "https://app",
  ).replace(/\r\n /g, "");
  assert.match(ics, /UID:away-1@su-manager\r\nDTSTAMP:\d+T\d+Z\r\nDTSTART:20261209T141000Z\r\nDTEND:20261210T110000Z/);
  assert.match(ics, /SUMMARY:🧳 Wyjazd: Gdańsk \(Stand-up w Gdańsku\)/);
  assert.doesNotMatch(ics, /UID:away-2@/);
});
