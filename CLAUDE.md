# Jak pracujemy w tym repo

Zasady dla Claude Code (i każdego, kto tu pisze). Co apka robi i dlaczego — `docs/PRODUCT.md`
(dołączony niżej). `AGENTS.md` generuje `next dev`; trzymamy go, bo ostrzega przed zmianami
w Next 16.

## Zanim powiesz „gotowe”

1. `pnpm typecheck && pnpm lint && pnpm test` — wszystko zielone. To samo puszcza CI
   (`.github/workflows/test.yml`), więc czerwone lokalnie = czerwone na GitHubie.
2. Zmiana w UI: obejrzyj ją na szerokości telefonu (390 px), w trybie jasnym i ciemnym.
   Apka jest używana głównie z telefonu.
3. Zmiana schematu: przeczytaj wygenerowany SQL z `pnpm db:generate` (drizzle przy przebudowie
   tabeli potrafi kopiować kolumnę, której jeszcze nie ma).
4. Zaktualizuj `docs/PRODUCT.md`, jeśli zmieniło się zachowanie funkcji.

Hook w `.claude/settings.json` puszcza ESLint (`--max-warnings 0`) na każdym edytowanym pliku
`.ts/.tsx` — ostrzeżenie też trzeba poprawić, nie wyciszać.

## Granice architektury

- **Czysta logika** (scoring, rytm, parsery, dopasowania) w `src/lib/*.ts` bez importu bazy —
  żeby testować ją bez bazy. Odczyty z bazy w `src/lib/queries.ts` (`server-only`), osobne
  moduły `*-data.ts`, gdy logikę dzielą skrypty i powiadomienia.
- **Mutacje = server actions** w `src/app/actions.ts`. Każda zaczyna się od `requireSession()`;
  proxy to nie jest zabezpieczenie. Wyjątki bez sesji (cron, ingest biletów) sprawdzają
  `CRON_SECRET` porównaniem stałoczasowym.
- **Daty grań** to lokalny czas Warszawy jako tekst (`"2026-10-14T20:00"`), „teraz” z `nowLocal()`.
  Nie mieszaj z `new Date()` w strefie serwera; UTC tylko dla `createdAt`.
- **Kwoty w groszach** (`integer`), nigdy float.
- **Nowa zależność npm** — tylko po pytaniu. Wolimy kilkadziesiąt linii własnego kodu
  (czytnik PDF, parser biletów) niż bibliotekę do jednego zastosowania.
- **Progi i stałe** nazwane i opisane przy definicji (`COOLDOWN_DAYS`, `HOME_CITY`…), bez magicznych liczb w środku logiki.

## Testy

- Nowa czysta logika = test w `tests/*.test.ts` (`node:test`, bez frameworka).
- Nowy parser = przycięta prawdziwa strona w `tests/fixtures/` + oczekiwane wartości.
- Coś, co dotyka bazy (powiadomienia, mail) = test `*.test.mts` na tymczasowej bazie z migracjami.
- Dane osobowe (prawdziwe bilety, kopie bazy) nigdy w repo: `tests/fixtures/private/` jest lokalne,
  test bez pliku się pomija.
- Błąd znaleziony ręcznie = najpierw test, który go łapie.

## Styl kodu

- Komentarze po polsku i tylko tam, gdzie mówią **dlaczego** (nieoczywista decyzja, pułapka,
  ograniczenie zewnętrznego serwisu) — nie opisują, co robi następna linia.
- Pisz jak otaczający kod: te same komponenty (`ios.tsx`, `form.tsx`), tokeny kolorów, nazewnictwo.
- Bez martwego kodu, zakomentowanych bloków, `console.log`, „na zapas” abstrakcji i opcji,
  o które nikt nie prosił. Mniejszy diff wygrywa.
- Teksty w UI po polsku, ton luźny, jak w reszcie apki.

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
