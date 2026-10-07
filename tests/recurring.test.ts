import assert from "node:assert/strict";
import { describe as suite, test } from "node:test";
import { buildSeries, describe, detectInterval, project, RECURRING_SOURCE, seriesKey } from "@/lib/recurring";

suite("wykrywanie rytmu", () => {
  test("co tydzień (Środowy Stand-up Open Mic, Kraków)", () => {
    assert.equal(detectInterval(["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"]), "w1");
  });
  test("co tydzień z jedną dziurą", () => {
    assert.equal(detectInterval(["2026-10-07", "2026-10-14", "2026-10-28", "2026-11-04"]), "w1");
  });
  test("co 2 tygodnie (Stand-up w Norze)", () => {
    assert.equal(detectInterval(["2026-10-08", "2026-10-22", "2026-11-05", "2026-11-19"]), "w2");
  });
  test("pierwsza środa miesiąca", () => {
    assert.equal(detectInterval(["2026-10-07", "2026-11-04", "2026-12-02"]), "m");
  });
  test("nieregularne i za mało terminów — nie", () => {
    assert.equal(detectInterval(["2026-10-07", "2026-10-15", "2026-10-19", "2026-10-26"]), null, "różne dni tygodnia");
    assert.equal(detectInterval(["2026-10-07", "2026-10-14"]), null, "dwa terminy to za mało");
    assert.equal(detectInterval(["2026-10-07", "2026-10-14", "2026-11-04"]), null, "7 i 21 dni — za mało pewności");
  });
});

suite("rozpisywanie terminów", () => {
  test("co tydzień zachowuje fazę i godzinę", () => {
    assert.deepEqual(project("w1", "2026-10-07T19:00", "2026-10-20", "2026-11-05"), [
      "2026-10-21T19:00",
      "2026-10-28T19:00",
      "2026-11-04T19:00",
    ]);
  });
  test("co 2 tygodnie od starej kotwicy", () => {
    assert.deepEqual(project("w2", "2026-09-10T20:00", "2026-10-07", "2026-11-07"), ["2026-10-08T20:00", "2026-10-22T20:00", "2026-11-05T20:00"]);
  });
  test("co miesiąc: pierwsza środa", () => {
    assert.deepEqual(project("m", "2026-10-07T19:00", "2026-10-08", "2027-01-10"), ["2026-11-04T19:00", "2026-12-02T19:00", "2027-01-06T19:00"]);
  });
  test("opisy po polsku", () => {
    assert.equal(describe("w1", "2026-10-07T19:00"), "co środę, 19:00");
    assert.equal(describe("w2", "2026-10-06T20:00"), "co 2 tygodnie we wtorek, 20:00");
    assert.equal(describe("m", "2026-10-07"), "w każdą pierwszą środę miesiąca");
    assert.equal(describe("m", "2026-10-05"), "w każdy pierwszy poniedziałek miesiąca");
  });
});

suite("serie z wydarzeń i moich decyzji", () => {
  const ev = (id: number, startsAt: string, title = "Środowy Stand-Up & Open Mic", source = "kupbilecik") => ({
    id,
    source,
    title,
    cityName: "Kraków",
    venueName: "Pub 103,8 FM",
    url: `https://x/${id}`,
    startsAt,
  });
  const weekly = [ev(1, "2026-09-30T19:00"), ev(2, "2026-10-07T19:00"), ev(3, "2026-10-14T19:00")];

  test("wykryta seria przewiduje kolejne środy, bez dni z prawdziwym terminem", () => {
    const [s] = buildSeries(weekly, [], "2026-10-08");
    assert.equal(s.how, "auto");
    assert.equal(s.interval, "w1");
    assert.equal(s.predicted[0], "2026-10-21T19:00");
    assert.ok(!s.predicted.some((d) => d.startsWith("2026-10-14")), "14.10 jest w bileterii");
  });
  test("przewidywane terminy nie liczą się do wykrywania", () => {
    const onlyPredicted = [ev(1, "2026-10-07T19:00", undefined, RECURRING_SOURCE), ev(2, "2026-10-14T19:00", undefined, RECURRING_SOURCE), ev(3, "2026-10-21T19:00", undefined, RECURRING_SOURCE)];
    assert.equal(buildSeries(onlyPredicted, [], "2026-10-08").length, 0);
  });
  test("„to nie jest cykliczne” wyłącza wykrytą serię", () => {
    const key = seriesKey(weekly[0]);
    assert.equal(buildSeries(weekly, [{ key, mode: "off", interval: null, title: "", cityName: null, venueName: null, url: null, anchor: null }], "2026-10-08").length, 0);
  });
  test("ręcznie oznaczona seria z jednego terminu", () => {
    const one = [ev(9, "2026-10-12T20:00", "Open mic w Klubie X")];
    const key = seriesKey(one[0]);
    const [s] = buildSeries(one, [{ key, mode: "manual", interval: "w2", title: "Open mic w Klubie X", cityName: "Kraków", venueName: "Pub 103,8 FM", url: null, anchor: "2026-10-12T20:00" }], "2026-10-08");
    assert.equal(s.how, "manual");
    assert.deepEqual(s.predicted.slice(0, 2), ["2026-10-26T20:00", "2026-11-09T20:00"]);
  });
  test("wygasła wykryta seria (ostatni termin dawno) — bez przewidywań", () => {
    const old = [ev(1, "2026-07-01T19:00"), ev(2, "2026-07-08T19:00"), ev(3, "2026-07-15T19:00")];
    assert.equal(buildSeries(old, [], "2026-10-08").length, 0);
  });
});

suite("co 4 tygodnie vs co miesiąc", () => {
  test("seria wędrująca po miesiącu = co 4 tygodnie", () => {
    // 1.10 (1. czw.), 29.10 (5. czw.), 26.11 (4. czw.)
    assert.equal(detectInterval(["2026-10-01", "2026-10-29", "2026-11-26"]), "w4");
  });
});

suite("przewidywanie tylko naprzód", () => {
  test("nie przed pierwszym znanym terminem ani w lukach", () => {
    const ev = (id: number, startsAt: string) => ({ id, source: "kupbilecik", title: "Stand-up: X", cityName: "Warszawa", venueName: "Klub", url: "", startsAt });
    const [s] = buildSeries([ev(1, "2026-10-15T19:00"), ev(2, "2026-10-22T19:00"), ev(3, "2026-10-29T19:00")], [], "2026-10-07");
    assert.equal(s.predicted[0], "2026-11-05T19:00");
  });
});
