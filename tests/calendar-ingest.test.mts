/**
 * /api/ingest/calendar na tymczasowej bazie: token, zapis wydarzeń z kalendarza, kolizje z graniami i prośby „w toku”.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, test } from "node:test";
import { NextRequest } from "next/server";

process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "su-cal-")), "test.db")}`;
process.env.CRON_SECRET = "sekret-testowy";
process.env.APP_URL = "https://app.test";

const { db, gigs, cities } = await import("@/db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { POST } = await import("@/app/api/ingest/calendar/route");
const { loadCalendarDays, loadGigConflicts } = await import("@/lib/calendar-data");
const { getState } = await import("@/lib/app-state");
const { addDays, nowLocal } = await import("@/lib/time");

const today = nowLocal().slice(0, 10);
const day = (n: number) => addDays(today, n);

const call = (body: unknown, token = "sekret-testowy") =>
  POST(
    new NextRequest("https://app.test/api/ingest/calendar", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  const [lublin] = await db.insert(cities).values({ name: "Lublin", travelMinutes: 150 }).returning();
  const [gdansk] = await db.insert(cities).values({ name: "Gdańsk", travelMinutes: 170, hasLodging: true }).returning();
  const [warszawa] = await db.insert(cities).values({ name: "Warszawa", travelMinutes: 0 }).returning();
  await db.insert(gigs).values([
    { title: "Czekam na odpowiedź", startsAt: `${day(5)}T19:00`, status: "waiting", cityId: lublin.id },
    { title: "Tylko pomysł", startsAt: `${day(6)}T19:00`, status: "interested" },
    { title: "Zaklepane w Gdańsku", startsAt: `${day(7)}T19:00`, status: "confirmed", cityId: gdansk.id },
    { title: "Open mic w Warszawie", startsAt: `${day(3)}T19:00`, status: "confirmed", cityId: warszawa.id },
  ]);
});

test("bez tokenu albo ze złym — 401, nic nie zapisane", async () => {
  assert.equal((await call({ events: [] }, "zly")).status, 401);
  assert.equal((await loadCalendarDays(day(0), day(10))).length, 0);
});

test("zapisuje wydarzenia, liczy kolizje (wieczór w Warszawie, popołudnie przy wyjeździe) i oddaje prośby „w toku”", async () => {
  const res = await call({
    events: [
      { start: `${day(3)}T18:30`, end: `${day(3)}T19:30`, title: "Dietetyk", allDay: false },
      { start: `${day(4)}T09:00`, end: `${day(4)}T10:00`, title: "Fryzjer", allDay: false },
      { start: `${day(7)}T15:45`, end: `${day(7)}T16:30`, title: "Kardiolog", allDay: false },
    ],
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual([body.events, body.conflicts], [3, 2]);
  assert.deepEqual(
    body.pending.map((p: { title: string; start: string; end: string; url: string }) => [p.title, p.start, p.end, p.url.replace(/\d+$/, "N")]),
    [["❓ czekam · Czekam na odpowiedź · Lublin (wyjazd)", `${day(5)}T15:30`, `${day(6)}T00:00`, "https://app.test/gigs/N"]],
  );
  assert.deepEqual(
    (await loadGigConflicts()).map((c) => [c.gig.title, c.window.away, c.slots]),
    [
      ["Open mic w Warszawie", false, ["18:30–19:30 Dietetyk"]],
      ["Zaklepane w Gdańsku", true, ["15:45–16:30 Kardiolog"]],
    ],
  );
  assert.deepEqual(
    (await loadCalendarDays(day(0), day(10))).map((d) => [d.day, d.items.map((i) => i.title)]),
    [
      [day(3), ["Dietetyk"]],
      [day(4), ["Fryzjer"]],
      [day(7), ["Kardiolog"]],
    ],
  );
});

test("bez urządzenia (i kluczy push) kolizja nie jest odhaczana — push pójdzie przy kolejnej synchronizacji", async () => {
  delete process.env.VAPID_PRIVATE_KEY;
  assert.equal((await loadGigConflicts()).length, 2);
  assert.equal(await getState("calendar-conflicts-notified"), "[]");
});

test("poprzednia wersja skryptu (same godziny w `busy`) dalej działa", async () => {
  assert.equal((await call({ busy: [{ start: `${day(3)}T19:00`, end: `${day(3)}T21:00` }] })).status, 200);
  assert.deepEqual(
    (await loadGigConflicts()).map((c) => c.slots),
    [["19:00–21:00"]],
  );
});

test("kolejna synchronizacja zastępuje listę — odwołane spotkanie znika", async () => {
  await call({ events: [] });
  assert.equal((await loadGigConflicts()).length, 0);
  assert.equal((await loadCalendarDays(day(0), day(10))).length, 0);
});

test("zły kształt danych — 400", async () => {
  assert.equal((await call({ cos: 1 })).status, 400);
});
