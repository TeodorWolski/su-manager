import {
  addDays,
  gigKind,
  MAX_OPENERS_PER_WEEK,
  PENDING,
  STREAK_WARN,
  WEEK_MAX,
  WEEK_MIN,
  weekStart,
  type RhythmGig,
} from "./rhythm";

/**
 * „Najgorętsze okazje” na ekranie Dziś: wydarzenia za HOT_FROM_DAYS–HOT_TO_DAYS dni —
 * dość wcześnie, żeby zaklepać miejsce (komicy układają line-upy z ~2-tygodniowym wyprzedzeniem),
 * dość blisko, żeby było konkretnie. Ranking: znajomi, pełna sala, luźny tydzień, balans typów, bliskość.
 */
export const HOT_FROM_DAYS = 7;
export const HOT_TO_DAYS = 21;
export const HOT_LIMIT = 4;

export type HotCandidate = {
  eventId: number;
  url: string;
  title: string;
  startsAt: string;
  cityName: string | null;
  venueName: string | null;
  isOpenMic: boolean;
  tab: string;
  availability: "last" | "sold_out" | null;
  travelMinutes: number | null;
  isNew: boolean;
  performer: { key: string; name: string; contactId: number | null };
  /** Kontakt z CRM, jeśli to znajomy (do szablonu wiadomości i etykiety). */
  friend: string | null;
};

export type Hot = HotCandidate & { score: number; reasons: string[] };

const day = (iso: string) => iso.slice(0, 10);

export function hotOpportunities(gigs: RhythmGig[], candidates: HotCandidate[], today: string): Hot[] {
  const from = addDays(today, HOT_FROM_DAYS);
  const to = addDays(today, HOT_TO_DAYS);
  const active = gigs.filter((g) => g.status === "confirmed" || (PENDING.includes(g.status) && day(g.startsAt) >= today));
  const busy = new Set(active.map((g) => day(g.startsAt)));
  const inWeek = (date: string) => {
    const start = weekStart(date);
    const end = addDays(start, 6);
    return active.filter((g) => day(g.startsAt) >= start && day(g.startsAt) <= end);
  };
  /** Ile dni z rzędu z graniem wyszłoby, gdybym dołożył `date`. */
  const runWith = (date: string) => {
    let n = 1;
    for (let d = addDays(date, -1); busy.has(d); d = addDays(d, -1)) n++;
    for (let d = addDays(date, 1); busy.has(d); d = addDays(d, 1)) n++;
    return n;
  };

  const scored: Hot[] = [];
  for (const c of candidates) {
    const d = day(c.startsAt);
    if (d < from || d > to || busy.has(d)) continue;
    const week = inWeek(d);
    const openers = week.filter((g) => gigKind(g.context) === "opener").length;
    const openMics = week.filter((g) => gigKind(g.context) === "openMic").length;
    const kind = c.isOpenMic ? "openMic" : "opener";
    // Twarde „nie”: przeładowany tydzień, trzecie granie przed komikiem, seria dzień po dniu.
    if (week.length >= WEEK_MAX) continue;
    if (kind === "opener" && openers >= MAX_OPENERS_PER_WEEK) continue;
    if (runWith(d) >= STREAK_WARN) continue;

    let score = 0;
    const reasons: string[] = [];
    if (c.friend) {
      score += 3;
      reasons.push("znajomy");
    } else if (c.isOpenMic) score += 2;
    else score += 1;
    if (c.availability) {
      score += 2;
      reasons.push(c.availability === "sold_out" ? "sold out" : "ostatnie bilety");
    }
    if (week.length < WEEK_MIN) {
      score += 2;
      reasons.push("luźny tydzień");
    }
    // Balans: dokładaj tego typu, którego w tym tygodniu jest mniej.
    if ((kind === "opener" && openers < openMics) || (kind === "openMic" && openMics < openers)) {
      score += 1.5;
      reasons.push(kind === "opener" ? "brakuje grania przed komikiem" : "brakuje open mica");
    }
    // Bliskość tylko w punktacji — czas dojazdu i tak widać w opisie.
    if (c.travelMinutes != null && c.travelMinutes <= 60) score += 1;
    if (c.isNew) score += 0.5;
    // Najlepiej ok. 2 tygodnie przed — wtedy jeszcze jest miejsce w line-upie.
    score -= Math.abs((Date.parse(d) - Date.parse(today)) / 864e5 - 14) * 0.05;
    scored.push({ ...c, score, reasons });
  }

  // Jeden termin na komika, jeden na dzień i jeden danego typu na tydzień — to propozycje
  // do wyboru, więc trzy openery w jednym tygodniu przeczyłyby balansowi.
  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((h) => {
      const d = day(h.startsAt);
      const keys = [`p:${h.performer.key}`, `d:${d}`, `w:${weekStart(d)}:${h.isOpenMic}`];
      if (keys.some((k) => seen.has(k))) return false;
      keys.forEach((k) => seen.add(k));
      return true;
    })
    .slice(0, HOT_LIMIT);
}
