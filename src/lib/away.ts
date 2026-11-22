/**
 * Ile czasu zajmuje mnie granie: w Warszawie — wieczór, poza nią — cały wyjazd (dojazd, scena, powrót
 * albo nocleg). Z tego liczymy kolizje z prywatnym kalendarzem i wpisy w Kalendarzu Google, bo granie
 * w Gdańsku o 19:00 zajmuje popołudnie, a w kalendarzu wyglądało jak wieczór. Czysta logika.
 */
import { coords, distanceKm } from "./geo";
import { addDays, addMinutes, dayOf, effectiveStart } from "./time";
import { HOME_CITY } from "./trips";

/** Wieczór, który zajmuje granie w Warszawie (lokalnie). */
export const EVENING_FROM = "18:00";
export const EVENING_TO = "23:00";
/** Na miejscu tyle przed startem sceny (też początek wpisu grania w kalendarzu). */
export const ARRIVE_BEFORE_MIN = 60;
/** Od tylu km od domu granie to wyjazd, nie wieczorny wypad. */
export const AWAY_MIN_KM = 80;
/** Ile trwa wieczór z graniem od startu sceny (line-up, swój set, pogadać po). */
export const GIG_LENGTH_MIN = 150;
/** Średnia prędkość dojazdu, gdy miasto nie ma wpisanego czasu dojazdu. */
export const AVG_TRAVEL_KMH = 70;
/** Na dworcu tyle przed odjazdem pociągu (dojazd na dworzec). */
export const STATION_BUFFER_MIN = 30;
/** Powrót później niż tyle po północy = realnie nocleg (pociągów już nie ma). */
export const LAST_RETURN = "00:30";
/** Po noclegu w domu mniej więcej o tej porze następnego dnia. */
export const BACK_NEXT_DAY = "12:00";

export type WindowGig = { startsAt: string; cityName: string | null; travelMinutes: number | null; hasLodging: boolean };
export type WindowTicket = { departsAt: string; arrivesAt: string | null };
/** `away` = wyjazd (wtedy `overnight` = z noclegiem); czasy lokalne Warszawy. */
export type GigWindow = { from: string; to: string; away: boolean; overnight: boolean };

const min = (a: string, b: string) => (a < b ? a : b);
const max = (a: string, b: string) => (a > b ? a : b);

const shortDate = (d: string) => `${Number(d.slice(8, 10))}.${d.slice(5, 7)}`;

/** „wyjazd (Gdańsk): od 15:10, powrót 10.12 ok. 12:00” albo „wieczór (18:00–23:00)” — do ostrzeżeń. */
export function describeWindow(w: GigWindow, cityName: string | null) {
  if (!w.away) return `wieczór (${w.from.slice(11, 16)}–${w.to.slice(11, 16)})`;
  const back = dayOf(w.to) === dayOf(w.from) ? `powrót ok. ${w.to.slice(11, 16)}` : `powrót ${shortDate(dayOf(w.to))} ok. ${w.to.slice(11, 16)}`;
  return `wyjazd${cityName ? ` (${cityName})` : ""}: od ${w.from.slice(11, 16)}, ${back}`;
}

/** Ile km od domu; null = miasta nie ma na mapie (wtedy traktujemy jak Warszawę). */
export function kmFromHome(city: string | null) {
  const [at, home] = [coords(city), coords(HOME_CITY)];
  return at && home ? distanceKm(home, at) : null;
}

/**
 * Okno grania. W Warszawie (i bliżej niż AWAY_MIN_KM) — wieczór EVENING_FROM–EVENING_TO, rozciągnięty, gdy
 * scena zaczyna się wcześniej albo kończy później. Wyjazd — od wyjścia z domu (przyjazd ARRIVE_BEFORE_MIN przed
 * sceną) do powrotu; miasto z noclegiem albo powrót po LAST_RETURN = nocleg i powrót o BACK_NEXT_DAY.
 * Bilety podpięte do grania wygrywają z szacunkiem: tam = odjazd przed sceną, z powrotem = przyjazd po niej.
 */
export function gigWindow(g: WindowGig, tickets: WindowTicket[] = []): GigWindow {
  const start = effectiveStart(g.startsAt);
  const day = dayOf(start);
  const km = kmFromHome(g.cityName);
  if (km == null || km < AWAY_MIN_KM) {
    return {
      from: min(`${day}T${EVENING_FROM}`, addMinutes(start, -ARRIVE_BEFORE_MIN)),
      to: max(`${day}T${EVENING_TO}`, addMinutes(start, GIG_LENGTH_MIN)),
      away: false,
      overnight: false,
    };
  }
  const travel = g.travelMinutes ?? Math.round((km / AVG_TRAVEL_KMH) * 60);
  let from = addMinutes(start, -(ARRIVE_BEFORE_MIN + travel));
  const back = addMinutes(start, GIG_LENGTH_MIN + travel);
  let overnight = g.hasLodging || back > `${addDays(day, 1)}T${LAST_RETURN}`;
  let to = overnight ? `${addDays(day, 1)}T${BACK_NEXT_DAY}` : back;

  const there = tickets.filter((t) => t.departsAt <= start);
  const home = tickets.filter((t) => t.departsAt > start);
  if (there.length) from = addMinutes(there.map((t) => t.departsAt).sort()[0], -STATION_BUFFER_MIN);
  if (home.length) {
    to = home.map((t) => t.arrivesAt ?? addMinutes(t.departsAt, travel)).sort().at(-1)!;
    overnight = dayOf(to) > day;
  }
  return { from, to, away: true, overnight };
}
