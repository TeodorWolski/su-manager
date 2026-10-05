import * as cheerio from "cheerio";
import type { ScrapedEvent, Source } from "../types";

const BASE = "https://evently.pl";
const MAX_PAGES = 20;

type LdEvent = {
  "@type"?: string;
  name?: string;
  startDate?: string;
  location?: { name?: string; address?: { addressLocality?: string } };
  performer?: { name?: string } | { name?: string }[];
};

function listingUrl(page: number, from: string) {
  const [y, m, d] = from.split("-");
  const params = new URLSearchParams({
    "filter[categories][]": "8", // stand-up
    "filter[from_date]": `${d}.${m}.${y} 00:00`,
    "filter[to_price]": "0", // darmowe — tu siedzą open miki
    page: String(page),
  });
  return `${BASE}/events?${params}`;
}

/** Tytuł z listingu bywa ucięty („…”), a w ld+json ma doklejone „ - Evently”. */
const cleanTitle = (t: string) => t.replace(/\s+-\s+Evently\s*$/, "").replace(/\s+/g, " ").trim();

/**
 * Listing ma tylko tytuł i datę; miasto, miejsce i godzinę bierzemy ze schema.org na stronie wydarzenia.
 * Strony szczegółów pobieramy tylko dla wydarzeń, których jeszcze nie ma w bazie.
 */
export const evently: Source = {
  name: "evently",
  async scrape({ fetchHtml, known, until, log }) {
    const today = new Date().toISOString().slice(0, 10);
    const links = new Map<string, string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const $ = cheerio.load(await fetchHtml(listingUrl(page, today)));
      const before = links.size;
      $('a.h4[href*="/events/"]').each((_, el) => {
        const href = $(el).attr("href")!;
        const id = href.match(/\/events\/(\d+)-/)?.[1];
        if (id) links.set(id, new URL(href, BASE).toString());
      });
      if (links.size === before) break;
    }

    const out: ScrapedEvent[] = [];
    for (const [id, url] of links) {
      const cached = known.get(id);
      if (cached) {
        out.push(cached);
        continue;
      }
      try {
        const $ = cheerio.load(await fetchHtml(url));
        const ld = $('script[type="application/ld+json"]')
          .toArray()
          .flatMap((el) => {
            try {
              const d = JSON.parse($(el).text());
              return Array.isArray(d) ? d : d["@graph"] ?? [d];
            } catch {
              return [];
            }
          })
          .find((d: LdEvent) => String(d["@type"]).includes("Event")) as LdEvent | undefined;
        if (!ld?.startDate) continue;
        const startsAt = ld.startDate.slice(0, 16);
        if (startsAt.slice(0, 10) > until) continue;
        const performers = [ld.performer ?? []].flat().map((p) => p.name).filter(Boolean).join(", ");
        out.push({
          source: "evently",
          sourceId: id,
          url,
          title: cleanTitle(ld.name ?? $("h1").first().text()),
          startsAt,
          cityName: ld.location?.address?.addressLocality?.trim() || null,
          venueName: ld.location?.name?.trim() || null,
          performers: performers || null,
        });
      } catch (e) {
        log(`evently: pomijam ${url} (${(e as Error).message})`);
      }
    }
    return out;
  },
};
