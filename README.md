# SU Manager

Osobista apka do zarządzania graniem stand-upu: grania i pipeline statusów, log zaraz po
zejściu ze sceny, CRM komików i organizatorów, materiał, sceny. Jeden użytkownik, używana
z telefonu (PWA), w codziennym użyciu od października 2026. Zastąpiła arkusz i jakieś
10–15 godzin ręcznej roboty tygodniowo.

Stack: Next.js 16 · Drizzle · SQLite (lokalnie plik, na produkcji Turso) · Tailwind 4 · Vercel.

W liczbach: 2 100+ wydarzeń zebranych z bileterii w pierwszy miesiąc, 18 migracji schematu,
21 plików testów (~110 testów), zero zewnętrznych bibliotek do PDF.

## Co działa beze mnie

- Scraper trzech bileterii codziennie (10:30 z zewnętrznego crona, harmonogram GitHuba jako zapas) z kontrolą zdrowia przebiegu, która łapie zmianę strony
  serwisu — czego testy na zapisanych plikach z definicji nie zobaczą
- Poranny mail i pushe: do kogo ponowić, najgorętsze okazje, nowe terminy komików z CRM,
  co jeszcze gra w okolicy, gdy i tak jadę na granie do innego miasta
- Niedzielne podsumowanie tygodnia
- Bilety kolejowe z Gmaila przez integrację z Google Apps Script (skrypt co 10 min wysyła nowe
  bilety do API apki): PDF → tekst → parser → podpięcie do grania → powiadomienie
- Cotygodniowa kopia bazy z GitHub Actions, wysyłana mailem

## Co może być ciekawe w kodzie

- **Wyuczone wyprzedzenie** (`src/lib/lead-time.ts`) — ile dni przed występem pisać do
  konkretnego komika, liczone z wyników poprzednich rozmów, z fallbackiem na ogólne,
  gdy próbka jest za mała
- **Ranking „kto sprzedaje sale"** (`src/lib/market.ts`) — popyt razy skala trasy,
  wygładzony tak, żeby dwa sold outy z trzech terminów nie robiły gwiazdy
- **Kiedy komik wrzuca terminy** (`announceLead` w `src/lib/market.ts`) — mediana czasu od
  pojawienia się wydarzenia w bileterii do występu. Scraper patrzy tylko 90 dni naprzód, więc
  termin „pojawiający się” na granicy horyzontu to dana ucięta: zamiast fałszywego „90 dni”
  wynik to „ponad 3 miesiące”
- **Prognoza celu miesiąca** (`src/lib/forecast.ts`) — ile grań wyjdzie z tego, co zagrane,
  potwierdzone i w toku, i do ilu osób jeszcze napisać. Skuteczność rozmów jest wygładzona
  założeniem „co trzecia”, bo przy kilkunastu rozmowach 2 zgody z 2 dałyby 100%; karta sama
  mówi, kiedy liczba jest jeszcze szacunkiem
- **„Skoro już jedziesz”** (`src/lib/while-there.ts`) — z potwierdzonych grań i biletów
  kolejowych składa pobyty poza domem (dzień przed i po, rozszerzone o bilety) i szuka grań
  w okolicy w wolne dni. Próg 80 km od domu wyszedł z danych: bez niego granie pod Warszawą
  podsuwało warszawskie wydarzenia
- **Trasa** (`src/lib/route.ts`) — jadę z A do B na dzień D: grania po drodze przez N dni,
  w korytarzu wzdłuż linii trasy; plan wybiera najwyżej jedno granie dziennie tak, żeby
  jechać do przodu (programowanie dynamiczne)
- **Ten sam występ w dwóch bileteriach** (`src/lib/dedupe.ts`) — inny tytuł, ta sama data,
  miasto i godzina ±60 min plus wspólne nazwisko; ta sama logika rozstrzyga, czy wydarzenie
  to „moje granie”, czy tylko inne granie tego samego wieczoru
- **Cykliczne open miki** (`src/lib/recurring.ts`) — wykrywanie stałego rytmu (co tydzień,
  co 2 tygodnie, n-ty dzień tygodnia w miesiącu) i przewidywane terminy, które ustępują
  prawdziwym, gdy te pojawią się w bileterii
- **Propozycja setu** (`src/lib/set-plan.ts`) — w dniu grania: pewniaki na otwarcie
  i zamknięcie, w środku jeden bit do przetestowania, w budżecie minut z poprzedniego razu
  na tej scenie
- **Własny czytnik PDF bez zależności** (`src/lib/pdf-text.ts`) — FlateDecode, ObjStm,
  fonty CID z ToUnicode; ten sam kod działa na serwerze (zlib) i w przeglądarce
  (`DecompressionStream`)
- **Log bez zasięgu** — kolejka w telefonie i osobny `offline.html` bez Nexta, zapis idempotentny
- **Czysta logika osobno od bazy** w `src/lib/*`, dzięki czemu większość z 21 plików testów
  nie potrzebuje bazy; te, które jej potrzebują (powiadomienia, mail), stawiają tymczasową
  bazę z migracjami
- Dokumentacja domeny: [`docs/PRODUCT.md`](docs/PRODUCT.md)

## Decyzje, które warto znać

- **Tanio i prosto:** Vercel Hobby i darmowy Turso, bez kolejek. Godziny trzyma zewnętrzny
  cron, harmonogram GitHuba jest tylko zapasem; maile wychodzą raz dziennie (znacznik
  w bazie), więc zapas ich nie dubluje
- **Przypomnienia nie przepadają:** gdy nie ma zapisanego urządzenia, push nic nie odhacza
  jako wysłane; telefon sam odnawia subskrypcję, którą iOS unieważnił
- **Bezpieczeństwo:** sesja w podpisanym ciasteczku i Face ID (passkeys, WebAuthn) zamiast
  basic auth; każda akcja serwerowa sama sprawdza sesję, nie tylko proxy. Dane biletu przy
  imporcie są w adresie po „#”, więc nie trafiają do logów serwera
- **Bez kluczy działa, tylko skromniej:** mail, pushe, kalendarz, bilety z Gmaila i analityka
  (PostHog) wyłączają się, gdy brakuje ich zmiennej w środowisku. Apka startuje po sklonowaniu
  bez żadnej konfiguracji, a brakujący sekret zamyka trasę, zamiast ją otwierać
  (`src/lib/secret.ts`)
- **Produkcyjna baza to źródło prawdy:** kolejność wydania to kopia bazy → migracja →
  dopiero deploy

## Praca z Claude Code

Apkę rozwijam z Claude Code. Zasady pracy są w repo, a nie w głowie:

- [`CLAUDE.md`](CLAUDE.md) — co musi przejść przed „gotowe” (typecheck, lint, testy, podgląd
  na telefonie), granice architektury, zasady testów i stylu, czego nie robić bez pytania
- [`.claude/settings.json`](.claude/settings.json) — egzekwowanie: ESLint po każdej edycji pliku
  TS (ostrzeżenia też blokują), pytanie przed `git push`, komendami Turso, env na Vercelu
  i sekretami GitHuba; force-push i usunięcie bazy zablokowane
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — dokumentacja domeny: słownik pojęć, które łatwo pomylić,
  i opis każdej funkcji z plikami, w których żyje

Przykład z praktyki: liczenie dni było wpisane osobno w kilkunastu modułach, pod tą samą nazwą
w trzech wariantach. Po przeniesieniu do jednego miejsca stary i nowy kod zostały uruchomione
obok siebie na kilkuset losowych zestawach danych (rytm, okazje, ponawianie, ranking, trasa),
w strefie serwera i warszawskiej — dopiero identyczne wyniki zamknęły zmianę. Same testy
jednostkowe by tego nie pokazały, bo sprawdzają przypadki, które ktoś przewidział.

---

## Uruchomienie i utrzymanie

### Lokalnie

```bash
pnpm install
pnpm db:migrate   # tworzy local.db
pnpm db:seed      # słownik miast z czasem dojazdu (idempotentne)
pnpm dev
```

Zmiana schematu: edytuj `src/db/schema.ts`, potem `pnpm db:generate && pnpm db:migrate`.

### Zmienne środowiskowe

| Zmienna | Opis |
| --- | --- |
| `DATABASE_URL` | `libsql://…turso.io` na produkcji; domyślnie `file:local.db` |
| `DATABASE_AUTH_TOKEN` | token Turso |
| `APP_PASSWORD` | hasło logowania (ekran `/login`; Face ID dodasz po zalogowaniu). Bez niego — lokalnie — apka jest otwarta |
| `CRON_SECRET` | token dla `/api/notify/*` i `/api/ingest/ticket` (cron-job.org, skrypt Gmaila) |
| `CALENDAR_TOKEN` | tajny token w adresie feedu `/calendar/<token>.ics`; bez niego kalendarz jest wyłączony |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | analityka i błędy w PostHogu; bez nich analityka jest wyłączona |
| `SESSION_SECRET` | opcjonalnie: klucz podpisu sesji (domyślnie wyprowadzany z `APP_PASSWORD`) |

### Jak to działa

- **Bramka oceny** (`src/components/review-gate.tsx`): 90 min po starcie potwierdzonego grania bez logu, ale nie przed 20:00 (a gdy granie nie ma godziny — o 21:00 tego dnia), cała apka zostaje zasłonięta formularzem. Formularz znika po zapisaniu logu albo po kliknięciu „nie zagrałem”.
- Daty grań są trzymane jako lokalny czas Warszawy (`2026-10-14T20:00`); `nowLocal()` w `src/lib/time.ts` liczy „teraz” w tej samej strefie, niezależnie od serwera.

### Scraper okazji

- `pnpm scrape` — zbiera wydarzenia z bileterii i zapisuje nowe. Poranny mail wysyła tylko zapasowo (główny idzie z Vercela, patrz niżej); bez `RESEND_API_KEY` mail jest pomijany.
- Parsery: `src/scraper/sources/*.ts`, jeden plik na serwis. Gdy strona zmieni HTML — poprawiasz tylko ten plik. Nowy serwis = nowy plik + wpis w `sources/index.ts`.
- Współrzędne miejscowości do „Jestem w…” w Okazjach: `src/data/places-pl.json` z GeoNames (CC BY 4.0). Odświeżenie: pobierz `https://download.geonames.org/export/dump/PL.zip`, rozpakuj i uruchom `pnpm tsx scripts/build-places.ts PL.txt`.
- Filtr i dopasowanie do CRM: `src/lib/opportunities.ts`, `src/lib/match.ts`.
- Cron: `.github/workflows/scrape.yml` — uruchamiany o 10:30 przez zewnętrzny cron (niżej), własny harmonogram GitHuba o 12:00 czasu polskiego tylko jako zapas (niezależnie od czasu letniego/zimowego); ręcznie z zakładki Actions. Podsumowanie tygodnia: `.github/workflows/weekly.yml` (niedziela 19:00, `pnpm weekly`, te same sekrety). Sekrety repo: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `RESEND_API_KEY`, `REPORT_EMAIL`. Padnięty parser = czerwony build, GitHub wysyła o tym mail.

### Zewnętrzny cron (cron-job.org) i powiadomienia

GitHubowy harmonogram potrafi spóźnić się o kilka godzin, więc godziny trzyma darmowy cron-job.org (strefa **Europe/Warsaw**). GitHub zostaje jako zapas (poranny 12:00, niedzielny 21:00); maile idą raz dziennie (`app_state`), więc zapas ich nie dubluje.

| Kiedy | Żądanie | Nagłówki |
| --- | --- | --- |
| codziennie 10:30 | `POST https://api.github.com/repos/TeodorWolski/su-manager/actions/workflows/scrape.yml/dispatches`, body `{"ref":"main"}` | `Authorization: Bearer <token GitHub>`, `Accept: application/vnd.github+json` |
| niedziela 19:00 | to samo dla `weekly.yml` | jw. |
| codziennie 10:35 | `GET https://su-manager.vercel.app/api/notify/morning` — poranne pushe **i poranny mail** | `Authorization: Bearer <CRON_SECRET>` |
| codziennie 21:00 | `GET https://su-manager.vercel.app/api/notify/evening` | jw. |

- **Token GitHub:** fine-grained, tylko repo `su-manager`, uprawnienie *Actions: Read and write*.
- **Powiadomienia (Web Push):** zmienne w Vercelu (Production): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` — wartości z `.env.local` (wygenerowane `web-push`). Publiczny klucz wchodzi w build, więc ustaw je **przed** deployem. Włączenie na telefonie: Więcej → Powiadomienia (iPhone: najpierw „Do ekranu początkowego”).
- **Poranny mail** idzie z Vercela (`/api/notify/morning`, `src/lib/morning-mail.ts`), więc nie zależy od GitHuba. Zmienne w Vercelu (Production): `RESEND_API_KEY`, `REPORT_EMAIL`. Bez nich Vercel maila nie wysyła i nic nie odhacza — wtedy wyśle go zapasowo scraper na GitHubie. „Nowe terminy” w mailu = dodane od poprzedniego maila, więc scraper może przejść o dowolnej porze.
- Ręcznie z Actions: „Run workflow” z opcją „wyślij mail mimo to”, gdy chcesz drugi mail tego samego dnia.

### Testy scraperów

- `pnpm test` — parsery kupbilecik / evently / Biletyny na zapisanych, przyciętych stronach (`tests/fixtures/`), deduplikacja i kontrola zdrowia. Puszczane automatycznie przy każdym pushu (`.github/workflows/test.yml`, razem z typecheckiem i lintem).
- **Kontrola zdrowia** (`src/scraper/health.ts`) w codziennym przebiegu: 0 wydarzeń albo spadek o ponad połowę względem ostatnich dni, albo >30% wydarzeń bez miasta / >40% bez godziny → czerwony „Scraper okazji”, GitHub wysyła mail. To łapie zmianę strony bileterii, której testy na zapisanych plikach nie widzą.
- Serwis zmienił stronę? `pnpm tsx scripts/update-fixtures.ts` pobiera świeże strony do `tests/fixtures/`, poprawiasz parser, aktualizujesz oczekiwane wartości w `tests/scrapers.test.ts`.

### Kopie zapasowe i podglądy

- **Kopia bazy:** co niedzielę `.github/workflows/backup.yml` robi pełny zrzut produkcji (`pnpm backup --mail`) i wysyła go (gzip) mailem na `REPORT_EMAIL`. Ręcznie: Actions → „Kopia zapasowa bazy” → Run workflow.
- **Odtworzenie:** zapisz załącznik z maila, `gunzip su-manager-RRRR-MM-DD.sql.gz`, potem do pustej bazy: `turso db shell <nowa-baza> < su-manager-RRRR-MM-DD.sql` (albo lokalnie `sqlite3 odtworzona.db < plik.sql`).
- **Podglądy (gałęzie):** wersje podglądowe w Vercelu używają osobnej bazy `su-manager-preview` (kopii produkcji), więc klikanie na podglądzie nie zmienia prawdziwych danych. Świeża kopia produkcji: `turso db destroy su-manager-preview`, potem `turso db create su-manager-preview --from-db su-manager`, `turso db tokens create su-manager-preview` i nowy token wpisz jako `DATABASE_AUTH_TOKEN` dla środowiska Preview w Vercelu.
