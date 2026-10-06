import * as cheerio from "cheerio";
import type { ScrapedEvent, Source } from "../types";

const BASE = "https://www.kupbilecik.pl";
const MAX_PAGES = 120;

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
  async scrape({ fetchHtml, until, log }) {
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
    return [...out.values()];
  },
};
