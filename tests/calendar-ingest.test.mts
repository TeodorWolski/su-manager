/**
 * /api/ingest/calendar na tymczasowej bazie: token, zapis wydarzeń z kalendarza i prośby „w toku” w odpowiedzi.
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
const { loadBusyEvenings, loadCalendarDays } = await import("@/lib/calendar-data");
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
  await db.insert(gigs).values([
    { title: "Czekam na odpowiedź", startsAt: `${day(5)}T19:00`, status: "waiting", cityId: lublin.id },
    { title: "Tylko pomysł", startsAt: `${day(6)}T19:00`, status: "interested" },
    { title: "Zaklepane", startsAt: `${day(7)}T19:00`, status: "confirmed" },
  ]);
});

test("bez tokenu albo ze złym — 401, nic nie zapisane", async () => {
  assert.equal((await call({ events: [] }, "zly")).status, 401);
  assert.equal((await loadBusyEvenings()).size, 0);
});

test("zapisuje wydarzenia i oddaje prośby „w toku” (bez zainteresowanych i potwierdzonych)", async () => {
  const res = await call({
    events: [
      { start: `${day(3)}T19:00`, end: `${day(3)}T21:00`, title: "Dietetyk", allDay: false },
      { start: `${day(4)}T09:00`, end: `${day(4)}T10:00`, title: "Kardiolog", allDay: false },
    ],
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual([body.events, body.busyEvenings], [2, 1]);
  assert.deepEqual(
    body.pending.map((p: { title: string; start: string; url: string }) => [p.title, p.start, p.url.replace(/\d+$/, "N")]),
    [["❓ czekam · Czekam na odpowiedź · Lublin", `${day(5)}T19:00`, "https://app.test/gigs/N"]],
  );
  assert.deepEqual([...(await loadBusyEvenings()).entries()], [[day(3), ["19:00–21:00 Dietetyk"]]]);
  assert.deepEqual(
    (await loadCalendarDays(day(0), day(10))).map((d) => [d.day, d.items.map((i) => i.title)]),
    [
      [day(3), ["Dietetyk"]],
      [day(4), ["Kardiolog"]],
    ],
  );
});

test("poprzednia wersja skryptu (same godziny w `busy`) dalej działa", async () => {
  assert.equal((await call({ busy: [{ start: `${day(3)}T19:00`, end: `${day(3)}T21:00` }] })).status, 200);
  assert.deepEqual([...(await loadBusyEvenings()).entries()], [[day(3), ["19:00–21:00"]]]);
});

test("kolejna synchronizacja zastępuje listę — odwołane spotkanie znika", async () => {
  await call({ events: [] });
  assert.equal((await loadBusyEvenings()).size, 0);
  assert.equal((await loadCalendarDays(day(0), day(10))).length, 0);
});

test("zły kształt danych — 400", async () => {
  assert.equal((await call({ cos: 1 })).status, 400);
});
