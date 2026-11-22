import assert from "node:assert/strict";
import { test } from "node:test";
import {
  busyEvenings,
  busyLabel,
  CALENDAR_TITLE_MAX,
  calendarDays,
  parseEvents,
  pendingEvents,
  type CalendarEvent,
  type PendingGig,
} from "../src/lib/calendar-sync";

const today = "2026-11-19";

const ev = (start: string, end: string, title = "", allDay = false): CalendarEvent => ({ start, end, title, allDay });

test("zajęty wieczór: spotkanie nachodzące na 18–23 (z tytułem); dzienne, późnonocne i całodniowe się nie liczą", () => {
  const evenings = busyEvenings(
    [
      ev("2026-11-20T19:00", "2026-11-20T21:00", "Kolacja"),
      ev("2026-11-21T10:00", "2026-11-21T12:00", "Kardiolog"),
      ev("2026-11-22T17:00", "2026-11-22T18:00"), // kończy się równo o 18 — nie zabiera wieczoru
      ev("2026-11-23T17:30", "2026-11-23T18:30"), // zahacza
      ev("2026-11-24T23:00", "2026-11-25T01:00"), // zaczyna się równo o 23
      ev("2026-11-26T00:00", "2026-11-27T00:00", "Urodziny", true),
    ],
    today,
  );
  assert.deepEqual(evenings, [
    { day: "2026-11-20", slots: ["19:00–21:00 Kolacja"] },
    { day: "2026-11-23", slots: ["17:30–18:30"] },
  ]);
});

test("kilka spotkań jednego wieczoru i wyjazd na kilka dni; nic sprzed dziś", () => {
  const evenings = busyEvenings(
    [
      ev("2026-11-20T20:30", "2026-11-20T22:00", "Dietetyk"),
      ev("2026-11-20T18:00", "2026-11-20T19:00"),
      ev("2026-11-27T15:00", "2026-11-29T12:00", "Wyjazd"),
      ev("2026-11-17T19:00", "2026-11-18T19:30"),
    ],
    today,
  );
  assert.deepEqual(evenings, [
    { day: "2026-11-20", slots: ["18:00–19:00", "20:30–22:00 Dietetyk"] },
    { day: "2026-11-27", slots: ["15:00–… Wyjazd"] },
    { day: "2026-11-28", slots: ["…–… Wyjazd"] },
  ]);
  assert.equal(busyLabel(evenings[0].slots), "w kalendarzu: 18:00–19:00, 20:30–22:00 Dietetyk");
});

test("lista dnia do mini kalendarza: wszystko, też dzienne i całodniowe; całodniowe na górze, koniec o północy nie zajmuje kolejnego dnia", () => {
  const days = calendarDays(
    [
      ev("2026-12-07T18:30", "2026-12-07T19:30", "Dietetyk"),
      ev("2026-12-09T15:45", "2026-12-09T16:30", "Kardiolog"),
      ev("2026-12-09T09:00", "2026-12-09T09:30", "Bank"),
      ev("2026-12-09T00:00", "2026-12-10T00:00", "Urodziny mamy", true),
      ev("2026-12-12T00:00", "2026-12-14T00:00", "Wyjazd", true),
      ev("2026-12-20T10:00", "2026-12-20T11:00", "Poza zakresem"),
    ],
    "2026-12-01",
    "2026-12-15",
  );
  assert.deepEqual(days, [
    { day: "2026-12-07", items: [{ time: "18:30–19:30", title: "Dietetyk" }] },
    {
      day: "2026-12-09",
      items: [
        { time: null, title: "Urodziny mamy" },
        { time: "09:00–09:30", title: "Bank" },
        { time: "15:45–16:30", title: "Kardiolog" },
      ],
    },
    { day: "2026-12-12", items: [{ time: null, title: "Wyjazd" }] },
    { day: "2026-12-13", items: [{ time: null, title: "Wyjazd" }] },
  ]);
});

test("wejście ze skryptu: tylko poprawne wydarzenia w oknie; długi tytuł przycięty; stary skrypt bez tytułów też przechodzi", () => {
  const ok = { start: "2026-11-20T19:00", end: "2026-11-20T21:00", title: "  Dietetyk ", allDay: false };
  assert.deepEqual(parseEvents("nie lista", today), []);
  assert.deepEqual(
    parseEvents(
      [
        ok,
        { start: "2026-11-20 19:00", end: "2026-11-20T21:00" }, // zły format
        { start: "2026-11-20T21:00", end: "2026-11-20T19:00" }, // koniec przed początkiem
        { start: "2026-11-01T19:00", end: "2026-11-01T21:00" }, // miniony
        { start: "2027-06-01T19:00", end: "2027-06-01T21:00" }, // za daleko
        null,
        { start: 1, end: 2 },
      ],
      today,
    ),
    [{ ...ok, title: "Dietetyk" }],
  );
  assert.deepEqual(parseEvents([{ start: "2026-11-20T19:00", end: "2026-11-20T21:00" }], today), [ev("2026-11-20T19:00", "2026-11-20T21:00")]);
  assert.equal(parseEvents([{ ...ok, title: "x".repeat(200) }], today)[0].title.length, CALENDAR_TITLE_MAX);
});

test("prośby do kalendarza „w toku”: napisałem / czekam od dziś, bez zainteresowanych i minionych; 2,5 h, granie bez godziny o 20:00", () => {
  const gig = (id: number, startsAt: string, status: string, cityName: string | null = "Lublin"): PendingGig => ({
    id,
    title: `Komik ${id}`,
    startsAt,
    status,
    cityName,
  });
  const events = pendingEvents(
    [
      gig(1, "2026-11-28T19:00", "waiting"),
      gig(2, "2026-11-21", "contacted", null),
      gig(3, "2026-11-22T19:00", "interested"),
      gig(4, "2026-11-10T19:00", "waiting"),
      gig(5, "2026-11-30T22:30", "contacted"),
    ],
    today,
    "https://app.test",
  );
  assert.deepEqual(events, [
    { id: 2, title: "❓ napisałem · Komik 2", start: "2026-11-21T20:00", end: "2026-11-21T22:30", url: "https://app.test/gigs/2" },
    { id: 1, title: "❓ czekam · Komik 1 · Lublin", start: "2026-11-28T19:00", end: "2026-11-28T21:30", url: "https://app.test/gigs/1" },
    { id: 5, title: "❓ napisałem · Komik 5 · Lublin", start: "2026-11-30T22:30", end: "2026-12-01T01:00", url: "https://app.test/gigs/5" },
  ]);
});

test("wpis w dniu zmiany czasu nie przesuwa się o godzinę (czas lokalny, bez strefy)", () => {
  const [e] = pendingEvents([{ id: 1, title: "X", startsAt: "2027-03-28T01:00", status: "waiting", cityName: null }], "2027-03-20", "");
  assert.deepEqual([e.start, e.end], ["2027-03-28T01:00", "2027-03-28T03:30"]);
});
