import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildLeadTimes, DEFAULT_LEAD_DAYS, leadLabel, type LeadRecord } from "@/lib/lead-time";

// Rozmowa: komik, granie, ile dni przed napisałem, wynik.
const r = (contactId: number | null, before: number, outcome: string, context = "opener"): LeadRecord => {
  const gig = "2026-12-01";
  const first = new Date(Date.parse(gig) - before * 864e5).toISOString().slice(0, 10);
  return { contactId, context, gigDate: gig, firstMessage: first, outcome };
};

describe("z jakim wyprzedzeniem pisać", () => {
  test("bez danych — domyślne 14 dni", () => {
    const l = buildLeadTimes([]);
    assert.deepEqual(l.leadFor(1, "opener"), { days: DEFAULT_LEAD_DAYS, personal: false, agreed: 0, taken: 0 });
  });

  test("komik z 2 zgodami — mediana jego zgód", () => {
    const l = buildLeadTimes([r(1, 20, "agreed"), r(1, 24, "agreed")]);
    assert.deepEqual(l.leadFor(1, "opener"), { days: 22, personal: true, agreed: 2, taken: 0 });
  });

  test("„ktoś zajął miejsce” przy 18 dniach → pisać min. 21 dni przed", () => {
    const l = buildLeadTimes([r(2, 12, "agreed"), r(2, 18, "slot_taken")]);
    assert.equal(l.leadFor(2, "opener").days, 21);
  });

  test("odmowa i ghosting nie mówią nic o czasie", () => {
    const l = buildLeadTimes([r(3, 30, "declined"), r(3, 2, "ghosted"), r(3, 10, "agreed")]);
    assert.equal(l.leadFor(3, "opener").personal, false, "1 rozmowa z czasem to za mało na własne wyprzedzenie");
  });

  test("ogólne wyprzedzenie z ≥5 rozmów, osobno open miki", () => {
    const records = [
      ...[18, 20, 21, 22, 25].map((d, i) => r(10 + i, d, "agreed")),
      ...[5, 6, 7, 8, 9].map((d) => r(null, d, "agreed", "open_mic")),
    ];
    const l = buildLeadTimes(records);
    assert.equal(l.leadFor(99, "opener").days, 21, "nowy komik → ogólne dla grań przed komikiem");
    assert.equal(l.leadFor(null, "open_mic").days, 7, "open mic → ogólne dla open miców");
  });

  test("etykiety", () => {
    assert.equal(leadLabel(21), "~3 tyg.");
    assert.equal(leadLabel(10), "~10 dni");
  });
});
