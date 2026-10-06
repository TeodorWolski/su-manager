/** Wydarzenie w postaci wspólnej dla wszystkich serwisów. */
export type ScrapedEvent = {
  source: string;
  sourceId: string;
  url: string;
  title: string;
  /** Lokalny czas Warszawy "YYYY-MM-DDTHH:mm" albo sama data "YYYY-MM-DD". */
  startsAt: string;
  cityName: string | null;
  venueName: string | null;
  performers: string | null;
  /** Dostępność biletów; undefined = serwis tego nie podaje (nie nadpisujemy), null = normalna. */
  availability?: "last" | "sold_out" | null;
};

export type SourceContext = {
  fetchHtml: (url: string) => Promise<string>;
  /** Wydarzenia z tego serwisu już znane z bazy — parser może pominąć ich strony szczegółów. */
  known: Map<string, ScrapedEvent>;
  /** Nie zbieraj wydarzeń dalej w przyszłość niż ta data ("YYYY-MM-DD"). */
  until: string;
  log: (msg: string) => void;
};

/**
 * Parser jednego serwisu. Każdy w osobnym pliku w sources/ — gdy strona się zmieni,
 * poprawiasz tylko ten plik. Nowy serwis = nowy plik + wpis w sources/index.ts.
 */
export type Source = {
  name: string;
  scrape: (ctx: SourceContext) => Promise<ScrapedEvent[]>;
};
