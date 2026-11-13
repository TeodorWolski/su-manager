/**
 * Rynek z bileterii: kto sprzedaje sale (ranking komików, przed którymi warto zagrać) i z jakim
 * wyprzedzeniem dany komik ogłasza terminy. Czysta logika — dane: loadMarket w market-data.ts.
 *
 * „Ogłoszenie” = pierwsze pojawienie się wydarzenia w bileterii (events.firstSeenAt). Wydarzenia widziane
 * w pierwszych dniach działania scrapera istniały wcześniej, więc ich daty ogłoszenia nie znamy — pomijamy.
 */

import { roundedMedian } from "./median";
import { addDays, dayOf, daysBetween } from "./time";

/** Wydarzenia z tylu pierwszych dni scrapera nie mówią nic o tym, kiedy komik ogłasza terminy. */
export const ANNOUNCE_BASELINE_DAYS = 3;
/**
 * Scraper patrzy tyle dni naprzód (HORIZON_DAYS w scripts/scrape.ts) — dalszy termin „pojawia się” dopiero,
 * gdy wejdzie w horyzont, więc wyprzedzenie ≈ horyzont znaczy tylko „co najmniej tyle”.
 */
export const SCRAPE_HORIZON_DAYS = 90;
/** Od tylu „ogłoszonych” terminów liczymy wyprzedzenie komika. */
export const ANNOUNCE_MIN_SAMPLES = 3;
/** W rankingu tylko komicy z co najmniej tyloma terminami (pojedyncze wydarzenia to szum). */
export const RANK_MIN_EVENTS = 2;

export type MarketEvent = {
  /** Kontakt z CRM albo klucz z tytułu — po nim grupujemy terminy jednego komika. */
  key: string;
  name: string;
  contactId: number | null;
  startsAt: string;
  cityName: string | null;
  inRange: boolean;
  availability: "last" | "sold_out" | null;
  /** UTC "YYYY-MM-DD HH:MM:SS". */
  firstSeenAt: string;
};

/**
 * Ile dni przed występem komik zwykle wrzuca termin (mediana). `beyondHorizon` = większość terminów
 * pojawiła się dopiero na granicy horyzontu scrapera, czyli ogłasza jeszcze wcześniej (ponad 3 mies.) —
 * wtedy `days` to dolna granica. null = za mało ogłoszeń widzianych na żywo.
 */
export function announceLead(events: Pick<MarketEvent, "startsAt" | "firstSeenAt">[], scrapeStart: string) {
  const since = addDays(scrapeStart, ANNOUNCE_BASELINE_DAYS);
  const leads = events.filter((e) => dayOf(e.firstSeenAt) >= since).map((e) => daysBetween(e.firstSeenAt, e.startsAt)).filter((d) => d >= 0);
  if (leads.length < ANNOUNCE_MIN_SAMPLES) return null;
  const atEdge = leads.filter((d) => d >= SCRAPE_HORIZON_DAYS - 3).length;
  const beyondHorizon = atEdge * 2 > leads.length;
  return { days: beyondHorizon ? SCRAPE_HORIZON_DAYS : roundedMedian(leads), samples: leads.length, beyondHorizon };
}

/** „~4 tyg.” / „ponad 3 mies.” — do UI i powiadomień. */
export const announceLabel = (a: { days: number; beyondHorizon: boolean }) =>
  a.beyondHorizon ? "ponad 3 mies." : a.days >= 14 ? `~${Math.round(a.days / 7)} tyg.` : `~${a.days} dni`;

export type Headliner = ReturnType<typeof rankHeadliners>[number];

/**
 * Ranking: popyt (udział terminów sold out / ostatnie bilety) × skala (ile terminów) + gra w zasięgu
 * + jeszcze przed nim nie grałem. Bez komików ukrytych w Okazjach.
 */
export function rankHeadliners(
  events: MarketEvent[],
  opts: { today: string; scrapeStart: string; playedBefore: Set<number>; hidden: Set<string> },
) {
  const groups = new Map<string, MarketEvent[]>();
  for (const e of events) groups.set(e.key, [...(groups.get(e.key) ?? []), e]);
  return [...groups.values()]
    .filter((list) => list.length >= RANK_MIN_EVENTS && !opts.hidden.has(list[0].key))
    .map((list) => {
      const { key, name, contactId } = list[0];
      const soldOut = list.filter((e) => e.availability === "sold_out").length;
      const last = list.filter((e) => e.availability === "last").length;
      const upcoming = list.filter((e) => dayOf(e.startsAt) >= opts.today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const near = upcoming.filter((e) => e.inRange);
      // Popyt wygładzony (+3 „zwykłe” terminy) — 2 wyprzedane z 3 to jeszcze nie gwiazda.
      const demand = (soldOut + last) / (list.length + 3);
      const played = contactId != null && opts.playedBefore.has(contactId);
      // Bez terminów w zasięgu realnie przed nim nie zagram — nawet pełne sale go nie ratują.
      const score = demand * 10 + Math.log2(1 + list.length) + (near.length ? 3 : -8) + (played ? 0 : 1);
      return {
        key,
        name,
        contactId,
        total: list.length,
        soldOut,
        last,
        demand,
        upcoming: upcoming.length,
        inRange: near.length,
        nextInRange: near[0] ? { startsAt: near[0].startsAt, cityName: near[0].cityName } : null,
        cities: new Set(list.map((e) => e.cityName).filter(Boolean)).size,
        announce: announceLead(list, opts.scrapeStart),
        playedBefore: played,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}
