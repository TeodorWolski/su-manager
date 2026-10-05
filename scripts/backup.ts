/**
 * Pełny zrzut bazy do pliku .sql (schemat + dane), który da się odtworzyć:
 *   sqlite3 odtworzona.db < backup.sql              — lokalnie
 *   turso db shell <baza> < backup.sql              — w Turso (do pustej bazy)
 * Uruchom: pnpm backup <plik.sql>   (baza z DATABASE_URL / DATABASE_AUTH_TOKEN)
 * Co tydzień robi to GitHub Actions (.github/workflows/backup.yml).
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { createClient, type InValue } from "@libsql/client";

const out = process.argv[2] ?? `backup-${new Date().toISOString().slice(0, 10)}.sql`;
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

function literal(v: InValue): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    return `X'${Buffer.from(v as ArrayBuffer).toString("hex")}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function main() {
  const schema = await client.execute(
    "select type, name, sql from sqlite_master where sql is not null and name not like 'sqlite_%' and name not like '_litestream%' order by case type when 'table' then 0 else 1 end, name",
  );
  const tables = schema.rows.filter((r) => r.type === "table").map((r) => String(r.name));
  const lines = [
    `-- SU Manager — kopia z ${new Date().toISOString()}`,
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
  ];

  const counts: Record<string, number> = {};
  for (const r of schema.rows.filter((r) => r.type === "table")) lines.push(`${r.sql};`);
  for (const table of tables) {
    const rows = await client.execute(`select * from ${quoteIdent(table)}`);
    counts[table] = rows.rows.length;
    const cols = rows.columns.map(quoteIdent).join(", ");
    for (const row of rows.rows) {
      const values = rows.columns.map((_, i) => literal(row[i] as InValue)).join(", ");
      lines.push(`INSERT INTO ${quoteIdent(table)} (${cols}) VALUES (${values});`);
    }
  }
  // liczniki AUTOINCREMENT — żeby nowe wiersze po odtworzeniu nie dostały starych ID
  const seq = await client.execute("select name, seq from sqlite_sequence").catch(() => null);
  for (const r of seq?.rows ?? []) {
    lines.push(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (${literal(r.name as InValue)}, ${literal(r.seq as InValue)});`);
  }
  for (const r of schema.rows.filter((r) => r.type !== "table")) lines.push(`${r.sql};`);
  lines.push("COMMIT;", "");

  writeFileSync(out, lines.join("\n"));
  console.log(`zapisano ${out}`);
  console.log(Object.entries(counts).map(([t, n]) => `  ${t}: ${n}`).join("\n"));
}

main();
