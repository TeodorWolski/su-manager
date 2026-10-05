/**
 * Słownik miast: czas dojazdu z Warszawy (najszybszy pociąg/bus, w minutach).
 * Wartości orientacyjne — popraw w aplikacji w zakładce „Miasta”.
 * Uruchom: pnpm db:seed (idempotentne — nie nadpisuje istniejących miast).
 */
import "dotenv/config";
import { db, cities } from "./index";

type Seed = { name: string; travelMinutes: number; hasLodging?: boolean; priority?: number };

const SEED: Seed[] = [
  { name: "Warszawa", travelMinutes: 0, priority: 1 },
  { name: "Kraków", travelMinutes: 140, hasLodging: true, priority: 2 },
  { name: "Gdańsk", travelMinutes: 170, hasLodging: true, priority: 2 },
  { name: "Słupsk", travelMinutes: 300, hasLodging: true, priority: 2 },
  { name: "Sopot", travelMinutes: 180, priority: 2 },
  { name: "Gdynia", travelMinutes: 190, priority: 2 },
  // okolice Warszawy
  { name: "Legionowo", travelMinutes: 25 },
  { name: "Pruszków", travelMinutes: 20 },
  { name: "Piaseczno", travelMinutes: 30 },
  { name: "Wołomin", travelMinutes: 30 },
  { name: "Otwock", travelMinutes: 35 },
  { name: "Grodzisk Mazowiecki", travelMinutes: 35 },
  { name: "Mińsk Mazowiecki", travelMinutes: 35 },
  { name: "Skierniewice", travelMinutes: 40 },
  { name: "Żyrardów", travelMinutes: 45 },
  { name: "Sochaczew", travelMinutes: 45 },
  { name: "Siedlce", travelMinutes: 60 },
  { name: "Ciechanów", travelMinutes: 60 },
  { name: "Wyszków", travelMinutes: 60 },
  { name: "Pułtusk", travelMinutes: 70 },
  // do ~3h
  { name: "Łódź", travelMinutes: 75 },
  { name: "Kutno", travelMinutes: 70 },
  { name: "Radom", travelMinutes: 90 },
  { name: "Działdowo", travelMinutes: 90 },
  { name: "Ostrów Mazowiecka", travelMinutes: 90 },
  { name: "Puławy", travelMinutes: 100 },
  { name: "Tomaszów Mazowiecki", travelMinutes: 110 },
  { name: "Włocławek", travelMinutes: 110 },
  { name: "Płock", travelMinutes: 120 },
  { name: "Ostrołęka", travelMinutes: 120 },
  { name: "Iława", travelMinutes: 120 },
  { name: "Konin", travelMinutes: 120 },
  { name: "Piotrków Trybunalski", travelMinutes: 120 },
  { name: "Lublin", travelMinutes: 130 },
  { name: "Białystok", travelMinutes: 140 },
  { name: "Kielce", travelMinutes: 150 },
  { name: "Katowice", travelMinutes: 150 },
  { name: "Częstochowa", travelMinutes: 150 },
  { name: "Malbork", travelMinutes: 150 },
  { name: "Łomża", travelMinutes: 150 },
  { name: "Poznań", travelMinutes: 160 },
  { name: "Toruń", travelMinutes: 160 },
  { name: "Olsztyn", travelMinutes: 170 },
  { name: "Bydgoszcz", travelMinutes: 180 },
  { name: "Elbląg", travelMinutes: 180 },
  { name: "Gliwice", travelMinutes: 175 },
  // poza zasięgiem — wpisane, żeby filtr nie pytał o nie co dzień
  { name: "Rzeszów", travelMinutes: 220 },
  { name: "Wrocław", travelMinutes: 225 },
  { name: "Opole", travelMinutes: 220 },
  { name: "Szczecin", travelMinutes: 330 },
  { name: "Zakopane", travelMinutes: 330 },
];

async function main() {
  const rows = SEED.map((c) => ({
    name: c.name,
    travelMinutes: c.travelMinutes,
    hasLodging: c.hasLodging ?? false,
    priority: c.priority ?? 3,
  }));
  await db.insert(cities).values(rows).onConflictDoNothing();
  console.log(`Seeded up to ${rows.length} cities.`);
}

main();
