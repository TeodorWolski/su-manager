import { placeKey } from "./geo";
import { normalize } from "./text";

/**
 * Ten sam występ w dwóch bileteriach pod innym tytułem („Piotr Bałtroczyk” vs „Piotr Bałtroczyk Stand-up”):
 * ten sam dzień i miasto, start ±60 min (albo któryś bez godziny) i wspólne „znaczące” słowo
 * w tytule/występujących — zwykle nazwisko. Ogólne słowa (stand-up, program, festiwal…) się nie liczą,
 * więc festiwal i pojedynczy występ tego samego wieczoru zostają osobno.
 */
const GENERIC = new Set(
  "stand standup program nowy nowa nowe festival festiwal comedy show open mic mick night wieczor komedii trasa tour special edycja bilety kabaret impro improwizacji przed with and the oraz".split(
    " ",
  ),
);

type Show = { title: string; performers?: string | null; startsAt: string; cityName: string | null };

const words = (s: Show) =>
  new Set(
    normalize(`${s.title} ${s.performers ?? ""}`)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !GENERIC.has(w) && !/^\d+$/.test(w)),
  );

const minutes = (startsAt: string) =>
  startsAt.length > 10 ? Number(startsAt.slice(11, 13)) * 60 + Number(startsAt.slice(14, 16)) : null;

/** Klucz kubełka do szybkiego porównania: dzień + miasto. */
export const showBucket = (s: Show) => `${s.startsAt.slice(0, 10)}|${placeKey(s.cityName ?? "")}`;

export function sameShow(a: Show, b: Show) {
  if (showBucket(a) !== showBucket(b) || !a.cityName) return false;
  const [ma, mb] = [minutes(a.startsAt), minutes(b.startsAt)];
  if (ma != null && mb != null && Math.abs(ma - mb) > 60) return false;
  // Krótkie pseudonimy („Pan Li”) nie mają „znaczącego” słowa — wtedy: jeden tytuł zaczyna drugi.
  const [ta, tb] = [a, b].map((s) => normalize(s.title).replace(/[^a-z0-9]+/g, " ").replace(/^stand up\s*/, "").trim());
  const shorter = ta.length <= tb.length ? ta : tb;
  const specific = shorter.split(" ").some((w) => w && !GENERIC.has(w)); // „open mic” to nie nazwa
  if (shorter.length >= 5 && specific && (ta.startsWith(tb) || tb.startsWith(ta))) return true;
  const wb = words(b);
  // Nazwa miasta w tytule („Kraków Stand-up Festival”) nie świadczy o tym samym występie.
  const city = new Set(placeKey(a.cityName).split(" "));
  return [...words(a)].some((w) => wb.has(w) && !city.has(w));
}

export type DayGig = { id: number; title: string; startsAt: string; headlinerId: number | null; cityName: string | null };

/**
 * Które z moich grań to TO wydarzenie, a które to po prostu inne granie tego samego dnia.
 * Moje = przed tym samym komikiem (start ±60 min — ten sam komik potrafi grać dwa razy jednego wieczoru)
 * albo ten sam występ wg sameShow. Samo „ten sam dzień i miasto” to za mało — inaczej drugie granie
 * tego dnia dało się tylko otworzyć jako „Twoje granie” zamiast dodać.
 */
export function myGigForEvent(myGigs: DayGig[], e: Show, contactIds: number[]) {
  const sameDay = myGigs.filter((g) => g.startsAt.slice(0, 10) === e.startsAt.slice(0, 10));
  const close = (g: DayGig) => {
    const [mg, me] = [minutes(g.startsAt), minutes(e.startsAt)];
    return mg == null || me == null || Math.abs(mg - me) <= 60;
  };
  const mine =
    sameDay.find((g) => g.headlinerId != null && contactIds.includes(g.headlinerId) && close(g)) ??
    sameDay.find((g) => sameShow({ title: g.title, startsAt: g.startsAt, cityName: g.cityName }, e)) ??
    null;
  return { mine, others: sameDay.filter((g) => g !== mine) };
}
