/**
 * Prognoza celu miesiąca: ile grań realnie wyjdzie z tego, co już zagrane, potwierdzone i w toku —
 * i do ilu osób jeszcze napisać, żeby domknąć cel. Czysta logika; dane: getGoals w goals.ts.
 *
 * Skuteczność uczymy z rozmów z wynikiem (gigs.outcome): „Zgodził się” wobec wszystkich zakończonych.
 * Importowane wstecz grania nie mają wyniku, więc nie zawyżają skuteczności.
 */

/** Skuteczność pisania, zanim uzbiera się własna historia — mniej więcej co trzecia rozmowa kończy się graniem. */
export const PRIOR_SUCCESS = 1 / 3;
/** Waga założenia: tyle „wyobrażonych” rozmów dokładamy do prawdziwych, żeby 2 zgody z 2 nie dały 100%. */
export const PRIOR_WEIGHT = 6;
/**
 * „Zainteresowany” to jeszcze nie rozmowa — do części takich grań nigdy nie napiszę,
 * więc liczą się za połowę rozmowy.
 */
export const INTERESTED_FACTOR = 0.5;

export type ForecastInput = {
  /** Zagrane w tym miesiącu. */
  played: number;
  /** Potwierdzone, jeszcze przed nami (w tym miesiącu). */
  planned: number;
  /** W toku na ten miesiąc, wg statusu. */
  pending: { interested: number; asked: number };
  target: number;
  /** Historia rozmów z wynikiem (wszystkie miesiące). */
  history: { agreed: number; resolved: number };
};

/** Skuteczność rozmów wygładzona założeniem (0–1). */
export const successRate = ({ agreed, resolved }: ForecastInput["history"]) =>
  (agreed + PRIOR_SUCCESS * PRIOR_WEIGHT) / (resolved + PRIOR_WEIGHT);

export function forecastMonth(input: ForecastInput) {
  const rate = successRate(input.history);
  const sure = input.played + input.planned;
  const fromPending = input.pending.asked * rate + input.pending.interested * rate * INTERESTED_FACTOR;
  const expected = sure + fromPending;
  const gap = input.target - expected;
  return {
    /** Pewne: zagrane + potwierdzone. */
    sure,
    /** Spodziewana liczba grań na koniec miesiąca (pewne + szansa z tych w toku). */
    expected,
    rate,
    /** Czy skuteczność jest już z własnych rozmów (od PRIOR_WEIGHT zakończonych), czy głównie z założenia. */
    learned: input.history.resolved >= PRIOR_WEIGHT,
    /** Do ilu osób jeszcze napisać, żeby prognoza domknęła cel; 0 = wystarczy to, co jest. */
    toWrite: gap > 0 ? Math.ceil(gap / rate) : 0,
  };
}

export type Forecast = ReturnType<typeof forecastMonth>;
