import * as cheerio from "cheerio";
import type { ScrapedEvent, Source } from "../types";

const BASE = "https://www.kupbilecik.pl";
const MAX_PAGES = 120;

const isMorning = (startsAt: string) => startsAt.length > 10 && startsAt.slice(11, 13) < "12";

/**
 * Godzina przed południem to prawie zawsze pomyłka organizatora (06:00 zamiast 18:00).
 * Bierzemy „Start Wydarzenia: HH:MM” z opisu; bez niego — przed 10:00 dodajemy 12 h.
 */
export function fixMorning(startsAt: string, detailHtml: string) {
  const day = startsAt.slice(0, 10);
  const text = cheerio.load(detailHtml).text();
  const start = text.match(/Start\s+wydarzenia:?\s*(\d{1,2})[:.](\d{2})/i);
  if (start) return `${day}T${start[1].padStart(2, "0")}:${start[2]}`;
  const hour = Number(startsAt.slice(11, 13));
  return hour < 10 ? `${day}T${String(hour + 12).padStart(2, "0")}${startsAt.slice(13, 16)}` : startsAt;
}

/** Etykieta na kafelku: „ostatnie bilety” / „sold out”; brak = normalna dostępność. */
function availability(text: string): "last" | "sold_out" | null {
  const t = text.toLowerCase();
  if (t.includes("sold out") || t.includes("wyprzedane")) return "sold_out";
  if (t.includes("ostatnie bilety")) return "last";
  return null;
}

/**
 * Lista /pl/standup jest renderowana po stronie serwera, a kafelek ma wszystko
 * (tytuł, datę, miasto, miejsce) — strony szczegółów nie są potrzebne.
 * Sortowanie po dacie jest tylko przybliżone, a za ostatnią stroną serwis
 * zwraca w kółko te same kafelki — stąd dwa warunki stopu niżej.
 */
export const kupbilecik: Source = {
  name: "kupbilecik",
  async scrape({ fetchHtml, until, known, log }) {
    const out = new Map<string, ScrapedEvent>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const $ = cheerio.load(await fetchHtml(`${BASE}/pl/standup?page=${page}`));
      const tiles = $(".kb-search-list");
      if (!tiles.length) break;

      const before = out.size;
      let pastHorizon = 0;
      tiles.each((_, el) => {
        const tile = $(el);
        const link = tile.find("h2 a").first();
        const href = link.attr("href");
        const datetime = tile.find("time[datetime]").attr("datetime");
        const id = href?.match(/\/pl\/event\/(\d+)\//)?.[1];
        if (!href || !datetime || !id) return;

        const startsAt = datetime.slice(0, 16); // "2026-10-06T19:00:00+02:00" → czas lokalny
        if (startsAt.slice(0, 10) > until) {
          pastHorizon++;
          return;
        }
        out.set(id, {
          source: "kupbilecik",
          sourceId: id,
          url: new URL(href, BASE).toString(),
          title: link.text().trim(),
          startsAt,
          cityName: tile.find('a[href^="/pl/city/"]').first().text().trim() || null,
          venueName: tile.find('a[href^="/pl/place/"]').first().text().trim() || null,
          performers: null,
          availability: availability(tile.find(".kb-fw-300.rounded-3").text()),
        });
      });

      if (out.size === before && pastHorizon === 0) break; // koniec listy (powtórki)
      if (pastHorizon >= tiles.length * 0.8) break; // prawie cała strona za horyzontem
      if (page % 10 === 0) log(`kupbilecik: strona ${page}, ${out.size} wydarzeń`);
    }

    // Organizatorzy czasem wpisują 06:00 zamiast 18:00 — sprawdź poranne godziny na stronie wydarzenia.
    for (const e of out.values()) {
      if (!isMorning(e.startsAt)) continue;
      const prev = known.get(e.sourceId);
      if (prev && prev.startsAt.slice(0, 10) === e.startsAt.slice(0, 10) && !isMorning(prev.startsAt)) {
        e.startsAt = prev.startsAt; // już poprawione w poprzednim przebiegu
        continue;
      }
      const fixed = fixMorning(e.startsAt, await fetchHtml(e.url).catch(() => ""));
      if (fixed !== e.startsAt) log(`kupbilecik: ${e.title} ${e.startsAt} → ${fixed}`);
      e.startsAt = fixed;
    }
    return [...out.values()];
  },
};
