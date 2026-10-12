/**
 * MGM — material generated per month: minuty bitów założonych w danym miesiącu (długość z bitu),
 * z podziałem na sprawdzone (status „Sprawdzony”) i niesprawdzone (w testach / do redakcji / vomit).
 * Do celu miesięcznego (klucz goals „mgm:YYYY-MM”), tempa i serii liczy się TYLKO sprawdzony;
 * niesprawdzony i suma są w rozpisce. Odrzucone się nie liczą.
 * Czysta logika — dane: getMgm w planning.ts.
 */

/** Domyślny cel, dopóki nie ustawię innego na dany miesiąc (minuty nowego sprawdzonego materiału). */
export const DEFAULT_MGM_MIN = 5;
export const MGM_HISTORY_MONTHS = 6;
export const mgmKey = (month: string) => `mgm:${month}`;

export type MgmBit = { createdAt: string; status: string; lengthMin: number | null };

/** createdAt jest w UTC („2026-10-31 23:30:00”) — miesiąc liczymy po czasie warszawskim. */
export const localMonth = (createdAtUtc: string) =>
  new Date(`${createdAtUtc.replace(" ", "T")}Z`).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }).slice(0, 7);

const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};
const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

function monthStats(bits: MgmBit[], month: string) {
  const mine = bits.filter((b) => b.status !== "rejected" && localMonth(b.createdAt) === month);
  const minutes = (pred: (b: MgmBit) => boolean) => mine.filter(pred).reduce((s, b) => s + (b.lengthMin ?? 0), 0);
  const tested = minutes((b) => b.status === "tested");
  const untested = minutes((b) => b.status !== "tested");
  return { tested, untested, total: tested + untested, bits: mine.length, noLength: mine.filter((b) => !b.lengthMin).length };
}

export function computeMgm(bits: MgmBit[], targets: Map<string, number>, today: string) {
  const month = today.slice(0, 7);
  const targetFor = (m: string) => targets.get(m) ?? DEFAULT_MGM_MIN;
  const cur = monthStats(bits, month);
  const day = Number(today.slice(8, 10));

  const first = bits.length ? bits.map((b) => localMonth(b.createdAt)).sort()[0] : month;
  const history: { month: string; total: number; tested: number; target: number; hit: boolean }[] = [];
  for (let m = prevMonth(month); m >= first && history.length < MGM_HISTORY_MONTHS; m = prevMonth(m)) {
    const s = monthStats(bits, m);
    history.push({ month: m, total: s.total, tested: s.tested, target: targetFor(m), hit: s.tested >= targetFor(m) });
  }
  // Seria: kolejne miesiące wstecz z celem — liczy się sprawdzony (+ bieżący, jeśli już osiągnięty).
  let streak = cur.tested >= targetFor(month) ? 1 : 0;
  for (const h of history) {
    if (!h.hit) break;
    streak++;
  }

  return {
    month,
    ...cur,
    target: targetFor(month),
    isSet: targets.has(month),
    /** Ile sprawdzonego „powinno” być na dziś przy równym tempie. */
    pace: (targetFor(month) * day) / daysInMonth(month),
    daysLeft: daysInMonth(month) - day,
    history,
    streak,
  };
}

export type Mgm = ReturnType<typeof computeMgm>;
