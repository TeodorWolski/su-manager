/**
 * Odświeża przycięte strony bileterii w tests/fixtures/ (dane do testów parserów).
 * Uruchom, gdy serwis zmienił stronę i poprawiasz parser:  pnpm tsx scripts/update-fixtures.ts
 * Po odświeżeniu sprawdź, czy oczekiwane wartości w tests/scrapers.test.ts dalej się zgadzają.
 */
import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";
const UA = { "User-Agent": "Mozilla/5.0 (compatible; SU-Manager/1.0; personal use, 1 req/2s)", "Accept-Language": "pl-PL" };
const get = async (u: string) => { const r = await fetch(u, { headers: UA }); await new Promise((x) => setTimeout(x, 2000)); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.text(); };
const out = (f: string, s: string) => { writeFileSync(`tests/fixtures/${f}`, s); console.log(f, s.length); };
const ldOnly = (html: string) => {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray().map((el) => `<script type="application/ld+json">${$(el).html()}</script>`);
  return `<!doctype html><html><head><title>${$("title").text()}</title></head><body><h1>${$("h1").first().text()}</h1>${scripts.join("\n")}<div class="opis">${$("body").text().match(/Start\s+wydarzenia:?\s*\d{1,2}[:.]\d{2}/i)?.[0] ?? ""}</div></body></html>`;
};

async function main() {
  // kupbilecik: lista (pierwsze 10 kafelków) + strona wydarzenia z pomyłką 06:00
  {
    const $ = cheerio.load(await get("https://www.kupbilecik.pl/pl/standup?page=1"));
    const tiles = $(".kb-search-list").toArray();
    // Kafelki z etykietami dostępności na pewno w środku, plus kilka zwykłych.
    const pick = [...tiles.filter((t) => /sold out|ostatnie bilety/i.test($(t).find(".kb-fw-300.rounded-3").text())).slice(0, 4), ...tiles.slice(0, 6)];
    out("kupbilecik-list.html", `<!doctype html><html><body>${[...new Set(pick)].map((t) => $.html(t)).join("\n")}</body></html>`);
    out("kupbilecik-event-morning.html", ldOnly(await get("https://www.kupbilecik.pl/pl/event/221990/warszawa/stand-up-open-mic")));
  }
  // evently: listing + jedno wydarzenie
  {
    const today = new Date().toISOString().slice(0, 10);
    const [y, m, d] = today.split("-");
    const p = new URLSearchParams({ "filter[categories][]": "8", "filter[from_date]": `${d}.${m}.${y} 00:00`, "filter[to_price]": "0", page: "1" });
    const html = await get(`https://evently.pl/events?${p}`);
    const $ = cheerio.load(html);
    const links = $('a.h4[href*="/events/"]').toArray();
    out("evently-list.html", `<!doctype html><html><body>${links.slice(0, 5).map((a) => $.html(a)).join("\n")}</body></html>`);
    const href = $(links[0]).attr("href")!;
    out("evently-event.html", ldOnly(await get(new URL(href, "https://evently.pl").toString())));
    console.log("evently first:", href);
  }
  // biletyna: sitemap (fragment) + strona programu
  {
    const sm = await get("https://biletyna.pl/sitemap/sitemap-events.xml");
    const locs = [...sm.matchAll(/<url><loc>[^<]+<\/loc><\/url>/g)].map((m) => m[0]);
    const standup = locs.filter((l) => l.includes("/stand-up/Piotr-Baltroczyk"));
    out("biletyna-sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...locs.filter((l) => !l.includes("/stand-up/")).slice(0, 3), ...standup.slice(0, 3)].join("\n")}\n</urlset>`);
    out("biletyna-program.html", ldOnly(await get("https://biletyna.pl/stand-up/Piotr-Baltroczyk")));
  }
}

main();
