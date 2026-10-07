# SU Manager

Osobista apka do zarządzania graniem stand-upu: grania + pipeline statusów, log po występie, CRM, materiał, sceny.

Stack: Next.js 16 · Drizzle · SQLite (lokalnie plik, na produkcji Turso) · shadcn/Tailwind 4.

## Lokalnie

```bash
pnpm install
pnpm db:migrate   # tworzy local.db
pnpm db:seed      # słownik miast z czasem dojazdu (idempotentne)
pnpm dev
```

Zmiana schematu: edytuj `src/db/schema.ts`, potem `pnpm db:generate && pnpm db:migrate`.

## Zmienne środowiskowe

| Zmienna | Opis |
| --- | --- |
| `DATABASE_URL` | `libsql://…turso.io` na produkcji; domyślnie `file:local.db` |
| `DATABASE_AUTH_TOKEN` | token Turso |
| `APP_PASSWORD` | hasło basic auth (login dowolny). Bez niego apka jest otwarta |

## Jak to działa

- **Bramka oceny** (`src/components/review-gate.tsx`): 90 min po starcie potwierdzonego grania bez logu (a gdy granie nie ma godziny — o 21:00 tego dnia) cała apka zostaje zasłonięta formularzem. Formularz znika po zapisaniu logu albo po kliknięciu „nie zagrałem”.
- Daty grań są trzymane jako lokalny czas Warszawy (`2026-10-14T20:00`); `nowLocal()` w `src/lib/time.ts` liczy „teraz” w tej samej strefie, niezależnie od serwera.

## Scraper okazji

- `pnpm scrape` — zbiera wydarzenia z bileterii, zapisuje nowe, wysyła mail z nowymi okazjami (Resend). Bez `RESEND_API_KEY` mail jest tylko logowany.
- Parsery: `src/scraper/sources/*.ts`, jeden plik na serwis. Gdy strona zmieni HTML — poprawiasz tylko ten plik. Nowy serwis = nowy plik + wpis w `sources/index.ts`.
- Współrzędne miejscowości do „Jestem w…” w Okazjach: `src/data/places-pl.json` z GeoNames (CC BY 4.0). Odświeżenie: pobierz `https://download.geonames.org/export/dump/PL.zip`, rozpakuj i uruchom `pnpm tsx scripts/build-places.ts PL.txt`.
- Filtr i dopasowanie do CRM: `src/lib/opportunities.ts`, `src/lib/match.ts`.
- Cron: `.github/workflows/scrape.yml` (codziennie o 10:30 czasu polskiego, niezależnie od czasu letniego/zimowego + ręcznie z zakładki Actions). Podsumowanie tygodnia: `.github/workflows/weekly.yml` (niedziela 19:00, `pnpm weekly`, te same sekrety). Sekrety repo: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `RESEND_API_KEY`, `REPORT_EMAIL`. Padnięty parser = czerwony build, GitHub wysyła o tym mail.

## Testy scraperów

- `pnpm test` — parsery kupbilecik / evently / Biletyny na zapisanych, przyciętych stronach (`tests/fixtures/`), deduplikacja i kontrola zdrowia. Puszczane automatycznie przy każdym pushu (`.github/workflows/test.yml`, razem z typecheckiem i lintem).
- **Kontrola zdrowia** (`src/scraper/health.ts`) w codziennym przebiegu: 0 wydarzeń albo spadek o ponad połowę względem ostatnich dni, albo >30% wydarzeń bez miasta / >40% bez godziny → czerwony „Scraper okazji”, GitHub wysyła mail. To łapie zmianę strony bileterii, której testy na zapisanych plikach nie widzą.
- Serwis zmienił stronę? `pnpm tsx scripts/update-fixtures.ts` pobiera świeże strony do `tests/fixtures/`, poprawiasz parser, aktualizujesz oczekiwane wartości w `tests/scrapers.test.ts`.

## Kopie zapasowe i podglądy

- **Kopia bazy:** co niedzielę `.github/workflows/backup.yml` robi pełny zrzut produkcji (`pnpm backup`) i trzyma go 90 dni w GitHub Actions → przebieg → Artifacts. Ręcznie: Actions → „Kopia zapasowa bazy” → Run workflow.
- **Odtworzenie:** pobierz artefakt, `gunzip su-manager-RRRR-MM-DD.sql.gz`, potem do pustej bazy: `turso db shell <nowa-baza> < su-manager-RRRR-MM-DD.sql` (albo lokalnie `sqlite3 odtworzona.db < plik.sql`).
- **Podglądy (gałęzie):** wersje podglądowe w Vercelu używają osobnej bazy `su-manager-preview` (kopii produkcji), więc klikanie na podglądzie nie zmienia prawdziwych danych. Świeża kopia produkcji: `turso db destroy su-manager-preview`, potem `turso db create su-manager-preview --from-db su-manager`, `turso db tokens create su-manager-preview` i nowy token wpisz jako `DATABASE_AUTH_TOKEN` dla środowiska Preview w Vercelu.
