/**
 * Podróże: do którego grania pasuje bilet i jak wpisać pociąg do kalendarza. Czysta logika.
 */
import { normalize } from "./text";
import { daysBetween } from "./time";

/** Wpis pociągu w kalendarzu zaczyna się tyle minut przed odjazdem (17:10 → 17:00). */
export const TRAIN_CALENDAR_LEAD_MIN = 10;
/** Tu mieszkam — grania w domu nie łapią biletów (podróż z Warszawy do Krakowa to nie koszt warszawskiego open mica). */
export const HOME_CITY = "Warszawa";
/** Granie pasuje do podróży, jeśli jest najwyżej tyle dni od odjazdu / przyjazdu (dojazd dzień wcześniej, powrót dzień później). */
export const TRIP_GIG_DAYS = 1;

export type GigForTrip = { id: number; title: string; startsAt: string; cityName: string | null };

/** Odstęp w dniach bez względu na kierunek (granie dzień przed podróżą = dzień po). */
const daysApart = (a: string, b: string) => Math.abs(daysBetween(a, b));
/** „Warszawa Centralna” zawiera „Warszawa”, „Gdańsk Główny” — „Gdańsk”. */
const stationIn = (station: string, city: string) => {
  const s = normalize(station);
  const c = normalize(city);
  return s === c || s.startsWith(`${c} `);
};

/**
 * Granie, na które jest ta podróż: tego dnia albo ±1 dzień, w mieście docelowym (dojazd) albo
 * startowym (powrót), poza miastem domowym. Najbliższe w czasie wygrywa. null = pewnie prywatna podróż.
 */
export function suggestGig(trip: { fromStation: string; toStation: string; departsAt: string; arrivesAt?: string | null }, gigs: GigForTrip[]) {
  const matches = gigs
    .filter((g) => g.cityName && !stationIn(g.cityName, HOME_CITY))
    .filter((g) => stationIn(trip.toStation, g.cityName!) || stationIn(trip.fromStation, g.cityName!))
    .map((g) => ({ g, dist: Math.min(daysApart(g.startsAt, trip.departsAt), daysApart(g.startsAt, trip.arrivesAt ?? trip.departsAt)) }))
    .filter((x) => x.dist <= TRIP_GIG_DAYS)
    .sort((a, b) => a.dist - b.dist);
  return matches[0]?.g ?? null;
}

/** Bilans wyjazdu na granie: honorarium minus bilety (w groszach); null, gdy nie ma ani jednego, ani drugiego. */
export function gigBalance(feeGr: number | null, tripPricesGr: (number | null)[]) {
  const costs = tripPricesGr.reduce<number>((s, p) => s + (p ?? 0), 0);
  if (feeGr == null && !costs) return null;
  return { fee: feeGr ?? 0, costs, balance: (feeGr ?? 0) - costs };
}

/** „88,41” / „88.41 zł” / „88” → grosze; puste albo bzdura → null. */
export function parseZl(input: string | null | undefined) {
  if (!input) return null;
  const m = input.replace(/\s/g, "").replace(/zł$/i, "").match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null;
}
