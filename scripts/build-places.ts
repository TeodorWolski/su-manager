/**
 * Generuje src/data/places-pl.json — współrzędne polskich miejscowości do „Jestem w…” w Okazjach.
 * Źródło: GeoNames (CC BY 4.0), https://download.geonames.org/export/dump/PL.zip
 *
 *   curl -LO https://download.geonames.org/export/dump/PL.zip && unzip PL.zip
 *   pnpm tsx scripts/build-places.ts PL.txt
 *
 * Bierzemy miejscowości z populacją albo będące siedzibą gminy/powiatu/województwa (bez tysięcy
 * bezludnych przysiółków) + każdą, która już wystąpiła w wydarzeniach. Klucz = znormalizowana nazwa,
 * wartość = [szer., dł., nazwa z polskimi znakami]; przy powtórce wygrywa większa populacja.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { db, events } from "@/db";
import { placeKey } from "@/lib/geo";

async function main() {
  const file = process.argv[2] ?? "PL.txt";
  const rows = readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.split("\t"))
    .filter((r) => r[6] === "P");
  const eventCities = new Set(
    (await db.selectDistinct({ c: events.cityName }).from(events)).map((r) => (r.c ? placeKey(r.c) : "")),
  );

  const best = new Map<string, { lat: number; lon: number; pop: number; name: string }>();
  const put = (name: string, r: string[]) => {
    const key = placeKey(name);
    const pop = Number(r[14]) || 0;
    const prev = best.get(key);
    if (!prev || pop > prev.pop) best.set(key, { lat: Number(r[4]), lon: Number(r[5]), pop, name: r[7] === "PPLC" ? "Warszawa" : r[1] });
  };
  for (const r of rows) {
    const keep = Number(r[14]) > 0 || r[7].startsWith("PPLA") || r[7] === "PPLC" || eventCities.has(placeKey(r[1]));
    if (!keep) continue;
    put(r[1], r);
    put(r[2], r);
  }
  // GeoNames trzyma stolicę po angielsku (Warsaw) — dokładamy polską nazwę.
  const capital = rows.find((r) => r[7] === "PPLC");
  if (capital) put("Warszawa", capital);

  const out = Object.fromEntries(
    [...best.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [+v.lat.toFixed(3), +v.lon.toFixed(3), v.name]]),
  );
  writeFileSync("src/data/places-pl.json", JSON.stringify(out));
  const missing = [...eventCities].filter((c) => c && !best.has(c));
  console.log(`${best.size} miejscowości; bez współrzędnych z wydarzeń: ${missing.join(", ") || "brak"}`);
}

main();
