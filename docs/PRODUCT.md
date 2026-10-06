# SU Manager — funkcje i założenia

Kontekst dla agentów pracujących w tym repo. Techniczne „jak uruchomić” jest w `README.md`; tu jest **co** apka robi i **dlaczego** tak.

## Czym jest

Osobista apka jednego użytkownika: komika stand-upowego (i frontendowca) z Warszawy. Służy do:

- planowania i zdobywania grań,
- logowania występów zaraz po zejściu ze sceny,
- prowadzenia CRM komików, organizatorów i scen,
- pracy nad materiałem (bity).

Używana głównie **z telefonu** (PWA, styl iOS). Produkcyjna baza to źródło prawdy, bo użytkownik wpisuje dane codziennie.

## Zasady projektowe

- **Podpowiadaj, nie blokuj.** Rytm, ponawianie wiadomości, sugestie okazji to łagodne podpowiedzi („może warto…”), nigdy blokady ani wymuszenia. Wyjątek świadomy: bramka oceny po graniu (niżej).
- **Jeden tap.** Najczęstsze akcje (status, ocena, „Wysłałem przez IG”) mają być przyciskiem, nie formularzem.
- **UI i teksty po polsku**, ton luźny („Siemanko”, „Zabiłem się / Rozwaliłem”). Komentarze w kodzie też po polsku.
- **Pojedynczy użytkownik.** Bez kont, ról i multi-tenancy. Dostęp chroni basic auth (`APP_PASSWORD`, `src/proxy.ts`).
- **Tanio i prosto.** Vercel Hobby + Turso. Bez kolejek, bez zewnętrznych serwisów poza scraperem i mailem (Resend).
- **Rozróżnienia domenowe są ważne.** Patrz słownik niżej i nie upraszczaj ich.

## Słownik domeny

| Pojęcie | Znaczenie | W kodzie |
| --- | --- | --- |
| Open mic przed X | **Darmowy** slot przed headlinerem | `context: "opener"`, relacja `opened_for` |
| Support | **Płatny** slot przed headlinerem | `context: "support"`, relacja `supported` |
| Graliśmy razem | Obaj headlinerami / co-headline | relacja `played_with` |
| Open mic | Wieczór otwartej sceny, piszę do organizatorów | `context: "open_mic"` |
| Headliner („przed kim”) | Komik, przed którym gram | `gigs.headlinerId` |
| Bit | Kawałek materiału | tabela `bits` |

Trzy różne oceny, nie mieszać:

- `gigLogs.rating`: jak **mi** poszło (1–5),
- `gigLogs.venueRating`: jak było w miejscu tego wieczoru (1–5),
- `venues.verdict`: ogólna opinia o scenie (`never` = czarna lista).

Ocena grania **nie jest** oceną bitu, bo zależy od publiki, line-upu itd. Bit ocenia się osobno reakcją 👍/😐/👎 (`gigBits.reaction`).

## Funkcje (ekrany)

### Dziś (`/`)
- **Cel miesiąca:** liczba grań, domyślnie 10 („super target”), tempo i seria miesięcy. Obok kafelki: materiał i średnia ocena w miesiącu.
- **Rytm** (`src/lib/rhythm.ts`, `components/rhythm.tsx`):
  - cel to 2–3 grania tygodniowo, równomiernie,
  - słupki: 4 tygodnie wstecz, bieżący i 3 naprzód,
  - podpowiedzi: luźny tydzień („może dodać jedno?” + 2 okazje z wolnych dni), seria ≥4 dni z rzędu, tydzień powyżej 3, refleksja o serii z ostatnich tygodni.
- **Balans** (w Rytmie): pół na pół grania przed komikiem (opener/support) i open miki; 2+1 w którąś stronę jest OK, ale 3+ przed komikami w tygodniu daje ostrzeżenie (`MAX_OPENERS_PER_WEEK`).
- **Najgorętsze okazje** (`src/lib/hot.ts`, `components/hot.tsx`):
  - wydarzenia za 7–21 dni, żeby zdążyć zaklepać miejsce; najlepiej ok. 14 dni przed,
  - odpadają: dni z graniem, tygodnie z 3+ graniami, trzecie granie przed komikiem w tygodniu, terminy robiące serię ≥4 dni,
  - punkty: znajomy, ostatnie bilety / sold out, luźny tydzień, typ, którego w tygodniu brakuje (balans), bliskość, nowość,
  - jeden termin na komika i jeden na dzień, maks. 4, z gotowym „Napisz”.
- **Do ponowienia** (`src/lib/follow-up.ts`):
  - kiedy: granie „napisałem/czekam” bez odpowiedzi, ok. 1,5 tygodnia (10 dni) przed graniem i min. 2 dni po ostatniej wiadomości,
  - pokazuje, gdzie już pisałem, i podpowiada kolejny kanał: Instagram → FB prywatny → FB fanpage,
  - ponowienie zwykle idzie innym komunikatorem niż pierwsza wiadomość.
- Nadchodzące, W toku (pipeline) i ostatnie „myśli” z logów.

### Grania (`/gigs`)
- **Pipeline statusów:** `interested` → `contacted` („napisałem”) → `waiting` → `confirmed`, plus `rejected` i `cancelled`. Każda zmiana zapisuje `statusChangedAt`.
- **Karta grania, sekcja „Wiadomości”:**
  - gotowy tekst do skopiowania,
  - „Wysłałem: IG / FB / Fanpage” zapisuje `interactions` z `gigId`; pierwsza wiadomość przestawia status na `contacted`,
  - „Jak się skończyło?” (wynik w `gigs.outcome`, `GIG_OUTCOMES`):
    - **Zgodził się:** potwierdzone, relacja „zgoda”,
    - **Odmówił:** odrzucone, relacja „odmowa”,
    - **Zghostował:** odrzucone, wiadomość „bez odpowiedzi”, relacja „brak odpowiedzi”,
    - **Ktoś zajął miejsce:** odrzucone, relacja bez zmian (inny termin może wyjść),
    - **Nie robi open miców:** odrzucone, komik pomijany w Okazjach z tym powodem,
    - **Odpisał, jeszcze nie wie:** status „czekam”, przypomnienie przed graniem dalej działa.
    
    Relację nadpisuje tylko „miękką” (bez historii wspólnych grań). Powrót do statusu z pipeline'u kasuje wynik.
- **Bramka oceny** (`components/review-gate.tsx`): 90 min po starcie potwierdzonego grania, ale nie przed 20:00, cała apka jest zasłonięta formularzem logu. Ucieczka: „nie zagrałem” (status `cancelled`). Grania importowane wstecz mają `skipReview`.
- **Log:**
  - ocena występu, „myśli na gorąco” (najważniejsze pole), ocena miejsca,
  - frekwencja, minuty zagrane/dostępne, kontekst,
  - zagrane bity z reakcją 👍/😐/👎.
- **Nowe granie:** w polach komików nie ma pomijanych z powodu `not_interested` / `no_openers`.

### Okazje (`/events`)
- **Poranny mail** (10:30, `src/scraper/email.ts`): „Do ponowienia”, „Najgorętsze okazje” z gotowym tekstem i nowe terminy z bileterii. Wysyłany, gdy którakolwiek sekcja nie jest pusta.
- **Źródło:** scraper bileterii (`src/scraper/sources/*`, cron GitHub Actions codziennie o 10:30 czasu polskiego, razem z mailem) zbiera wydarzenia. Klasyfikacja jest w `src/lib/opportunities.ts`.
- **Zakładki:** Znajomi (komicy z CRM), W zasięgu (≤3 h dojazdu albo nocleg), Open miki, Uzupełnij (miasta bez czasu dojazdu).
- **Dostępność biletów** (`events.availability`): z kupbilecik etykieta „ostatnie bilety” / „sold out” z kafelka listy, odświeżana przy każdym przebiegu. Liczby sprzedanych biletów serwis nie podaje. Evently nie daje tej informacji (`undefined` = nie nadpisuj).
- **Wyszukiwarka** (`?q=`, `searchOpportunities`): komik, program, scena, miasto i/lub data („14.10”, „14 paź”, „jutro”; `parseDateQuery` w `time.ts`). Szuka we wszystkich nadchodzących wydarzeniach, także odfiltrowanych; powód odfiltrowania jest w szarej etykiecie (`Opportunity.note`). Dopasowanie toleruje odmianę w obie strony („Modzelewskiego”) i obejmuje aliasy z CRM. Każdy termin to osobna karta.
- **„Jestem w…”** (`?near=&d=&r=&span=`, `nearOpportunities`): miasto i data, a w wyniku wydarzenia w promieniu 30/60/100 km (w linii prostej), opcjonalnie ±1 dzień, najbliższe najpierw. Zasięg z Warszawy jest tu ignorowany. Współrzędne są w `src/data/places-pl.json` (GeoNames, generator `scripts/build-places.ts`). Miasta spoza pliku nie mają odległości i są pomijane.
- **Historia przy komiku:** na karcie widać „pisałeś 12.09 (IG) · bez odpowiedzi / odpisał” z ostatniej interakcji w CRM, żeby nie pytać za często.
- **Grupowanie:** jedna karta na komika; najbliższy termin główny, reszta jako „Inne terminy”.
- **Wyciszanie komika:**
  - ręcznie,
  - gdy mam z nim granie w toku,
  - 30 dni po wspólnym wieczorze (`COOLDOWN_DAYS`).
- **Pomijanie komika:** z powodem `not_interested` / `no_openers` / `other`.
- **„Chcę zagrać”** zakłada granie w statusie `interested`.
- **„Napisz”** (`src/lib/messages.ts`) daje szablon do skopiowania:
  - komik: „Siemanko, masz może miejsce na open-mic’a [d.MM] w [mieście]? 😄” (miasto w miejscowniku ze słownika, fallback mianownik),
  - open mic: „Siemanko, macie może wolny slot na [d.MM]?”,
  - „Wysłałem przez…” zakłada granie jako `contacted` i zostawia na liście.

### Ludzie (`/contacts`)
- **CRM:** rola (komik / organizator / scena), relacja, aliasy (pomagają dopasować nazwiska ze scrapera), notatki.
- **Historia kontaktu** (`interactions`):
  - kanał to tekst z listy `CHANNELS` w `labels.ts`,
  - „odpisał” to `replied`,
  - wpis może być podpięty do grania (`gigId`), a `contactId` jest opcjonalny, np. open mic pisany do sceny.

### Więcej
- **Materiał** (`/bits`):
  - statusy: `tested`, `testing`, `editing` („do redakcji”), `vomit`, `rejected` (odrzucony: nie liczy się do celu i nie ma go w logu),
  - sekcja „Do pracy”: do redakcji oraz w testach i niegrane od 21+ dni.
- **Cele** (`/goals`): grania na miesiąc i minuty materiału do terminu.
- **Myśli po graniach:** przeszukiwalne notatki z logów.
- **Sceny:** werdykt, ocena miejsca, czas dojazdu.
- **Miasta:** czas dojazdu z Warszawy, nocleg, priorytet.
- **Kalendarz:** feed `.ics` z potwierdzonymi graniami pod tajnym tokenem (`/calendar/<token>.ics`).

## Konwencje w kodzie

- **Daty grań** to lokalny czas Warszawy jako string bez strefy: `"2026-10-14T20:00"` albo sama data `"2026-10-14"` (import, brak godziny). „Teraz” to `nowLocal()` z `src/lib/time.ts`. Porównania są stringowe; `effectiveStart()` dokleja 20:00 do samej daty. `createdAt` jest w UTC (`datetime('now')`).
- **Mutacje to server actions** w `src/app/actions.ts`. Po akcji na tej samej stronie: `refresh()`. Z przejściem: `done(path)` (redirect). Akcje na wydarzeniach unieważniają `EVENTS_TAG`.
- **Odczyty** są w `src/lib/queries.ts` (`server-only`). Wyjątek: `src/lib/planning.ts` (do ponowienia, rytm, najgorętsze) jest bez `server-only` i bez cache Next, bo używa go też skrypt maila. Logika czysta (rytm, ponawianie, szablony) siedzi w osobnych modułach `src/lib/*`, bez bazy, żeby dało się ją testować.
- **Etykiety, tony i listy kanałów** są w `src/lib/labels.ts`. Enumy statusów są w `src/db/schema.ts` (`*_STATUSES`). Enumy drizzle na kolumnach `text` nie tworzą CHECK w SQLite, więc nowa wartość nie wymaga migracji.
- **Progi i stałe** są nazwane i opisane przy definicji (`FOLLOW_UP_BEFORE_DAYS`, `WEEK_MIN/MAX`, `STREAK_WARN`, `COOLDOWN_DAYS`, `MAX_TRAVEL_MIN`, `REVIEW_DELAY_MIN`…).
- **UI:** komponenty iOS-owe z `src/components/ios.tsx` (`Section`, `Row`, `Pill`, `Stat`) i `form.tsx` (`FieldRow`, `PendingButton`). Kolory statusów to tokeny `--st-*` w `globals.css`, akcent limonka `#E4F323`. Wspierany jest tryb jasny i ciemny.
- **Next.js 16** z breaking changes: przed pisaniem kodu czytaj `node_modules/next/dist/docs/` (patrz `AGENTS.md`).

## Baza i wdrożenia

- **Lokalnie:** `local.db` (SQLite). Produkcja: Turso `su-manager`. Podglądy Vercela: osobna baza `su-manager-preview`.
- **Zmiana schematu:** `pnpm db:generate`, potem **przeczytaj wygenerowany SQL**. Drizzle przy przebudowie tabeli (np. zdjęcie `NOT NULL`) potrafi w `INSERT … SELECT` kopiować nieistniejącą jeszcze kolumnę; trzeba to poprawić na `NULL`. Potem `pnpm db:migrate` lokalnie.
- **Kolejność wydania:** kopia prod (`turso db shell su-manager .dump`) → migracja prod i preview → dopiero potem push na `main`. Push na `main` = auto-deploy na Vercel; nowy kod czytający nowe kolumny wysypie się bez migracji.
- **Na wszystko, co dotyka produkcji** (push na `main`, migracje i zapisy w prod DB, env na Vercelu, sekrety GitHuba), **pytaj użytkownika o zgodę**.
- **Kopia zapasowa:** co tydzień w GitHub Actions (`backup.yml`), trzymana 90 dni.
