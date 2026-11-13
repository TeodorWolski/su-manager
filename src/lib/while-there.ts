/**
 * „Skoro już jedziesz”: mam potwierdzone granie poza domem albo prywatną podróż — co jeszcze gra
 * w okolicy w dniach, kiedy tam jestem (i dzień przed / po graniu). Czysta logika;
 * dane: getWhileThere w planning.ts.
 */
import { coords, distanceKm, placeKey } from "./geo";
import { addDays, dayOf } from "./time";
import { HOME_CITY } from "./trips";

/** Jak daleko od miasta pobytu szukamy (km w linii prostej) — tyle, żeby dojechać i wrócić na nocleg. */
export const WHILE_THERE_RADIUS_KM = 60;
/** Bliżej domu to zwykły wieczorny wypad (wracam na noc), a okazje z okolicy to po prostu okazje z Warszawy. */
export const AWAY_MIN_KM = 80;
/** Wokół grania bez biletów zakładamy, że mogę przyjechać dzień wcześniej albo zostać dzień dłużej. */
export const WHILE_THERE_MARGIN_DAYS = 1;
/** Patrzymy tyle dni naprzód — dalej line-upy i tak nie są jeszcze ułożone. */
export const WHILE_THERE_AHEAD_DAYS = 45;
/** Ile okazji pokazujemy przy jednym pobycie (reszta pod linkiem „Jestem w…”). */
export const WHILE_THERE_PER_STAY = 3;
/** Powrót z prywatnej podróży szukany do tylu dni po przyjeździe; bez biletu powrotnego — sam dzień przyjazdu i następny. */
export const RETURN_WITHIN_DAYS = 14;

export type StayGig = { id: number; title: string; startsAt: string; cityName: string | null };
export type StayTrip = { gigId: number | null; fromStation: string; toStation: string; departsAt: string; arrivesAt: string | null };

export type Stay = {
  city: string;
  /** Pierwszy i ostatni dzień, w którym mogę tam zagrać ("YYYY-MM-DD"). */
  from: string;
  to: string;
  /** Grania, przy których jadę; pusto = prywatna podróż. */
  gigs: { id: number; title: string; startsAt: string }[];
};

/** „Gdańsk Główny” → „Gdańsk”: najdłuższy początek nazwy stacji, który jest miastem z mapy. */
export function stationCity(station: string): string | null {
  const words = station.trim().split(/\s+/);
  for (let n = words.length; n > 0; n--) {
    const name = words.slice(0, n).join(" ");
    if (coords(name)) return name;
  }
  return null;
}

const sameCity = (a: string, b: string) => placeKey(a) === placeKey(b);
/** Miasto z mapy, dość daleko od domu, żeby wyjazd był pobytem. */
function isAway(city: string) {
  const [at, home] = [coords(city), coords(HOME_CITY)];
  return !!at && !!home && distanceKm(home, at) >= AWAY_MIN_KM;
}
const min = (a: string, b: string) => (a < b ? a : b);
const max = (a: string, b: string) => (a > b ? a : b);

/**
 * Pobyty poza domem od dziś do WHILE_THERE_AHEAD_DAYS: jedno na granie (dzień grania ± margines,
 * rozszerzone o bilety podpięte do grania) i jedno na prywatną podróż (przyjazd → powrót).
 * Pobyty w tym samym mieście, które się stykają, łączymy w jeden.
 */
export function buildStays(gigs: StayGig[], trips: StayTrip[], today: string): Stay[] {
  const until = addDays(today, WHILE_THERE_AHEAD_DAYS);
  const stays: Stay[] = [];

  for (const g of gigs) {
    const day = dayOf(g.startsAt);
    if (!g.cityName || !isAway(g.cityName) || day < today || day > until) continue;
    let from = addDays(day, -WHILE_THERE_MARGIN_DAYS);
    let to = addDays(day, WHILE_THERE_MARGIN_DAYS);
    for (const t of trips.filter((t) => t.gigId === g.id)) {
      const arrivesIn = stationCity(t.toStation);
      const leavesFrom = stationCity(t.fromStation);
      if (arrivesIn && sameCity(arrivesIn, g.cityName)) from = min(from, dayOf(t.arrivesAt ?? t.departsAt));
      if (leavesFrom && sameCity(leavesFrom, g.cityName)) to = max(to, dayOf(t.departsAt));
    }
    stays.push({ city: g.cityName, from, to, gigs: [{ id: g.id, title: g.title, startsAt: g.startsAt }] });
  }

  const privateTrips = trips.filter((t) => t.gigId == null);
  for (const t of privateTrips) {
    const city = stationCity(t.toStation);
    const from = dayOf(t.arrivesAt ?? t.departsAt);
    if (!city || !isAway(city) || from > until) continue;
    const back = privateTrips
      .filter((r) => {
        const leavesFrom = stationCity(r.fromStation);
        const day = dayOf(r.departsAt);
        return !!leavesFrom && sameCity(leavesFrom, city) && day >= from && day <= addDays(from, RETURN_WITHIN_DAYS);
      })
      .map((r) => dayOf(r.departsAt))
      .sort()[0];
    const to = back ?? addDays(from, 1);
    if (to < today) continue;
    stays.push({ city, from, to, gigs: [] });
  }

  const merged: Stay[] = [];
  for (const s of stays.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))) {
    const prev = merged.find((m) => sameCity(m.city, s.city) && s.from <= addDays(m.to, 1));
    if (prev) {
      prev.to = max(prev.to, s.to);
      prev.gigs.push(...s.gigs);
    } else {
      merged.push({ ...s, gigs: [...s.gigs] });
    }
  }
  // Wczoraj już nie zagram — okno zaczyna się najwcześniej dziś.
  return merged.map((s) => ({ ...s, from: max(s.from, today) })).filter((s) => s.from <= s.to);
}

export type NearbyCandidate = {
  startsAt: string;
  distanceKm: number;
  /** Znajomy z CRM — najłatwiej się dogadać. */
  friend: string | null;
  isOpenMic: boolean;
  performer: { key: string };
};

/**
 * Najlepsze okazje przy pobycie: znajomi, potem open miki, potem najbliżej; jeden termin na komika.
 * Kandydaci są już z okna pobytu i z wolnych dni (patrz stayOpportunities).
 */
export function pickNearby<T extends NearbyCandidate>(candidates: T[], limit = WHILE_THERE_PER_STAY): T[] {
  const rank = (c: T) => (c.friend ? 0 : c.isOpenMic ? 1 : 2);
  const seen = new Set<string>();
  return [...candidates]
    .sort((a, b) => rank(a) - rank(b) || a.distanceKm - b.distanceKm || a.startsAt.localeCompare(b.startsAt))
    .filter((c) => !seen.has(c.performer.key) && seen.add(c.performer.key))
    .slice(0, limit);
}
