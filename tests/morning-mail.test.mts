/**
 * Poranny mail (src/lib/morning-mail.ts) na tymczasowej bazie: raz dziennie, „nowe od poprzedniego maila”.
 * Bez RESEND_API_KEY mail jest tylko logowany — sprawdzamy, co by poszło.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, test } from "node:test";

process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "su-mail-")), "test.db")}`;
delete process.env.RESEND_API_KEY;

const { db, events, cities } = await import("@/db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { sendMorningMail } = await import("@/lib/morning-mail");
const { getState, setState } = await import("@/lib/app-state");
const { nowLocal } = await import("@/lib/time");

const today = nowLocal().slice(0, 10);
const day = (n: number) => new Date(Date.parse(today) + n * 864e5).toISOString().slice(0, 10);
const utc = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 36e5).toISOString().replace("T", " ").slice(0, 19);
const quiet = () => {};

const event = (n: number, hoursAgo: number, source = "kupbilecik") => ({
  source,
  sourceId: `t${n}`,
  url: `https://example.com/${n}`,
  title: `Open mic testowy ${n}`,
  startsAt: `${day(10 + n)}T20:00`,
  cityName: "Warszawa",
  venueName: `Klub ${n}`,
  dedupeKey: `test-${n}`,
  firstSeenAt: utc(hoursAgo),
  lastSeenAt: utc(0),
});

before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(cities).values({ name: "Warszawa", travelMinutes: 0 });
});

test("pierwszy raz: nowe z ostatniej doby (bez przewidywanych); drugi raz tego dnia — nic", async () => {
  await db.insert(events).values([event(1, 2), event(2, 30), event(3, 1, "cykliczne")]);
  const r = await sendMorningMail({ dryRun: true, log: quiet });
  assert.equal(r.fresh, 1, "tylko wydarzenie sprzed 2 h (30 h temu i przewidywane — nie)");
  assert.equal(await getState("morning-mail"), new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }));
  assert.deepEqual(await sendMorningMail({ dryRun: true, log: quiet }), { sent: false, reason: "już dziś" });
});

test("bez kluczy Resend (np. Vercel bez env) — nic nie odhacza", async () => {
  await setState("morning-mail", "2000-01-01");
  assert.equal((await sendMorningMail({ log: quiet })).reason, "brak RESEND_API_KEY / REPORT_EMAIL");
  assert.equal(await getState("morning-mail"), "2000-01-01");
});

test("kolejny mail: tylko to, co doszło od poprzedniego (np. scraper spóźniony po mailu)", async () => {
  await setState("morning-mail-since", utc(5));
  await db.insert(events).values([event(4, 3), event(5, 8)]);
  const r = await sendMorningMail({ force: true, dryRun: true, log: quiet });
  assert.equal(r.fresh, 2, "#1 (2 h temu) i #4 (3 h temu); #5 był przed poprzednim mailem");
});
