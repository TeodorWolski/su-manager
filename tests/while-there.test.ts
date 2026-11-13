import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStays, pickNearby, stationCity, type StayGig, type StayTrip } from "../src/lib/while-there";

const today = "2026-11-10";
const gig = (id: number, startsAt: string, cityName: string | null): StayGig => ({ id, title: `Granie ${id}`, startsAt, cityName });
const trip = (gigId: number | null, fromStation: string, toStation: string, departsAt: string, arrivesAt: string | null = null): StayTrip => ({
  gigId,
  fromStation,
  toStation,
  departsAt,
  arrivesAt,
});

test("stacja → miasto: najdłuższy początek nazwy, który jest na mapie", () => {
  assert.equal(stationCity("Gdańsk Główny"), "Gdańsk");
  assert.equal(stationCity("Warszawa Centralna"), "Warszawa");
  assert.equal(stationCity("Słupsk"), "Słupsk");
  assert.equal(stationCity("Xyzzy Nigdzie"), null);
});

test("granie poza domem → pobyt dzień przed i dzień po; granie w Warszawie, tuż pod Warszawą, bez miasta i minione — nic", () => {
  const stays = buildStays(
    [
      gig(1, "2026-11-20T19:00", "Słupsk"),
      gig(2, "2026-11-21T20:00", "Warszawa"),
      gig(3, "2026-11-22", null),
      gig(4, "2026-11-01T19:00", "Kraków"),
      gig(5, "2026-11-28T18:00", "Sochaczew"),
    ],
    [],
    today,
  );
  assert.deepEqual(stays, [{ city: "Słupsk", from: "2026-11-19", to: "2026-11-21", gigs: [{ id: 1, title: "Granie 1", startsAt: "2026-11-20T19:00" }] }]);
});

test("bilety przy graniu rozszerzają pobyt: przyjazd 2 dni wcześniej, powrót 3 dni po", () => {
  const [stay] = buildStays(
    [gig(1, "2026-11-20T19:00", "Słupsk")],
    [
      trip(1, "Warszawa Centralna", "Słupsk", "2026-11-18T07:00", "2026-11-18T11:30"),
      trip(1, "Słupsk", "Warszawa Centralna", "2026-11-23T07:16", "2026-11-23T11:31"),
    ],
    today,
  );
  assert.deepEqual([stay.from, stay.to], ["2026-11-18", "2026-11-23"]);
});

test("prywatna podróż: od przyjazdu do biletu powrotnego; bez powrotu — przyjazd i następny dzień; powrót do domu to nie pobyt", () => {
  const stays = buildStays(
    [],
    [
      trip(null, "Warszawa Centralna", "Gdańsk Główny", "2026-11-14T08:00", "2026-11-14T11:00"),
      trip(null, "Gdańsk Główny", "Warszawa Centralna", "2026-11-17T16:00", "2026-11-17T19:00"),
      trip(null, "Warszawa Centralna", "Kraków Główny", "2026-11-28T08:00", "2026-11-28T10:30"),
    ],
    today,
  );
  assert.deepEqual(
    stays.map((s) => [s.city, s.from, s.to, s.gigs.length]),
    [
      ["Gdańsk", "2026-11-14", "2026-11-17", 0],
      ["Kraków", "2026-11-28", "2026-11-29", 0],
    ],
  );
});

test("dwa grania w tym samym mieście dzień po dniu → jeden pobyt; okno nie zaczyna się przed dziś", () => {
  const stays = buildStays([gig(1, "2026-11-10T19:00", "Kraków"), gig(2, "2026-11-11T19:00", "Kraków")], [], today);
  assert.equal(stays.length, 1);
  assert.deepEqual([stays[0].from, stays[0].to], ["2026-11-10", "2026-11-12"]);
  assert.deepEqual(
    stays[0].gigs.map((g) => g.id),
    [1, 2],
  );
});

test("trwający pobyt (przyjechałem wczoraj, wracam pojutrze) dalej jest pobytem", () => {
  const stays = buildStays(
    [],
    [trip(null, "Warszawa Centralna", "Słupsk", "2026-11-09T07:00", "2026-11-09T11:30"), trip(null, "Słupsk", "Warszawa Centralna", "2026-11-12T07:16")],
    today,
  );
  assert.deepEqual(
    stays.map((s) => [s.from, s.to]),
    [["2026-11-10", "2026-11-12"]],
  );
});

test("wybór okazji: znajomy, potem open mic, potem najbliżej; jeden termin na komika; limit", () => {
  const c = (key: string, distanceKm: number, extra: { friend?: string; isOpenMic?: boolean; startsAt?: string } = {}) => ({
    startsAt: extra.startsAt ?? "2026-11-19T19:00",
    distanceKm,
    friend: extra.friend ?? null,
    isOpenMic: extra.isOpenMic ?? false,
    performer: { key },
  });
  const picked = pickNearby(
    [c("daleki", 50), c("bliski", 5), c("mic", 40, { isOpenMic: true }), c("kumpel", 55, { friend: "Kasia Testowa" }), c("kumpel", 10, { friend: "Kasia Testowa", startsAt: "2026-11-21T19:00" })],
    3,
  );
  assert.deepEqual(
    picked.map((p) => [p.performer.key, p.distanceKm]),
    [
      ["kumpel", 10],
      ["mic", 40],
      ["bliski", 5],
    ],
  );
});
