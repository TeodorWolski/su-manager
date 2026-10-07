import type { ScrapedEvent, Source } from "../types";

const BASE = "https://biletyna.pl";
/**
 * Tyle wolnych miejsc i mniej = „ostatnie bilety”. Biletyna podaje liczbę dla swojej puli biletów,
 * która bywa mała przy normalnej sprzedaży (9, 15…), stąd niski próg.
 */
const LAST_TICKETS = 10;

type LdEvent = {
  "@type"?: string;
  name?: string;
  url?: string;
  startDate?: string;
  eventStatus?: string;
  remainingAttendeeCapacity?: number;
  location?: { name?: string; address?: { addressLocality?: string } };
  performer?: { name?: string } | { name?: string }[];
  offers?: { availability?: string };
};

/** Wszystkie wydarzenia ze schema.org na stronie — Biletyna zagnieżdża je w ItemList / performerach. */
function* walk(x: unknown): Generator<LdEvent> {
  if (Array.isArray(x)) for (const v of x) yield* walk(v);
  else if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (String(o["@type"] ?? "").includes("Event") && o.startDate) yield o as LdEvent;
    for (const v of Object.values(o)) yield* walk(v);
  }
}

export function eventsFromHtml(html: string): LdEvent[] {
  const out: LdEvent[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      out.push(...walk(JSON.parse(m[1])));
    } catch {
      // uszkodzony blok — pomijamy, reszta strony dalej się liczy
    }
  }
  return out;
}

/** „Czersk (pow. chojnicki)” → „Czersk”. */
const cleanCity = (c: string | undefined) => c?.replace(/\s*\(.*\)\s*$/, "").trim() || null;

function availability(e: LdEvent): "last" | "sold_out" | null {
  if (e.offers?.availability?.endsWith("SoldOut") || e.remainingAttendeeCapacity === 0) return "sold_out";
  if (e.remainingAttendeeCapacity != null && e.remainingAttendeeCapacity <= LAST_TICKETS) return "last";
  return null;
}

/**
 * Biletyna: lista /stand-up doczytuje kolejne strony przez /ajax/ (zabronione w robots.txt), więc
 * programy bierzemy z publicznej sitemapy wydarzeń, a terminy — ze schema.org na stronie programu
 * (/stand-up/Artysta/Program pokazuje wszystkie miasta i daty). ~130 stron dziennie, 1 req / 2 s.
 */
export const biletyna: Source = {
  name: "biletyna",
  async scrape({ fetchHtml, until, log }) {
    const sitemap = await fetchHtml(`${BASE}/sitemap/sitemap-events.xml`);
    const programs = new Set<string>();
    for (const m of sitemap.matchAll(/<loc>https:\/\/biletyna\.pl\/stand-up\/([^<]+)<\/loc>/g)) {
      programs.add(m[1].split("/").slice(0, 2).join("/"));
    }
    if (!programs.size) throw new Error("biletyna: pusta sitemapa stand-upu — zmienił się format?");
    log(`biletyna: ${programs.size} programów`);

    const out = new Map<string, ScrapedEvent>();
    let done = 0;
    for (const program of programs) {
      const html = await fetchHtml(`${BASE}/stand-up/${program}`).catch((e: Error) => {
        log(`biletyna: pomijam ${program} (${e.message})`);
        return "";
      });
      for (const e of eventsFromHtml(html)) {
        const id = e.url?.match(/[?&]eid=(\d+)/)?.[1];
        if (!id || !e.name || !e.startDate) continue;
        if (/Cancelled|Postponed/.test(e.eventStatus ?? "")) continue;
        const startsAt = e.startDate.slice(0, 16); // "2026-10-09T19:00:00+02:00" → czas lokalny
        if (startsAt.slice(0, 10) > until) continue;
        const performers = (Array.isArray(e.performer) ? e.performer : [e.performer])
          .map((p) => p?.name)
          .filter(Boolean)
          .join(", ");
        out.set(id, {
          source: "biletyna",
          sourceId: id,
          url: e.url!.split("#")[0],
          title: e.name.replace(/\s+/g, " ").trim(),
          startsAt,
          cityName: cleanCity(e.location?.address?.addressLocality),
          venueName: e.location?.name?.trim() || null,
          performers: performers || null,
          availability: availability(e),
        });
      }
      if (++done % 25 === 0) log(`biletyna: ${done}/${programs.size} programów, ${out.size} terminów`);
    }
    return [...out.values()];
  },
};
