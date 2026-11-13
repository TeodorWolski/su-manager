# Jak pracujemy w tym repo

Zasady dla Claude Code (i każdego, kto tu pisze). Co apka robi i dlaczego — `docs/PRODUCT.md`
(dołączony niżej). `AGENTS.md` generuje `next dev`; trzymamy go, bo ostrzega przed zmianami
w Next 16.

## Zanim powiesz „gotowe”

1. `pnpm typecheck && pnpm lint && pnpm test` — wszystko zielone. To samo puszcza CI
   (`.github/workflows/test.yml`), więc czerwone lokalnie = czerwone na GitHubie.
2. Zmiana w UI: obejrzyj ją na szerokości telefonu (390 px), w trybie jasnym i ciemnym.
   Apka jest używana głównie z telefonu. `local.db` bywa pusta z przodu (brak nadchodzących
   grań) — wtedy odtwórz kopię do tymczasowego pliku poza repo i odpal `next dev`
   z `DATABASE_URL=file:…` i pustym `APP_PASSWORD`; dane w kopii zmieniaj śmiało, lokalnej
   i produkcyjnej bazy nie.
3. Zmiana schematu: przeczytaj wygenerowany SQL z `pnpm db:generate` (drizzle przy przebudowie
   tabeli potrafi kopiować kolumnę, której jeszcze nie ma).
4. Zaktualizuj `docs/PRODUCT.md`, jeśli zmieniło się zachowanie funkcji.

Hook w `.claude/settings.json` puszcza ESLint (`--max-warnings 0`) na każdym edytowanym pliku
`.ts/.tsx/.mts` — ostrzeżenie też trzeba poprawić, nie wyciszać.

## Granice architektury

- **Czysta logika** (scoring, rytm, parsery, dopasowania — np. `market.ts`, `route.ts`,
  `ticket-parse.ts`) w osobnych modułach `src/lib/*.ts` bez importu bazy, żeby testować ją bez
  bazy. Dostęp do bazy: `src/lib/queries.ts` (`server-only`) dla stron; bez `server-only`
  moduły, których używają też skrypty, powiadomienia i API (`planning.ts`, `notify.ts`,
  `opportunities.ts`, `*-data.ts`, `morning-mail.ts`, `trip-ingest.ts`).
- **Mutacje = server actions** (`src/app/actions.ts`, `src/app/settings/security/actions.ts`).
  Każda zaczyna się od `requireSession()`; proxy to nie jest zabezpieczenie. Jedyny wyjątek
  to logowanie (`src/app/login/actions.ts`). Trasy bez sesji (cron, ingest biletów, feed
  kalendarza) sprawdzają token porównaniem stałoczasowym — `secretMatches()` z `src/lib/secret.ts`,
  nie własnym `===`.
- **Daty grań** to lokalny czas Warszawy jako tekst (`"2026-10-14T20:00"`), „teraz” z `nowLocal()`.
  Nie mieszaj z `new Date()` w strefie serwera; UTC tylko dla znaczników technicznych
  (`createdAt`, `firstSeenAt`, znaczniki w `app_state`). Dni licz przez `addDays` / `daysBetween` / `dayOf`
  z `src/lib/time.ts`, nie własnym `Date.parse(...) / 864e5`.
- **Kwoty w groszach** (`integer`), nigdy float.
- **Nowa zależność npm** — tylko po pytaniu. Wolimy kilkadziesiąt linii własnego kodu
  (czytnik PDF, parser biletów) niż bibliotekę do jednego zastosowania.
- **Progi i stałe** nazwane i opisane przy definicji (`COOLDOWN_DAYS`, `HOME_CITY`…), bez magicznych liczb w środku logiki.
- **Analityka** tylko przez `track()` / `identify()` z `src/lib/analytics.ts`; nowe zdarzenie
  dopisz do listy `AnalyticsEvent`. We właściwościach liczby i flagi, nigdy treść z CRM
  (nazwiska, notatki, teksty wiadomości).
- **Refaktor „bez zmiany zachowania”** to obietnica do sprawdzenia: przy przepinaniu logiki
  uruchom stary kod (z `git archive HEAD`) i nowy obok siebie na losowych danych i porównaj
  wyniki, w `TZ=UTC` i `TZ=Europe/Warsaw`. Testy jednostkowe łapią tylko przewidziane przypadki.

## Testy

- Nowa czysta logika = test w `tests/*.test.ts` (`node:test`, bez frameworka).
- Nowy parser = przycięta prawdziwa strona w `tests/fixtures/` + oczekiwane wartości.
- Coś, co dotyka bazy (powiadomienia, mail) = test `*.test.mts` na tymczasowej bazie z migracjami.
- Dane osobowe (prawdziwe bilety, kopie bazy) nigdy w repo: `tests/fixtures/private/` trzymamy
  tylko lokalnie, a test bez tego pliku się pomija (w CI też).
- Błąd znaleziony ręcznie = najpierw test, który go łapie.

## Styl kodu

- Komentarze po polsku i tylko tam, gdzie mówią **dlaczego** (nieoczywista decyzja, pułapka,
  ograniczenie zewnętrznego serwisu) — nie opisują, co robi następna linia.
- Pisz jak otaczający kod: te same komponenty (`ios.tsx`, `form.tsx`), tokeny kolorów, nazewnictwo.
- Bez martwego kodu, zakomentowanych bloków, `console.log`, „na zapas” abstrakcji i opcji,
  o które nikt nie prosił. Mniejszy diff wygrywa.
- Teksty w UI po polsku, ton luźny, jak w reszcie apki.

## Repo jest publiczne

Wszystko, co trafia na GitHuba, czyta każdy: kod, historia, opisy commitów, zakładka Actions.

- **Nic wrażliwego w Actions.** Artifact publicznego repo pobierze każdy zalogowany, logi
  widzi każdy. Workflow nie wrzuca kopii bazy ani jej fragmentów (kopia idzie mailem),
  a skrypty logują liczby, nie treść (bez nazwisk, notatek, adresów).
- **Dane w testach i fixtures zmyślone** („Jan Kowalski”, „Kasia Testowa”, numery z zer).
  Strony bileterii w `tests/fixtures/` są OK — to publiczne wydarzenia.
- **Bez jednorazowych skryptów z prawdziwymi danymi** (import historii grań itp.) — odpal
  lokalnie i nie commituj.
- **Historii nie da się cofnąć** (force-push jest zablokowany), więc czytaj diff przed
  commitem pod kątem danych osobowych, nie tylko sekretów.

## Produkcja — zawsze pytaj

Produkcyjna baza to źródło prawdy (wpisuję dane codziennie). Bez wyraźnej zgody nie:

- `git push` na `main` (= auto-deploy na Vercel),
- migracje i zapisy w bazie Turso `su-manager`,
- zmiany env na Vercelu i sekretów na GitHubie.

Kolejność wydania z migracją: kopia bazy → migracja prod i preview → dopiero push.
`.claude/settings.json` wymusza pytanie przy `git push`, `turso`, `vercel env`, `gh secret`
i odczycie `.env*`; force-push i usuwanie bazy są zablokowane.

## Commity

- Jedna funkcja / poprawka na commit, opis po polsku: co i po co.
- Nie dodawaj do commita cudzych niezacommitowanych zmian — stage'uj konkretne pliki,
  nie `git add -A`.
- Nie commituj `backup-*.sql`, `local.db`, `.env*`, `podglad.html`.

---

@AGENTS.md
@docs/PRODUCT.md
