import type { RecurrenceInterval } from "@/db/schema";
import { placeKey } from "./geo";
import { normalize } from "./text";

/**
 * Cykliczne wydarzenia (zwykle open miki): bileterie wystawiają 1–3 najbliższe terminy, a seria
 * chodzi co tydzień od miesięcy. Wykrywamy rytm z dotychczasowych terminów (albo bierzemy mój
 * ręczny wybór) i dopisujemy przewidywane terminy jako wydarzenia ze źródłem RECURRING_SOURCE.
 * Czysta logika — zapis w bazie: src/lib/recurring-sync.ts.
 */
export const RECURRING_SOURCE = "cykliczne";
/** Na ile dni naprzód rozpisujemy przewidywane terminy. */
export const PREDICT_DAYS = 56;
/** Wykryta seria bez prawdziwego terminu od tylu dni uznana za wygasłą (ręcznych to nie dotyczy). */
export const STALE_DAYS = 42;
/** Minimum terminów, żeby uznać serię za cykliczną bez mojego potwierdzenia. */
export const MIN_OCCURRENCES = 3;

/** Biernik dnia tygodnia („w środę”), 0 = poniedziałek. */
const WEEKDAYS_ACC = ["poniedziałek", "wtorek", "środę", "czwartek", "piątek", "sobotę", "niedzielę"];
/** Liczebnik porządkowy w bierniku: męski (poniedziałek, wtorek, czwartek, piątek) i żeński. */
const ORDINAL_M = ["pierwszy", "drugi", "trzeci", "czwarty", "piąty"];
const ORDINAL_F = ["pierwszą", "drugą", "trzecią", "czwartą", "piątą"];
const MASCULINE = new Set([0, 1, 3, 4]);
/** „we wtorek”, ale „w środę”. */
const inDay = (wd: number) => `${wd === 1 ? "we" : "w"} ${WEEKDAYS_ACC[wd]}`;

/** Seria = ten sam tytuł, miasto i miejsce (po normalizacji). */
export const seriesKey = (e: { title: string; cityName: string | null; venueName: string | null }) =>
  [normalize(e.title).replace(/[^a-z0-9]+/g, " ").trim(), placeKey(e.cityName ?? ""), normalize(e.venueName ?? "").replace(/[^a-z0-9]+/g, " ").trim()].join("|");

const dayMs = (d: string) => Date.parse(d.slice(0, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** 0 = poniedziałek. */
export const weekday = (d: string) => (new Date(dayMs(d)).getUTCDay() + 6) % 7;
/** Który to dany dzień tygodnia w miesiącu (1 = pierwszy). */
const nth = (d: string) => Math.ceil(Number(d.slice(8, 10)) / 7);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Rytm z terminów (dni „YYYY-MM-DD”): ten sam dzień tygodnia i stałe odstępy. Co tydzień / 2 / 4 tygodnie
 * wymaga min. dwóch odstępów dokładnie tej długości (pojedyncza dziura w serii jest OK);
 * „co miesiąc” = zawsze ten sam n-ty dzień tygodnia, odstępy 4–5 tygodni.
 */
export function detectInterval(days: string[]): RecurrenceInterval | null {
  const ds = [...new Set(days.map((d) => d.slice(0, 10)))].sort();
  if (ds.length < MIN_OCCURRENCES) return null;
  if (new Set(ds.map(weekday)).size > 1) return null;
  const gaps = ds.slice(1).map((d, i) => (dayMs(d) - dayMs(ds[i])) / 864e5);
  const base = gaps.reduce(gcd);
  const exact = gaps.filter((g) => g === base).length;
  if ([7, 14].includes(base) && exact >= 2) return `w${base / 7}` as RecurrenceInterval;
  // „Pierwsza środa miesiąca” przed „co 4 tygodnie” — przy odstępach 28 dni oba pasują, a open miki
  // częściej chodzą wg kalendarza; „co 4 tygodnie” zostaje dla serii, które wędrują po miesiącu.
  if (new Set(ds.map(nth)).size === 1 && gaps.every((g) => g === 28 || g === 35)) return "m";
  if (base === 28 && exact >= 2) return "w4";
  return null;
}

/** Terminy serii od `from` do `to` (włącznie), z godziną z `anchor` („2026-10-14T19:00” albo sama data). */
export function project(interval: RecurrenceInterval, anchor: string, from: string, to: string): string[] {
  const time = anchor.slice(10);
  const out: string[] = [];
  if (interval === "m") {
    const wd = weekday(anchor);
    const n = nth(anchor);
    for (let m = new Date(dayMs(from.slice(0, 7) + "-01")); iso(m.getTime()) <= to; m.setUTCMonth(m.getUTCMonth() + 1)) {
      const first = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1));
      const offset = (wd - ((first.getUTCDay() + 6) % 7) + 7) % 7;
      const day = new Date(first.getTime() + (offset + (n - 1) * 7) * 864e5);
      if (day.getUTCMonth() !== m.getUTCMonth()) continue; // np. piąta środa nie w każdym miesiącu
      const d = iso(day.getTime());
      if (d >= from && d <= to) out.push(d + time);
    }
    return out;
  }
  const step = Number(interval.slice(1)) * 7 * 864e5;
  let t = dayMs(anchor);
  // Cofnij/przesuń do pierwszego terminu ≥ from, zachowując fazę serii.
  t += Math.ceil((dayMs(from) - t) / step) * step;
  for (; iso(t) <= to; t += step) out.push(iso(t) + time);
  return out;
}

/** „co środę, 19:00”, „co 2 tygodnie we wtorek”, „w każdą pierwszą środę miesiąca”. */
export function describe(interval: RecurrenceInterval, anchor: string) {
  const wd = weekday(anchor);
  const time = anchor.length > 10 ? `, ${anchor.slice(11, 16)}` : "";
  if (interval === "w1") return `co ${WEEKDAYS_ACC[wd]}${time}`;
  if (interval === "m") {
    const m = MASCULINE.has(wd);
    return `w ${m ? "każdy" : "każdą"} ${(m ? ORDINAL_M : ORDINAL_F)[nth(anchor) - 1]} ${WEEKDAYS_ACC[wd]} miesiąca${time}`;
  }
  return `co ${interval.slice(1)} tygodnie ${inDay(wd)}${time}`;
}

export const INTERVAL_LABEL: Record<RecurrenceInterval, string> = {
  w1: "Co tydzień",
  w2: "Co 2 tygodnie",
  w4: "Co 4 tygodnie",
  m: "Co miesiąc",
};

export type SeriesEvent = {
  id: number;
  source: string;
  title: string;
  cityName: string | null;
  venueName: string | null;
  url: string;
  startsAt: string;
};

export type SeriesDecision = {
  key: string;
  mode: "manual" | "off";
  interval: RecurrenceInterval | null;
  title: string;
  cityName: string | null;
  venueName: string | null;
  url: string | null;
  anchor: string | null;
};

export type Series = {
  key: string;
  title: string;
  cityName: string | null;
  venueName: string | null;
  url: string | null;
  interval: RecurrenceInterval;
  anchor: string;
  how: "auto" | "manual";
  /** Prawdziwe (z bileterii) terminy od dziś. */
  realUpcoming: string[];
  /** Przewidywane terminy (bez dni, na które jest prawdziwy termin). */
  predicted: string[];
};

/**
 * Wszystkie aktywne serie: wykryte z prawdziwych terminów + ręcznie oznaczone, bez wyłączonych („off”).
 * `events` = wszystkie zapisane wydarzenia (też minione — im dłuższa historia, tym pewniejsze wykrycie).
 */
export function buildSeries(events: SeriesEvent[], decisions: SeriesDecision[], today: string): Series[] {
  const real = new Map<string, SeriesEvent[]>();
  for (const e of events) {
    if (e.source === RECURRING_SOURCE) continue;
    const k = seriesKey(e);
    real.set(k, [...(real.get(k) ?? []), e]);
  }
  const byKey = new Map(decisions.map((d) => [d.key, d]));
  const until = iso(dayMs(today) + PREDICT_DAYS * 864e5);
  const out: Series[] = [];
  for (const key of new Set([...real.keys(), ...decisions.filter((d) => d.mode === "manual").map((d) => d.key)])) {
    const decision = byKey.get(key);
    if (decision?.mode === "off") continue;
    const list = (real.get(key) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const latest = list.at(-1);
    const interval = decision?.mode === "manual" ? decision.interval : detectInterval(list.map((e) => e.startsAt));
    if (!interval) continue;
    if (!decision && (!latest || latest.startsAt.slice(0, 10) < iso(dayMs(today) - STALE_DAYS * 864e5))) continue;
    const anchor = latest?.startsAt ?? decision?.anchor;
    if (!anchor) continue;
    const realDays = new Set(list.map((e) => e.startsAt.slice(0, 10)));
    // Przewidujemy tylko naprzód od ostatniego znanego terminu — nie wstecz (seria mogła dopiero ruszyć)
    // ani w luki między prawdziwymi (przerwa świąteczna, wolny tydzień w klubie).
    const after = iso(Math.max(dayMs(today), dayMs(anchor) + 864e5));
    out.push({
      key,
      title: latest?.title ?? decision!.title,
      cityName: latest?.cityName ?? decision?.cityName ?? null,
      venueName: latest?.venueName ?? decision?.venueName ?? null,
      url: latest?.url ?? decision?.url ?? null,
      interval,
      anchor,
      how: decision?.mode === "manual" ? "manual" : "auto",
      realUpcoming: [...realDays].filter((d) => d >= today).sort(),
      predicted: project(interval, anchor, after, until).filter((d) => !realDays.has(d.slice(0, 10))),
    });
  }
  return out.sort((a, b) => (a.predicted[0] ?? "9").localeCompare(b.predicted[0] ?? "9"));
}
