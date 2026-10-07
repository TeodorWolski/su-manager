/** Grzeczny klient: przedstawia się, jeden request naraz, przerwa między requestami, retry na 429/5xx i timeout/sieć. */
const USER_AGENT = "Mozilla/5.0 (compatible; SU-Manager/1.0; personal use, 1 req/2s)";
const MIN_INTERVAL_MS = 2000;

let lastRequestAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchHtml(url: string, attempt = 1): Promise<string> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pl-PL,pl;q=0.9" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    // Timeout albo zerwane połączenie — zwykle chwilowe, spróbuj jeszcze raz z przerwą.
    if (attempt < 3) {
      await sleep(attempt * 10_000);
      return fetchHtml(url, attempt + 1);
    }
    throw e;
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await sleep(attempt * 10_000);
    return fetchHtml(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}
