/**
 * Testy parserów bileterii na zapisanych (przyciętych) stronach z tests/fixtures/.
 * Łapią zepsucie parsera zmianą w kodzie. Zmianę po stronie serwisu łapie kontrola zdrowia
 * w codziennym przebiegu (src/scraper/health.ts). Odświeżenie stron: pnpm tsx scripts/update-fixtures.ts
 *
 *   pnpm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { sameShow } from "@/lib/dedupe";
import { healthIssues } from "@/scraper/health";
import { availability, biletyna } from "@/scraper/sources/biletyna";
import { evently } from "@/scraper/sources/evently";
import { fixMorning, kupbilecik } from "@/scraper/sources/kupbilecik";
import type { ScrapedEvent, SourceContext } from "@/scraper/types";

const fx = (file: string) => readFileSync(`tests/fixtures/${file}`, "utf8");
/** Kontekst parsera z „internetem” z plików: `route(url)` zwraca HTML albo "" (pusta strona). */
const ctx = (route: (url: string) => string): SourceContext => ({
  fetchHtml: async (url) => route(url),
  known: new Map(),
  until: "2099-12-31",
  log: () => {},
});
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

/** Wspólne wymagania dla każdego źródła: pola, format daty, unikalne id. */
function assertWellFormed(events: ScrapedEvent[], source: string) {
  assert.ok(events.length > 0, `${source}: brak wydarzeń`);
  for (const e of events) {
    assert.equal(e.source, source);
    assert.ok(e.sourceId, `${source}: brak id`);
    assert.ok(e.title.trim(), `${source}: brak tytułu (${e.sourceId})`);
    assert.match(e.startsAt, LOCAL_TIME, `${source}: zła data ${e.startsAt}`);
    assert.match(e.url, /^https:\/\//, `${source}: zły url ${e.url}`);
  }
  assert.equal(new Set(events.map((e) => e.sourceId)).size, events.length, `${source}: powtórzone id`);
}

describe("kupbilecik", () => {
  test("lista: kafelki z tytułem, godziną, miastem i dostępnością", async () => {
    let page = 0;
    const events = await kupbilecik.scrape(
      ctx((url) => (url.includes("/pl/standup") ? (page++ ? "<html></html>" : fx("kupbilecik-list.html")) : "")),
    );
    assertWellFormed(events, "kupbilecik");
    assert.equal(events.length, 8);
    const brudzewski = events.find((e) => e.sourceId === "206197");
    assert.deepEqual(
      { title: brudzewski?.title, startsAt: brudzewski?.startsAt, city: brudzewski?.cityName, availability: brudzewski?.availability },
      { title: "Stand-up: Maciej Brudzewski", startsAt: "2026-10-07T18:00", city: "Bielsko-Biała", availability: "sold_out" },
    );
    assert.equal(events.find((e) => e.sourceId === "204884")?.availability, "last");
    assert.equal(events.find((e) => e.sourceId === "201614")?.availability, null);
    assert.ok(events.every((e) => e.cityName && e.venueName), "każdy kafelek ma miasto i miejsce");
  });

  test("poranna godzina: bierze „Start Wydarzenia” ze strony, bez niego przed 10:00 +12 h", () => {
    assert.equal(fixMorning("2026-10-18T06:00", fx("kupbilecik-event-morning.html")), "2026-10-18T18:00");
    assert.equal(fixMorning("2026-10-10T09:00", "<p>brak</p>"), "2026-10-10T21:00");
    assert.equal(fixMorning("2026-11-21T11:00", ""), "2026-11-21T11:00");
  });
});

describe("evently", () => {
  test("listing + strona wydarzenia (schema.org)", async () => {
    let page = 0;
    const events = await evently.scrape(
      ctx((url) =>
        url.includes("/events?") ? (page++ ? "<html></html>" : fx("evently-list.html")) : url.includes("/events/15129-") ? fx("evently-event.html") : "",
      ),
    );
    assertWellFormed(events, "evently");
    const e = events.find((x) => x.sourceId === "15129");
    assert.equal(e?.startsAt, "2026-10-09T19:00");
    assert.equal(e?.cityName, "Kraków");
    assert.doesNotMatch(e?.title ?? "", /Evently\s*$/, "tytuł bez doklejonego „- Evently”");
  });
});

describe("biletyna", () => {
  test("sitemap → strona programu → terminy ze schema.org", async () => {
    const fetched: string[] = [];
    const events = await biletyna.scrape(
      ctx((url) => {
        fetched.push(url);
        if (url.endsWith("sitemap-events.xml")) return fx("biletyna-sitemap.xml");
        return url.includes("/stand-up/Piotr-Baltroczyk") ? fx("biletyna-program.html") : "";
      }),
    );
    assertWellFormed(events, "biletyna");
    assert.equal(events.length, 30);
    assert.ok(!fetched.some((u) => u.includes("/ajax/")), "nie dotykamy /ajax/ (robots.txt)");
    // Strona programu ma 30 terminów (limit Biletyny), ostatni przed horyzontem → dociąga 3 strony miast.
    assert.equal(fetched.filter((u) => u.includes("/stand-up/")).length, 4, "program + strony miast przy pełnej stronie");
    const first = events.find((e) => e.sourceId === "580077");
    assert.deepEqual(
      { startsAt: first?.startsAt, city: first?.cityName, venue: first?.venueName, url: first?.url },
      {
        startsAt: "2026-10-09T19:00",
        city: "Ostrzeszów",
        venue: "Ostrzeszowskie Centrum Kultury",
        url: "https://biletyna.pl/stand-up/Piotr-Baltroczyk?eid=580077",
      },
    );
  });

  test("dostępność z liczby wolnych miejsc", () => {
    assert.equal(availability({ remainingAttendeeCapacity: 66 }), null);
    assert.equal(availability({ remainingAttendeeCapacity: 7 }), "last");
    assert.equal(availability({ remainingAttendeeCapacity: 0 }), "sold_out");
    assert.equal(availability({ offers: { availability: "https://schema.org/SoldOut" } }), "sold_out");
  });

  test("pełna strona sięgająca za horyzont — bez dociągania miast", async () => {
    const fetched: string[] = [];
    await biletyna.scrape({
      ...ctx((url) => {
        fetched.push(url);
        return url.endsWith(".xml") ? fx("biletyna-sitemap.xml") : fx("biletyna-program.html");
      }),
      until: "2026-11-01",
    });
    assert.equal(fetched.filter((u) => u.includes("/stand-up/")).length, 1);
  });

  test("pusta sitemapa = głośny błąd (zmiana formatu), a nie cicha pustka", async () => {
    await assert.rejects(biletyna.scrape(ctx(() => "<urlset></urlset>")), /pusta sitemapa/);
  });
});

describe("duplikaty między serwisami", () => {
  const s = (title: string, startsAt: string, cityName = "Kraków") => ({ title, startsAt, cityName, performers: null });
  test("ten sam występ pod innym tytułem", () => {
    assert.ok(sameShow(s("Piotr Bałtroczyk", "2026-10-09T19:00", "Ostrzeszów"), s("Piotr Bałtroczyk Stand-up", "2026-10-09T19:00", "Ostrzeszów")));
    assert.ok(sameShow(s("Pan Li", "2026-11-13T19:00", "Szczecin"), s("Pan Li - Seans Spirytustyczny", "2026-11-13T19:00", "Szczecin")));
  });
  test("różne występy tego samego wieczoru zostają osobno", () => {
    assert.ok(!sameShow(s("Stand-up: Ewa Stasiewicz", "2026-10-17T18:00"), s("Kraków Stand-up Festival™ 2026", "2026-10-17T20:00")));
    assert.ok(!sameShow(s("Stand-up Open Mic", "2026-10-25T19:00"), s("Stand-up Open Mic Lublin:", "2026-10-25T19:00")));
    assert.ok(!sameShow(s("Piotr Bałtroczyk", "2026-10-09T19:00"), s("Piotr Bałtroczyk", "2026-10-09T22:30")), "inna godzina");
  });
});

describe("kontrola zdrowia przebiegu", () => {
  const ev = (over: Partial<ScrapedEvent> = {}): ScrapedEvent => ({
    source: "x",
    sourceId: "1",
    url: "https://x",
    title: "t",
    startsAt: "2026-10-10T19:00",
    cityName: "Kraków",
    venueName: "v",
    performers: null,
    ...over,
  });
  test("zdrowy przebieg — bez uwag", () => {
    assert.deepEqual(healthIssues("x", Array.from({ length: 50 }, () => ev()), 55), []);
  });
  test("nagły spadek liczby wydarzeń", () => {
    assert.match(healthIssues("x", Array.from({ length: 10 }, () => ev()), 100).join(), /spadek/);
  });
  test("zniknęły miasta albo godziny (zmienił się HTML)", () => {
    assert.match(healthIssues("x", Array.from({ length: 50 }, () => ev({ cityName: null })), 50).join(), /miasta/);
    assert.match(healthIssues("x", Array.from({ length: 50 }, () => ev({ startsAt: "2026-10-10" })), 50).join(), /godzin/);
  });
});
