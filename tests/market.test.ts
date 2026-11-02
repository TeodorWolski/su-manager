import assert from "node:assert/strict";
import { test } from "node:test";
import { announceLead, rankHeadliners, type MarketEvent } from "../src/lib/market";

const ev = (key: string, startsAt: string, extra: Partial<MarketEvent> = {}): MarketEvent => ({
  key,
  name: key,
  contactId: null,
  startsAt,
  cityName: "Warszawa",
  inRange: true,
  availability: null,
  firstSeenAt: "2026-10-10 08:00:00",
  ...extra,
});

test("ogłaszanie: mediana dni od pojawienia się w bileterii; wydarzenia z pierwszych dni scrapera pomijane", () => {
  const scrapeStart = "2026-10-05 17:00:00";
  const events = [
    ev("a", "2026-12-10T19:00", { firstSeenAt: "2026-10-05 17:10:00" }), // było wcześniej — nie liczymy
    ev("a", "2026-12-01T19:00", { firstSeenAt: "2026-10-11 09:00:00" }), // 51 dni
    ev("a", "2026-11-20T19:00", { firstSeenAt: "2026-10-12 09:00:00" }), // 39 dni
    ev("a", "2026-12-15T19:00", { firstSeenAt: "2026-10-20 09:00:00" }), // 56 dni
  ];
  assert.deepEqual(announceLead(events, scrapeStart), { days: 51, samples: 3, beyondHorizon: false });
  assert.equal(announceLead(events.slice(0, 3), scrapeStart), null, "za mało ogłoszeń widzianych na żywo");
});

test("ranking: wyprzedający w zasięgu na górze; daleki i ukryty niżej / wcale; pojedynczy termin pomijany", () => {
  const events = [
    ev("hit", "2026-11-20T19:00", { availability: "sold_out", contactId: 1 }),
    ev("hit", "2026-11-25T19:00", { availability: "last", contactId: 1 }),
    ev("hit", "2026-12-02T19:00", { contactId: 1 }),
    ev("daleko", "2026-11-21T19:00", { availability: "sold_out", inRange: false, cityName: "Szczecin" }),
    ev("daleko", "2026-11-22T19:00", { availability: "sold_out", inRange: false, cityName: "Szczecin" }),
    ev("cisza", "2026-11-23T19:00"),
    ev("cisza", "2026-11-24T19:00"),
    ev("raz", "2026-11-26T19:00", { availability: "sold_out" }),
    ev("ukryty", "2026-11-27T19:00", { availability: "sold_out" }),
    ev("ukryty", "2026-11-28T19:00", { availability: "sold_out" }),
  ];
  const r = rankHeadliners(events, { today: "2026-11-02", scrapeStart: "2026-10-05 17:00:00", playedBefore: new Set(), hidden: new Set(["ukryty"]) });
  assert.deepEqual(
    r.map((h) => h.key),
    ["hit", "cisza", "daleko"],
  );
  assert.equal(r[0].soldOut, 1);
  assert.equal(r[0].last, 1);
  assert.equal(r[0].inRange, 3);
  assert.deepEqual(r[0].nextInRange, { startsAt: "2026-11-20T19:00", cityName: "Warszawa" });
});

test("już grałem przed nim → trochę niżej niż równy, przed którym nie grałem", () => {
  const events = [
    ev("x", "2026-11-20T19:00", { contactId: 1, availability: "last" }),
    ev("x", "2026-11-21T19:00", { contactId: 1 }),
    ev("y", "2026-11-20T19:00", { contactId: 2, availability: "last" }),
    ev("y", "2026-11-21T19:00", { contactId: 2 }),
  ];
  const r = rankHeadliners(events, { today: "2026-11-02", scrapeStart: "2026-10-05", playedBefore: new Set([1]), hidden: new Set() });
  assert.deepEqual(r.map((h) => [h.key, h.playedBefore]), [["y", false], ["x", true]]);
});

test("terminy pojawiające się na granicy horyzontu scrapera (90 dni) → „ponad 3 mies.”, nie 90 dni", async () => {
  const { announceLabel } = await import("../src/lib/market");
  const a = announceLead(
    [
      ev("z", "2027-01-20T19:00", { firstSeenAt: "2026-10-22 09:00:00" }), // 90 dni — granica
      ev("z", "2027-01-25T19:00", { firstSeenAt: "2026-10-27 09:00:00" }), // 90
      ev("z", "2026-12-01T19:00", { firstSeenAt: "2026-10-20 09:00:00" }), // 42 — ogłoszony wcześniej, niż weszło w horyzont
    ],
    "2026-10-05 17:00:00",
  );
  assert.equal(a?.beyondHorizon, true);
  assert.equal(announceLabel(a!), "ponad 3 mies.");
  assert.equal(announceLabel({ days: 30, beyondHorizon: false }), "~4 tyg.");
});
