/**
 * Testy powiadomień (src/lib/notify.ts) na prawdziwej, tymczasowej bazie SQLite:
 * migracje z drizzle/, dane z datami względem „dziś”, wywołanie notifications("morning" | "evening").
 * Każdy plik testów biegnie w osobnym procesie, więc DATABASE_URL ustawiony tu nie rusza local.db.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, test } from "node:test";

process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "su-notify-")), "test.db")}`;

const { db, gigs, gigLogs, interactions, writingSessions, contacts, events, cities } = await import("@/db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { notifications } = await import("@/lib/notify");
const { nowLocal } = await import("@/lib/time");

const today = nowLocal().slice(0, 10);
const day = (n: number) => new Date(Date.parse(today) + n * 864e5).toISOString().slice(0, 10);
/** Lokalny czas „teraz − minuty” w formacie grań ("YYYY-MM-DDTHH:mm"). */
const minutesAgo = (m: number) => nowLocal(-m);

before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});

describe("poranne powiadomienia", () => {
  test("„czekam” po 5 dniach ciszy → do ponowienia; „napisałem” z daleka — jeszcze nie", async () => {
    const [{ id: waitingId }] = await db
      .insert(gigs)
      .values({ title: "TEST czekam", startsAt: `${day(30)}T20:00`, status: "waiting", statusChangedAt: `${day(-6)}T12:00` })
      .returning({ id: gigs.id });
    await db.insert(interactions).values({ gigId: waitingId, date: day(-6), channel: "Instagram" });
    const [{ id: contactedId }] = await db
      .insert(gigs)
      .values({ title: "TEST napisałem", startsAt: `${day(30)}T20:00`, status: "contacted", statusChangedAt: `${day(-6)}T12:00` })
      .returning({ id: gigs.id });
    await db.insert(interactions).values({ gigId: contactedId, date: day(-6), channel: "Instagram" });

    const n = (await notifications("morning")).find((x) => x.tag === "followups");
    assert.ok(n, "jest powiadomienie o ponowieniu");
    assert.match(n.title, /Do ponowienia: 1 granie/);
    assert.match(n.body, /TEST czekam/);
    assert.match(n.body, /spróbuj FB/, "następny kanał po IG");
    assert.equal(n.url, `/gigs/${waitingId}`);
  });

  test("„zainteresowany” (domyślne wyprzedzenie): 14 i 7 dni przed, zbiorczo; za 20 dni — nie; raz na próg", async () => {
    const [{ id: contactId }] = await db.insert(contacts).values({ name: "Rafał Testowy", role: "comedian" }).returning({ id: contacts.id });
    await db.insert(gigs).values([
      { title: "TEST za 10 dni", startsAt: `${day(10)}T19:00`, status: "interested", headlinerId: contactId },
      { title: "TEST za 5 dni", startsAt: `${day(5)}T20:00`, status: "interested" },
      { title: "TEST za 20 dni", startsAt: `${day(20)}T20:00`, status: "interested" },
    ]);
    // Nowy dzień = nowy przebieg; kasujemy znacznik porannego „do ponowienia” z poprzedniego testu nie trzeba — inny tag.
    const first = (await notifications("morning")).find((x) => x.tag === "write");
    assert.ok(first, "jest „napisz”");
    assert.match(first.title, /Ostatni dzwonek — napisz: 2 grania/);
    assert.match(first.body, /TEST za 5 dni/);
    assert.match(first.body, /Rafał Testowy/, "przy graniu przed kimś — nazwisko headlinera");
    assert.doesNotMatch(first.body, /za 20 dni/);
    assert.equal(first.url, "/gigs?view=pipeline");

    const second = (await notifications("morning")).find((x) => x.tag === "write");
    assert.equal(second, undefined, "ten sam dzień — bez powtórki");
  });

  test("„zainteresowany”: komik z wyuczonym wyprzedzeniem (3 tyg.) — przypomnienie już za 20 dni", async () => {
    const [{ id: early }] = await db.insert(contacts).values({ name: "Kasia Wcześniejsza", role: "comedian" }).returning({ id: contacts.id });
    // Dwie zgody, gdy pisałem 21 dni przed — własne wyprzedzenie 21 dni.
    for (const back of [60, 120]) {
      const [{ id }] = await db
        .insert(gigs)
        .values({ title: "TEST stare", startsAt: `${day(-back)}T20:00`, status: "confirmed", outcome: "agreed", headlinerId: early, skipReview: true })
        .returning({ id: gigs.id });
      await db.insert(interactions).values({ gigId: id, contactId: early, date: day(-back - 21), channel: "Instagram" });
    }
    await db.insert(gigs).values([
      { title: "TEST Kasia za 20 dni", startsAt: `${day(20)}T20:00`, status: "interested", headlinerId: early },
      { title: "TEST inny za 19 dni", startsAt: `${day(19)}T20:00`, status: "interested" },
    ]);
    const n = (await notifications("morning")).find((x) => x.tag === "write");
    assert.ok(n, "jest „napisz”");
    assert.match(n.title, /^Napisz: 1 granie/, "przy 20 dniach to pierwszy próg, nie ostatni dzwonek");
    assert.match(n.body, /Kasia Wcześniejsza/);
    assert.doesNotMatch(n.body, /inny za 19 dni/, "bez danych — dalej 14 dni");
  });
});

describe("nowe terminy komików z CRM", () => {
  test("nowe daty w zasięgu → „Nowe terminy”; dalekie, ukryte i stare pomijane; drugi raz nic", async () => {
    await db.insert(cities).values([
      { name: "Łódź", travelMinutes: 80 },
      { name: "Szczecin", travelMinutes: 330 },
    ]);
    const [{ id: czarek }] = await db.insert(contacts).values({ name: "Czarek Sikora", role: "comedian" }).returning({ id: contacts.id });
    await db.insert(contacts).values({ name: "Ukryty Komik", role: "comedian", ignoreInReport: true });
    const utcAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString().replace("T", " ").slice(0, 19);
    const ev = (n: number, title: string, city: string, firstSeenH: number) => ({
      source: "kupbilecik",
      sourceId: `nd${n}`,
      url: `https://example.com/${n}`,
      title,
      startsAt: `${day(20 + n)}T19:00`,
      cityName: city,
      dedupeKey: `nd-${n}`,
      firstSeenAt: utcAgo(firstSeenH),
      lastSeenAt: utcAgo(0),
    });
    // Poprzednie sprawdzenie dobę temu (wcześniejsze testy porannych przesunęły znacznik na „teraz”).
    const { setState } = await import("@/lib/app-state");
    await setState("push-new-dates-since", utcAgo(24));
    await db.insert(events).values([
      ev(1, "Stand-up: Czarek Sikora", "Łódź", 2),
      ev(2, "Stand-up: Czarek Sikora", "Łódź", 3),
      ev(3, "Stand-up: Czarek Sikora", "Szczecin", 2), // poza zasięgiem
      ev(4, "Stand-up: Czarek Sikora", "Łódź", 72), // stary — sprzed poprzedniego sprawdzenia
      ev(5, "Stand-up: Ukryty Komik", "Łódź", 1), // pomijany w Okazjach
    ]);
    const n = (await notifications("morning")).find((x) => x.tag === "new-dates");
    assert.ok(n, "jest „Nowe terminy”");
    assert.equal(n.title, "🎟️ Nowe terminy: Czarek Sikora");
    assert.match(n.body, /Czarek Sikora: 2 \(najbliżej .+ Łódź\)/);
    assert.equal(n.url, `/contacts/${czarek}`);
    assert.equal((await notifications("morning")).find((x) => x.tag === "new-dates"), undefined, "drugi przebieg — nic nowego");
  });
});

describe("wieczorne powiadomienia", () => {
  test("trening puent: jest dziś → nic; nie ma → przypomnienie, raz dziennie", async () => {
    const [{ id }] = await db.insert(writingSessions).values({ date: today, kind: "punchlines" }).returning({ id: writingSessions.id });
    assert.equal((await notifications("evening")).find((x) => x.tag === "punchlines"), undefined, "trening zrobiony");

    await db.delete(writingSessions).where(eq(writingSessions.id, id));
    const n = (await notifications("evening")).find((x) => x.tag === "punchlines");
    assert.ok(n, "brak treningu → przypomnienie");
    assert.equal(n.url, "/writing");
    assert.equal((await notifications("evening")).find((x) => x.tag === "punchlines"), undefined, "drugi raz tego dnia — nie");
  });

  test("ocena występu: 90 min po starcie potwierdzonego grania bez logu", { skip: minutesAgo(120).slice(0, 10) !== today && "tuż po północy" }, async () => {
    const [{ id: oldGig }] = await db
      .insert(gigs)
      .values({ title: "TEST zagrane 2h temu", startsAt: minutesAgo(120), status: "confirmed" })
      .returning({ id: gigs.id });
    await db.insert(gigs).values({ title: "TEST trwa (30 min)", startsAt: minutesAgo(30), status: "confirmed" });
    const [{ id: logged }] = await db
      .insert(gigs)
      .values({ title: "TEST z logiem", startsAt: minutesAgo(150), status: "confirmed" })
      .returning({ id: gigs.id });
    await db.insert(gigLogs).values({ gigId: logged, rating: 4 });

    const reviews = (await notifications("evening")).filter((x) => x.tag?.startsWith("review-"));
    assert.deepEqual(reviews.map((r) => r.url), [`/gigs/${oldGig}/log`], "tylko granie sprzed 90+ min bez logu");
  });
});
