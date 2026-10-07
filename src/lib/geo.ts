import places from "@/data/places-pl.json";
import { normalize } from "./text";

/** Klucz miejscowości: bez polskich znaków, myślniki jak spacje („Kędzierzyn Koźle” = „Kędzierzyn-Koźle”). */
export const placeKey = (name: string) => normalize(name).replace(/-/g, " ").replace(/\s+/g, " ").trim();

const COORDS = places as unknown as Record<string, [number, number, string]>;

export function coords(name: string | null | undefined): [number, number] | null {
  const hit = name ? COORDS[placeKey(name)] : undefined;
  return hit ? [hit[0], hit[1]] : null;
}

/** Nazwa z polskimi znakami dla klucza („slupsk” → „Słupsk”). */
export const placeName = (key: string) => COORDS[key]?.[2] ?? key;

/** Odległość w linii prostej (km). Drogą zwykle wychodzi ~1,3× więcej. */
export function distanceKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * Położenie punktu względem odcinka trasy A→B (rzut na płaszczyznę, wystarczy w skali Polski):
 * `progress` 0 = start, 1 = cel (poza [0,1] — przed startem / za celem), `offKm` — odległość od linii trasy.
 */
export function alongRoute(p: [number, number], a: [number, number], b: [number, number]) {
  const kx = 111.32 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180); // km na stopień długości
  const ky = 110.57; // km na stopień szerokości
  const [bx, by] = [(b[1] - a[1]) * kx, (b[0] - a[0]) * ky];
  const [px, py] = [(p[1] - a[1]) * kx, (p[0] - a[0]) * ky];
  const len2 = bx * bx + by * by || 1;
  const progress = (px * bx + py * by) / len2;
  const t = Math.max(0, Math.min(1, progress));
  const offKm = Math.hypot(px - t * bx, py - t * by);
  return { progress, offKm, totalKm: Math.sqrt(len2) };
}

const PLACE_KEYS = Object.keys(COORDS);
const BEFORE_PLACE = new Set(["do", "w", "we", "ku", "z", "ze", "przez", "kolo", "pod"]);

/**
 * Jak dobrze klucz pasuje do słowa w odmianie: 0 = dokładnie, 1–3 = ile liter końcówki odcięto
 * („slupska” → „slupsk” = 1), Infinity = nie pasuje. Rdzeń min. 4 litery.
 */
const stemCut = (word: string, key: string) => {
  if (word === key) return 0;
  for (let cut = 1; cut <= 3; cut++) {
    const stem = word.slice(0, word.length - cut);
    if (stem.length >= 4 && key.startsWith(stem) && key.length <= stem.length + 3) return cut;
  }
  return Infinity;
};

/**
 * Miejscowość wpisana w zdaniu, także odmieniona („do Słupska”, „w Gdyni”, „do Bielska-Białej”).
 * Kandydaci: słowa po „do / w / przez…” albo pisane wielką literą (gdy brak — wszystkie).
 * Najpierw dokładna nazwa (do 3 słów), potem rdzenie słów. Zwraca klucz miejscowości albo null.
 */
export function findPlace(text: string, onlyAfter?: string[]): string | null {
  const raw = text.split(/[\s,;.!?]+/).filter(Boolean);
  const words = raw.map((w) => placeKey(w));
  // „Bielska-Białej” to jedno słowo w zdaniu, ale dwa w kluczu — rozbijamy po myślniku.
  const flat: { w: string; cap: boolean; after: boolean }[] = [];
  raw.forEach((r, i) =>
    words[i].split(" ").forEach((w, j) =>
      flat.push({ w, cap: /^\p{Lu}/u.test(r), after: j === 0 && i > 0 && BEFORE_PLACE.has(words[i - 1]) }),
    ),
  );
  const prev = (i: number) => (i > 0 ? flat[i - 1].w : "");
  let starts = onlyAfter
    ? flat.map((_, i) => (onlyAfter.includes(prev(i)) ? i : -1)).filter((i) => i >= 0)
    : flat.map((f, i) => ((f.cap || f.after) && !/^\d/.test(f.w) ? i : -1)).filter((i) => i >= 0);
  if (!starts.length && !onlyAfter) starts = flat.map((_, i) => i);
  for (const i of starts) {
    for (let n = 3; n >= 1; n--) {
      const key = flat.slice(i, i + n).map((f) => f.w).join(" ");
      if (i + n <= flat.length && key.length >= 3 && COORDS[key]) return key;
    }
    for (let n = 2; n >= 1; n--) {
      const part = flat.slice(i, i + n).map((f) => f.w);
      if (part.length < n || part[0].length < 4) continue;
      // Najlepiej pasujący: najmniej odciętych liter, potem najkrótsza nazwa.
      const scored = PLACE_KEYS.map((k) => {
        const kw = k.split(" ");
        return { k, cut: kw.length === n ? kw.reduce((sum, x, j) => sum + stemCut(part[j], x), 0) : Infinity };
      })
        .filter((x) => x.cut < Infinity)
        .sort((a, b) => a.cut - b.cut || a.k.length - b.k.length);
      if (scored[0]) return scored[0].k;
    }
  }
  return null;
}
