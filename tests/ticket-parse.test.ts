import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fmtZl, missingFields, parseTicket } from "../src/lib/ticket-parse";

/** Tekst strony biletu KOLEO tak, jak go widać (innerText; układ komórek bywa różny). */
const KOLEO = `Wróć
Twój plan podróży
07:16	SŁUPSK	11:31	WARSZAWA CENTRALNA
PKP Intercity S.A.
Oferta:
1 PRZEJAZD TAM
0 NORMAL.
1 ULG.
Ważny od 07:16 05.11.2026 do 11:31 05.11.2026
Słupsk — Warszawa Centralna
PRZEZ: ***
Klasa 2
Przewoźnik PKP Intercity S.A.
K-Promo I: 1×51% STU/DOK [99]
EIP
458 km
Opłata za przejazd:
w tym PTU B (8%):
88.41 zł
6.55 zł
Słupsk
Warszawa Centralna
05.11	07:16
05.11	11:31
Pociąg: EIP 8300
Wagon: 4 Wagon bezprzedziałowy
1 miejsce do siedzenia: 82 OKNO
Numer referencyjny: 518577224665
WA99377019
Kod awaryjny
7693
Teodor Wolski`;

test("bilet KOLEO: trasa, godziny, pociąg, miejsce, cena, numer", () => {
  const t = parseTicket(KOLEO, "https://koleo.pl/ticket/341524555");
  assert.deepEqual(t, {
    carrier: "PKP Intercity",
    train: "EIP 8300",
    fromStation: "Słupsk",
    toStation: "Warszawa Centralna",
    departsAt: "2026-11-05T07:16",
    arrivesAt: "2026-11-05T11:31",
    priceGr: 8841,
    seat: "wagon 4, miejsce 82 (okno)",
    reference: "518577224665",
    url: "https://koleo.pl/ticket/341524555",
  });
  assert.deepEqual(missingFields(t), []);
  assert.equal(fmtZl(t.priceGr!), "88,41 zł");
});

test("przesiadka: pierwszy odjazd, ostatni przyjazd, oba pociągi", () => {
  const t = parseTicket(
    `Ważny od 08:05 12.12.2026 do 14:40 12.12.2026
Warszawa Centralna — Gdańsk Główny
Opłata za przejazd: 120,00 zł
12.12 08:05 Pociąg: IC 1234
12.12 11:10
12.12 11:30 Pociąg: TLK 55
12.12 14:40`,
  );
  assert.equal(t.departsAt, "2026-12-12T08:05");
  assert.equal(t.arrivesAt, "2026-12-12T14:40");
  assert.equal(t.train, "IC 1234 → TLK 55");
  assert.equal(t.priceGr, 12000);
});

test("bez rozkładu przy stacjach — godziny z „Ważny od … do …”; śmieci → puste pola", () => {
  const t = parseTicket("Ważny od 17:10 01.12.2026 do 19:45 01.12.2026\nŁódź Fabryczna — Warszawa Zachodnia");
  assert.equal(t.departsAt, "2026-12-01T17:10");
  assert.equal(t.arrivesAt, "2026-12-01T19:45");
  assert.deepEqual(missingFields(parseTicket("coś zupełnie innego")), ["fromStation", "toStation", "departsAt", "priceGr"]);
});

/** Tekst z PDF-a biletu KOLEO (KOLEO_2026-11-05_WA99377019.pdf) — inny układ niż strona. */
const KOLEO_PDF = `REZERWACJE
Informacja o cenie
Opłata za przejazd: 88.41 PLN
w tym PTU B (8%): 6.55 PLN 
Płatność przelewem
Sprzedawca: PKP Intercity S.A.
Wystawiono: 02.11.2026 18:43
Data wydruku:02.11.2026 18:44
Bilet ważny łącznie z dokumentem potwierdzającym tożsamość. 
Właściciel biletu: 
Teodor Wolski
Numer biletu:
WA99377019
7693
88,41 PLN
BILET 
PRZEJAZD TAM (1) 
Teodor Wolski 
0 NORMAL.
1 ULG. 
OD -> DO KL.
05.11 07:16 Słupsk -> Warszawa Centralna 05.11 11:31   2  
* * * -> * * *   *  
Przewoźnik: PKP Intercity S.A.
K-Promo I: 1×51% STU/DOK [99] Cena
PRZEZ: --* 
458 km
05.11 07:16 Słupsk -> Warszawa Centralna 05.11 11:31   2  
Pociąg
EIP 8300
Wagon
4
Wagon bezprzedziałowy
1 miejsce do siedzenia
82 
Okno 
Numer referencyjny: 518577224665 `;

test("PDF biletu KOLEO: to samo co ze strony (rok z „Wystawiono”, PLN, etykiety bez dwukropka)", () => {
  assert.deepEqual(parseTicket(KOLEO_PDF), { ...parseTicket(KOLEO, null) });
});

test("PDF kupiony w grudniu na styczeń → rok później", () => {
  const t = parseTicket(KOLEO_PDF.replace("Wystawiono: 02.11.2026", "Wystawiono: 20.12.2026").replaceAll("05.11", "03.01"));
  assert.equal(t.departsAt, "2027-01-03T07:16");
  assert.equal(t.arrivesAt, "2027-01-03T11:31");
});

// Prawdziwy bilet (dane osobowe, QR) — tylko lokalnie, nie w repo; w CI test się pomija.
const PRIVATE_PDF = "tests/fixtures/private/koleo-bilet.pdf";
test("prawdziwy PDF biletu KOLEO → tekst (bez bibliotek) → te same dane co ze strony", { skip: !existsSync(PRIVATE_PDF) && "brak prywatnego PDF-a" }, async () => {
  const { readFileSync } = await import("node:fs");
  const { inflateSync } = await import("node:zlib");
  const { pdfText } = await import("../src/lib/pdf-text");
  const text = await pdfText(new Uint8Array(readFileSync(PRIVATE_PDF)), async (d) => new Uint8Array(inflateSync(d)));
  assert.match(text, /05\.11 07:16 Słupsk -> Warszawa Centralna 05\.11 11:31/);
  assert.deepEqual(parseTicket(text), parseTicket(KOLEO, null));
});
