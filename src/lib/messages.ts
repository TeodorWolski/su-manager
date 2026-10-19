import { format, parseISO } from "date-fns";
import { normalize } from "./text";

/** Miejscownik dla „w [mieście]”. Brak w słowniku = mianownik (i tak edytujesz przed wysłaniem). */
const LOCATIVE: Record<string, string> = {
  warszawa: "Warszawie",
  krakow: "Krakowie",
  lodz: "Łodzi",
  wroclaw: "Wrocławiu",
  poznan: "Poznaniu",
  gdansk: "Gdańsku",
  gdynia: "Gdyni",
  sopot: "Sopocie",
  szczecin: "Szczecinie",
  lublin: "Lublinie",
  katowice: "Katowicach",
  bialystok: "Białymstoku",
  bydgoszcz: "Bydgoszczy",
  torun: "Toruniu",
  rzeszow: "Rzeszowie",
  kielce: "Kielcach",
  olsztyn: "Olsztynie",
  opole: "Opolu",
  radom: "Radomiu",
  czestochowa: "Częstochowie",
  plock: "Płocku",
  siedlce: "Siedlcach",
  "zielona gora": "Zielonej Górze",
  "gorzow wielkopolski": "Gorzowie Wielkopolskim",
  "bielsko-biala": "Bielsku-Białej",
  gliwice: "Gliwicach",
  sosnowiec: "Sosnowcu",
  koszalin: "Koszalinie",
  elblag: "Elblągu",
  kalisz: "Kaliszu",
  legnica: "Legnicy",
  tarnow: "Tarnowie",
  "nowy sacz": "Nowym Sączu",
  zakopane: "Zakopanem",
};

export const inCity = (city: string) => LOCATIVE[normalize(city)] ?? city;

/**
 * Pierwsza wiadomość z prośbą o slot. Open mic → do organizatorów („macie”),
 * występ komika → do niego („masz”), z miastem.
 */
export function pitchMessage({ startsAt, cityName, openMic }: { startsAt: string; cityName: string | null; openMic: boolean }) {
  const date = format(parseISO(startsAt), "d.MM");
  if (openMic) return `Siemanko, macie może wolny slot na ${date}?`;
  return `Siemanko, masz może miejsce na open-mic’a ${date}${cityName ? ` w ${inCity(cityName)}` : ""}? 😄`;
}

/**
 * Do supportu dużego headlinera — to on pyta headlinera o open mica. Imię headlinera w nawiasie
 * (bez odmiany nazwisk), i tak edytujesz przed wysłaniem.
 */
export function supportMessage({ startsAt, cityName, headlinerName }: { startsAt: string; cityName: string | null; headlinerName: string | null }) {
  const date = format(parseISO(startsAt), "d.MM");
  const where = cityName ? ` w ${inCity(cityName)}` : "";
  return `Siemanko, robisz support ${date}${where}${headlinerName ? ` (${headlinerName})` : ""}? Jest szansa, żebym wskoczył na open-mica przed występem? Zapytasz? 😄`;
}
