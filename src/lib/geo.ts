import places from "@/data/places-pl.json";
import { normalize } from "./text";

/** Klucz miejscowości: bez polskich znaków, myślniki jak spacje („Kędzierzyn Koźle” = „Kędzierzyn-Koźle”). */
export const placeKey = (name: string) => normalize(name).replace(/-/g, " ").replace(/\s+/g, " ").trim();

const COORDS = places as unknown as Record<string, [number, number]>;

export function coords(name: string | null | undefined): [number, number] | null {
  return name ? (COORDS[placeKey(name)] ?? null) : null;
}

/** Odległość w linii prostej (km). Drogą zwykle wychodzi ~1,3× więcej. */
export function distanceKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
