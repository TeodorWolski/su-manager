import assert from "node:assert/strict";
import { test } from "node:test";
import {
  busyLabel,
  isRoutine,
  routineKey,
  CALENDAR_TITLE_MAX,
  calendarDays,
  overlapping,
  parseEvents,
  pendingEvents,
  type CalendarEvent,
  type PendingGig,
} from "../src/lib/calendar-sync";

const today = "2026-11-19";

const ev = (start: string, end: string, title = "", allDay = false): CalendarEvent => ({ start, end, title, allDay });

test("kolizje z oknem grania: spotkania nachodzące na okno (z tytułem); stykające się i całodniowe nie", () => {
  const evening = { from: "2026-11-20T18:00", to: "2026-11-20T23:00" };
  const events = [
    ev("2026-11-20T19:00", "2026-11-20T21:00", "Kolacja"),
    ev("2026-11-20T10:00", "2026-11-20T12:00", "Kardiolog"),
    ev("2026-11-20T17:00", "2026-11-20T18:00"), // kończy się równo, gdy zaczyna się wieczór
    ev("2026-11-20T17:30", "2026-11-20T18:30"), // zahacza
    ev("2026-11-20T23:00", "2026-11-21T01:00"), // zaczyna się równo z końcem
    ev("2026-11-20T00:00", "2026-11-21T00:00", "Urodziny", true),
  ];
  assert.deepEqual(
    overlapping(events, evening).map((s) => s.label),
    ["17:30–18:30", "19:00–21:00 Kolacja"],
  );
  assert.deepEqual(overlapping(events, evening)[1], { label: "19:00–21:00 Kolacja", title: "Kolacja" });
  assert.equal(busyLabel(overlapping(events, evening)), "w kalendarzu: 17:30–18:30, 19:00–21:00 Kolacja");
});

test("rutyna po tytule: bez względu na wielkość liter, ogonki i spacje; wpis bez tytułu nigdy nie jest rutyną", () => {
  const routines = new Set([routineKey("Siłownia  rano")]);
  assert.equal(isRoutine({ title: "siłownia rano" }, routines), true);
  assert.equal(isRoutine({ title: "SILOWNIA RANO" }, routines), true);
  assert.equal(isRoutine({ title: "Siłownia z Kubą" }, routines), false);
  assert.equal(isRoutine({ title: "" }, new Set([""])), false);
});

test("kolizje z wyjazdem: popołudniowa wizyta i ranne spotkanie następnego dnia (z datą)", () => {
  const trip = { from: "2026-12-09T15:10", to: "2026-12-10T12:00" };
  const events = [
    ev("2026-12-09T15:45", "2026-12-09T16:30", "Kardiolog"),
    ev("2026-12-10T09:00", "2026-12-10T10:00", "Bank"),
    ev("2026-12-10T13:00", "2026-12-10T14:00", "Po powrocie"),
  ];
  assert.deepEqual(
    overlapping(events, trip).map((s) => s.label),
    ["15:45–16:30 Kardiolog", "10.12 09:00–10:00 Bank"],
  );
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
    new Set([routineKey("BANK")]),
  );
  assert.deepEqual(days, [
    { day: "2026-12-07", items: [{ time: "18:30–19:30", title: "Dietetyk", routine: false }] },
    {
      day: "2026-12-09",
      items: [
        { time: null, title: "Urodziny mamy", routine: false },
        { time: "09:00–09:30", title: "Bank", routine: true },
        { time: "15:45–16:30", title: "Kardiolog", routine: false },
      ],
    },
    { day: "2026-12-12", items: [{ time: null, title: "Wyjazd", routine: false }] },
    { day: "2026-12-13", items: [{ time: null, title: "Wyjazd", routine: false }] },
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
  const gig = (id: number, startsAt: string, status: string, cityName: string | null = "Warszawa"): PendingGig => ({
    id,
    title: `Komik ${id}`,
    startsAt,
    status,
    cityName,
    travelMinutes: 0,
    hasLodging: false,
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
    { id: 1, title: "❓ czekam · Komik 1 · Warszawa", start: "2026-11-28T19:00", end: "2026-11-28T21:30", url: "https://app.test/gigs/1" },
    { id: 5, title: "❓ napisałem · Komik 5 · Warszawa", start: "2026-11-30T22:30", end: "2026-12-01T01:00", url: "https://app.test/gigs/5" },
  ]);
});

test("wpis w dniu zmiany czasu nie przesuwa się o godzinę (czas lokalny, bez strefy)", () => {
  const [e] = pendingEvents([{ id: 1, title: "X", startsAt: "2027-03-28T01:00", status: "waiting", cityName: null, travelMinutes: null, hasLodging: false }], "2027-03-20", "");
  assert.deepEqual([e.start, e.end], ["2027-03-28T01:00", "2027-03-28T03:30"]);
});

test("prośba o granie poza Warszawą zajmuje w kalendarzu cały wyjazd, z dopiskiem „(wyjazd)”", () => {
  const [e] = pendingEvents(
    [{ id: 7, title: "Stand-up", startsAt: "2026-12-09T19:00", status: "waiting", cityName: "Gdańsk", travelMinutes: 170, hasLodging: true }],
    today,
    "https://app.test",
  );
  assert.deepEqual([e.title, e.start, e.end], ["❓ czekam · Stand-up · Gdańsk (wyjazd)", "2026-12-09T15:10", "2026-12-10T12:00"]);
});
