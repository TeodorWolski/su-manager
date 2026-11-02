/**
 * Odczyt biletu z tekstu strony przewoźnika (na razie KOLEO: koleo.pl/ticket/…).
 * Tekst przychodzi ze skrótu „Udostępnij” / bookmarkletu (innerText strony) albo z wklejenia.
 * Układ strony znamy tylko z wyglądu, więc parser szuka po etykietach i wzorcach, a nie po
 * strukturze — czego nie znajdzie, zostaje puste i uzupełniasz na ekranie importu. Czysta logika.
 */

export type ParsedTicket = {
  carrier: string | null;
  train: string | null;
  fromStation: string | null;
  toStation: string | null;
  /** Lokalny czas Warszawy "YYYY-MM-DDTHH:mm". */
  departsAt: string | null;
  arrivesAt: string | null;
  priceGr: number | null;
  seat: string | null;
  reference: string | null;
  url: string | null;
};

const pad = (n: string) => n.padStart(2, "0");
const toGr = (amount: string) => Math.round(Number(amount.replace(/\s/g, "").replace(",", ".")) * 100);

/** "07:16 05.11.2026" / "05.11.2026 07:16" → "2026-11-05T07:16". */
function dateTime(time: string, date: string) {
  const [d, m, y] = date.split(".");
  return `${y}-${pad(m)}-${pad(d)}T${time}`;
}

const CARRIERS = ["PKP Intercity", "POLREGIO", "Koleje Mazowieckie", "Koleje Śląskie", "Koleje Dolnośląskie", "Łódzka Kolej Aglomeracyjna", "Arriva", "SKM", "Leo Express", "RegioJet", "FlixBus"];

export function parseTicket(raw: string, url: string | null = null): ParsedTicket {
  const text = raw.replace(/ /g, " ").replace(/\r/g, "");
  const flat = text.replace(/\s+/g, " ");

  // Ważny od 07:16 05.11.2026 do 11:31 05.11.2026 — rok i (dla biletów z rezerwacją) godziny pociągu.
  const valid = flat.match(/Ważny od (\d{1,2}:\d{2}) (\d{1,2}\.\d{1,2}\.\d{4}) do (\d{1,2}:\d{2}) (\d{1,2}\.\d{1,2}\.\d{4})/i);
  const year = valid?.[2].slice(-4) ?? flat.match(/\b\d{1,2}\.\d{1,2}\.(20\d{2})\b/)?.[1] ?? null;

  // Rozkład przy stacjach: "05.11 07:16" — pierwszy to odjazd, ostatni przyjazd (też przy przesiadkach).
  const stops = [...flat.matchAll(/\b(\d{2})\.(\d{2}) (\d{2}:\d{2})\b/g)];
  const stopAt = (m: RegExpMatchArray) => (year ? `${year}-${m[2]}-${m[1]}T${m[3]}` : null);
  let departsAt = stops.length ? stopAt(stops[0]) : null;
  let arrivesAt = stops.length > 1 ? stopAt(stops[stops.length - 1]) : null;
  if (valid) {
    departsAt ??= dateTime(valid[1], valid[2]);
    arrivesAt ??= dateTime(valid[3], valid[4]);
  }

  // Relacja „Słupsk — Warszawa Centralna” (myślnik długi albo krótki).
  const route = text.match(/^\s*([^\n—–]{2,60}?)\s+[—–]\s+([^\n]{2,60}?)\s*$/m);

  // Cena: „Opłata za przejazd: 88.41 zł”; przy kilku pozycjach — „Do zapłaty / Razem”, jeśli są.
  const total = flat.match(/(?:Do zapłaty|Razem|Suma)\s*:?\s*(\d[\d\s]*[.,]\d{2})\s*zł/i);
  const fare = flat.match(/Opłata za przejazd\s*:?.{0,60}?(\d+[.,]\d{2})\s*zł/i); // po drodze bywa „w tym PTU (8%)”
  const price = total ?? fare;

  const trains = [...flat.matchAll(/Pociąg\s*:\s*([A-ZŁŚŻ]{1,4}\s?\d{1,6}(?:\s(?!Wagon|Klasa|Miejsce)[A-ZŁŚŻ][\wąćęłńóśźż-]+)?)/g)].map((m) => m[1].trim());
  const wagon = flat.match(/Wagon\s*:\s*(\d+)/i)?.[1];
  const seatMatch = flat.match(/miejsc[ea] do (?:siedzenia|leżenia)\s*:\s*(\d+)(?:\s+(OKNO|ŚRODEK|KORYTARZ))?/i);
  const seat = [
    wagon && `wagon ${wagon}`,
    seatMatch && `miejsce ${seatMatch[1]}${seatMatch[2] ? ` (${seatMatch[2].toLowerCase()})` : ""}`,
  ]
    .filter(Boolean)
    .join(", ");

  const reference = flat.match(/Numer referencyjny\s*:?\s*([A-Z0-9-]{6,})/i)?.[1] ?? flat.match(/\b([A-Z]{2}\d{8})\b/)?.[1] ?? null;
  const carrier = flat.match(/Przewoźnik\s*:?\s*(.+?)(?:\s{2,}|\s(?:EIP|EIC|IC|TLK|Klasa|K-Promo)\b|$)/)?.[1]?.trim() ?? CARRIERS.find((c) => flat.includes(c)) ?? null;

  return {
    carrier: carrier?.replace(/\s*S\.A\.?$/, "") ?? null,
    train: trains.length ? [...new Set(trains)].join(" → ") : null,
    fromStation: route?.[1].trim() ?? null,
    toStation: route?.[2].trim() ?? null,
    departsAt,
    arrivesAt,
    priceGr: price ? toGr(price[1]) : null,
    seat: seat || null,
    reference,
    url,
  };
}

/** Ile pól udało się odczytać — do komunikatu „sprawdź i uzupełnij”. */
export const missingFields = (t: ParsedTicket) =>
  (["fromStation", "toStation", "departsAt", "priceGr"] as const).filter((k) => t[k] == null);

/** Grosze → "88,41 zł". */
export const fmtZl = (gr: number) => `${(gr / 100).toFixed(2).replace(".", ",")} zł`;
