/**
 * Odczyt biletu z tekstu strony przewoźnika (na razie KOLEO: koleo.pl/ticket/…) albo z PDF-a biletu.
 * Tekst przychodzi ze skrótu „Udostępnij” (strona albo PDF), bookmarkletu albo z wklejenia.
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
  // PDF biletu nie ma roku przy przejeździe — jest w „Wystawiono: 02.11.2026 18:43”. Bilet kupiony w grudniu
  // na styczeń → rok później.
  const issued = flat.match(/Wystawiono\s*:?\s*\d{2}\.(\d{2})\.(\d{4})/i);
  const anyYear = flat.match(/\b\d{1,2}\.\d{1,2}\.(20\d{2})\b/)?.[1] ?? null;
  const yearFor = (month: string) =>
    valid?.[2].slice(-4) ?? (issued ? String(Number(issued[2]) + (Number(month) < Number(issued[1]) ? 1 : 0)) : anyYear);

  // Rozkład przy stacjach: "05.11 07:16" — pierwszy to odjazd, ostatni przyjazd (też przy przesiadkach).
  const stops = [...flat.matchAll(/\b(\d{2})\.(\d{2}) (\d{2}:\d{2})\b/g)];
  const stopAt = (m: RegExpMatchArray) => {
    const year = yearFor(m[2]);
    return year ? `${year}-${m[2]}-${m[1]}T${m[3]}` : null;
  };
  let departsAt = stops.length ? stopAt(stops[0]) : null;
  let arrivesAt = stops.length > 1 ? stopAt(stops[stops.length - 1]) : null;
  if (valid) {
    departsAt ??= dateTime(valid[1], valid[2]);
    arrivesAt ??= dateTime(valid[3], valid[4]);
  }

  // Relacja „Słupsk — Warszawa Centralna” (strona; myślnik długi albo krótki) albo z PDF-a:
  // „05.11 07:16 Słupsk -> Warszawa Centralna 05.11 11:31” — przy przesiadkach skąd z pierwszego odcinka, dokąd z ostatniego.
  const legs = [...flat.matchAll(/\d{2}\.\d{2} \d{2}:\d{2} (\S.*?) (?:->|→) (\S.*?) \d{2}\.\d{2} \d{2}:\d{2}/g)];
  const dash = text.match(/^\s*([^\n—–]{2,60}?)\s+[—–]\s+([^\n]{2,60}?)\s*$/m);
  const route = dash ?? (legs.length ? [null, legs[0][1], legs[legs.length - 1][2]] : null);

  // Cena: „Opłata za przejazd: 88.41 zł”; przy kilku pozycjach — „Do zapłaty / Razem”, jeśli są.
  const total = flat.match(/(?:Do zapłaty|Razem|Suma)\s*:?\s*(\d[\d\s]*[.,]\d{2})\s*(?:zł|PLN)/i);
  const fare = flat.match(/Opłata za przejazd\s*:?.{0,60}?(\d+[.,]\d{2})\s*(?:zł|PLN)/i); // po drodze bywa „w tym PTU (8%)”
  const price = total ?? fare;

  // PDF (nowy układ): tabelka „Pociąg Wagon 1 miejsce do siedzenia” / „EIP 8300 4 82” — etykiety w jednej
  // linii, wartości w następnej. Strona: „Pociąg: EIP 8300”, „Wagon: 4”, „1 miejsce do siedzenia: 82 OKNO”.
  const table = [...flat.matchAll(/Pociąg Wagon (?:\d+ )?miejsc[ea] do (?:siedzenia|leżenia) ([A-ZŁŚŻ]{1,4} ?\d{1,6}) (\d{1,3}) (\d{1,3})\b/gi)];
  const trains = table.length
    ? table.map((m) => m[1])
    : [...flat.matchAll(/Pociąg\s*:?\s*([A-ZŁŚŻ]{1,4}\s?\d{1,6}(?:\s(?!Wagon|Klasa|Miejsce)[A-ZŁŚŻ][\wąćęłńóśźż-]+)?)/g)].map((m) => m[1].trim());
  const wagon = table[0]?.[2] ?? flat.match(/Wagon\s*:?\s*(\d+)(?! miejsc)/i)?.[1]; // strona: „Wagon: 4”, PDF: „Wagon 4”
  const seatMatch = flat.match(/miejsc[ea] do (?:siedzenia|leżenia)\s*:?\s*(\d+)/i);
  const seatNo = table[0]?.[3] ?? seatMatch?.[1];
  const side = seatNo ? flat.match(/\b(OKNO|ŚRODEK|KORYTARZ)\b/i)?.[1] : undefined;
  const seat = [wagon && `wagon ${wagon}`, seatNo && `miejsce ${seatNo}${side ? ` (${side.toLowerCase()})` : ""}`]
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
