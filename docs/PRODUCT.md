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
- **Pojedynczy użytkownik.** Bez kont, ról i multi-tenancy. Dostęp: logowanie hasłem (`APP_PASSWORD`) albo Face ID (passkey), sesja w ciasteczku na rok — szczegóły w „Logowanie i bezpieczeństwo”.
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
- **Cel miesiąca:** liczba grań, domyślnie 10 („super target”), tempo i seria miesięcy. Obok kafelki: MGM (materiał napisany w miesiącu) i średnia ocena w miesiącu.
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
  - kiedy: granie „napisałem/czekam” bez odpowiedzi, ok. 1,5 tygodnia (10 dni) przed graniem i min. 2 dni po ostatniej wiadomości; „czekam” dodatkowo już po 5 dniach bez ruchu, nawet gdy granie daleko (`WAITING_FOLLOW_UP_DAYS`),
  - pokazuje, gdzie już pisałem, i podpowiada kolejny kanał: Instagram → FB prywatny → FB fanpage,
  - ponowienie zwykle idzie innym komunikatorem niż pierwsza wiadomość.
- **Pisanie na Dziś:** karta z treningiem puent i tygodniem generowania / redakcji (ta sama co w zakładce Pisanie, szczegóły niżej).
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
- **Wszystkie** (`/gigs?view=all`): bez odrzuconych.
- **Nowe granie:** w polach komików nie ma pomijanych z powodu `not_interested` / `no_openers`. Scena, miasto i „przed kim” to `SelectOrNew` (`form.tsx`): „＋ Wpisz inne…” pokazuje pole tekstowe, a `saveGig` szuka po nazwie (komik — fuzzy jak w scraperze, `performerContactId`) albo zakłada nowy wpis; nowa scena dostaje wybrane/wpisane miasto. „Kto jeszcze gra” ma pole na nowe nazwiska po przecinku. To samo „przed kim” jest w logu.

### Okazje (`/events`)
- **Podsumowanie tygodnia** (niedziela 19:00, `src/lib/weekly.ts`, `scripts/weekly.ts`, `.github/workflows/weekly.yml`): zagrane grania z oceną, bity 👍/👎, wysłane wiadomości i wyniki rozmów, przyszły tydzień względem rytmu 2–3 i balansu, do 3 najgorętszych okazji.
- **Poranny mail** (10:30, `src/scraper/email.ts`): „Do ponowienia”, „Najgorętsze okazje” z gotowym tekstem i nowe terminy z bileterii. Wysyłany, gdy którakolwiek sekcja nie jest pusta.
- **Źródła:** kupbilecik, evently, Biletyna (`src/scraper/sources/*`). Biletyna: programy z publicznej sitemapy (`/sitemap/sitemap-events.xml`, robots.txt zabrania `/ajax/`), terminy ze schema.org na stronie artysty/programu (do 30 terminów; gdy strona jest pełna, a 30. termin wypada przed horyzontem — dociąga strony miast). „Ostatnie bilety” z `remainingAttendeeCapacity` ≤ 10 (to pula Biletyny, bywa mała przy normalnej sprzedaży).
- **Duplikaty między serwisami** (`src/lib/dedupe.ts`, `sameShow`): ten sam dzień i miasto, start ±60 min, wspólne nazwisko (słowo spoza ogólnych typu stand-up/festiwal/open mic) albo jeden tytuł zaczyna drugi. Wygrywa serwis wcześniej na liście `SOURCES`; duplikat nie jest zapisywany.
- **Scraper** (`src/scraper/sources/*`, zewnętrzny cron o 10:30 czasu polskiego, razem z mailem; GitHub o 12:00 jako zapas) zbiera wydarzenia. Klasyfikacja jest w `src/lib/opportunities.ts`.
- **Zakładki:** Znajomi (komicy z CRM), W zasięgu (≤3 h dojazdu albo nocleg), Open miki, Uzupełnij (miasta bez czasu dojazdu).
- **Poranne godziny z kupbilecik:** godzina przed 12:00 to zwykle pomyłka organizatora (06:00 zamiast 18:00). Parser bierze wtedy „Start Wydarzenia” ze strony wydarzenia; bez niego przed 10:00 dodaje 12 h (`fixMorning`).
- **Dostępność biletów** (`events.availability`): z kupbilecik etykieta „ostatnie bilety” / „sold out” z kafelka listy, odświeżana przy każdym przebiegu. Liczby sprzedanych biletów serwis nie podaje. Evently nie daje tej informacji (`undefined` = nie nadpisuj).
- **Wyszukiwarka** (`?q=`, `searchOpportunities`): komik, program, scena, miasto i/lub data („14.10”, „14 paź”, „jutro”; `parseDateQuery` w `time.ts`). Szuka we wszystkich nadchodzących wydarzeniach, także odfiltrowanych; powód odfiltrowania jest w szarej etykiecie (`Opportunity.note`). Dopasowanie toleruje odmianę w obie strony („Modzelewskiego”) i obejmuje aliasy z CRM. Każdy termin to osobna karta.
- **„Jestem w…”** (`?near=&d=&r=&span=`, `nearOpportunities`): miasto i data, a w wyniku wydarzenia w promieniu 30/60/100 km (w linii prostej), opcjonalnie ±1 dzień, najbliższe najpierw. Zasięg z Warszawy jest tu ignorowany. Współrzędne są w `src/data/places-pl.json` (GeoNames, generator `scripts/build-places.ts`). Miasta spoza pliku nie mają odległości i są pomijane.
- **Trasa** (`?route=1&from=&to=&d=&n=&w=` albo `&rt=` ze zdaniem, `routeOpportunities`, logika w `src/lib/route.ts`):
  - „30.10 Słupsk 3 dni” / „w drodze do Słupska na 30 października”: cel i start z odmiany (`findPlace` w `geo.ts`, „z X do Y”), data z `parseDateQuery`, liczba dni z „N dni”; to, co rozpoznane w zdaniu, ma pierwszeństwo przed polami,
  - korytarz 30/50/80 km od **linii prostej** start–cel (prawdziwa droga bywa inna, wtedy szerszy korytarz),
  - dni drogi = N dni przed dniem przyjazdu; każdy dzień ma idealny postęp (ostatni tuż przed celem), plan wybiera max. jedno granie na dzień tak, żeby jechać do przodu (programowanie dynamiczne), reszta jako „Inne tego dnia”,
  - dni z moim graniem (też w toku) są zajęte; bez pomijanych i wyciszonych komików; zasięg z Warszawy ignorowany.
- **Cykliczne serie** (open miki itp.; `src/lib/recurring.ts`, zapis `src/lib/recurring-sync.ts`, ekran `/recurring`):
  - seria = ten sam tytuł + miasto + miejsce (`seriesKey`),
  - wykrywanie: min. 3 terminy, ten sam dzień tygodnia, stały odstęp → co tydzień / co 2 tygodnie / „n-ty dzień tygodnia miesiąca” / co 4 tygodnie (`detectInterval`); wygasa po 42 dniach bez prawdziwego terminu,
  - ręcznie przy wydarzeniu „Cykliczne?” (co tydzień / 2 / 4 tygodnie / co miesiąc / nie jest cykliczne / wykrywaj sam) — tabela `recurring_series` trzyma tylko moje decyzje (`manual` / `off`), wykryte liczone na bieżąco,
  - przewidywane terminy na 8 tygodni naprzód, tylko **po** ostatnim znanym terminie, zapisane jako wydarzenia ze źródłem `cykliczne` — dzięki temu działają w Okazjach, Najgorętszych, Rytmie, Trasie i wyszukiwarce bez zmian; na karcie etykieta „przewidywane”, nie trafiają do maila jako nowe,
  - prawdziwy termin z bileterii wygrywa: przewidywany jest usuwany przy synchronizacji (po każdym przebiegu scrapera i po mojej decyzji), a granie założone z przewidywanego przechodzi na prawdziwe wydarzenie.
- **Historia przy komiku:** na karcie widać „pisałeś 12.09 (IG) · bez odpowiedzi / odpisał” z ostatniej interakcji w CRM, żeby nie pytać za często.
- **Grupowanie:** jedna karta na komika; najbliższy termin główny, reszta jako „Inne terminy”.
- **Wyciszanie komika:**
  - ręcznie,
  - po wyniku rozmowy: „Odmówił” na 60 dni, „Zghostował” na 30 (`MUTE_AFTER_OUTCOME_DAYS`),
  - gdy mam z nim granie w toku,
  - 30 dni po wspólnym wieczorze (`COOLDOWN_DAYS`).
- **Pomijanie komika:** z powodem `not_interested` / `no_openers` / `other`.
- **„Chcę zagrać”** zakłada granie w statusie `interested`.
- **„Napisz”** (`src/lib/messages.ts`) daje szablon do skopiowania:
  - komik: „Siemanko, masz może miejsce na open-mic’a [d.MM] w [mieście]? 😄” (miasto w miejscowniku ze słownika, fallback mianownik),
  - open mic: „Siemanko, macie może wolny slot na [d.MM]?”,
  - „Wysłałem przez…” zakłada granie jako `contacted` i zostawia na liście.

### MGM — material generated per month (`src/lib/mgm.ts`, dane `getMgm` w `planning.ts`)
- **Co liczy:** minuty bitów **założonych** w danym miesiącu (`bits.createdAt` po czasie warszawskim, długość `lengthMin`), z podziałem: **sprawdzone** (status „Sprawdzony”) i **niesprawdzone** (w testach / do redakcji / vomit). Odrzucone się nie liczą; bity bez długości są liczone jako bity, a karta podpowiada, żeby uzupełnić długość.
- **Cel miesięczny** jak przy graniach: klucz `goals` „mgm:YYYY-MM”, domyślnie `DEFAULT_MGM_MIN` (5 min), szybki wybór 3/5/8/10 albo pole w Celach. Tempo (`pace`), seria miesięcy z osiągniętym celem, historia 6 miesięcy.
- **Zastąpił** dawny „cel materiału X min do terminu”.
- **Widać:** kafelek na Dziś, pełna karta w Celach i w zakładce Pisanie, linijka w porannym mailu, wiersz w sekcji „✍️ Pisanie” niedzielnego podsumowania.

### Pisanie (`/writing`, zakładka na dolnym pasku)
Pisze się poza apką (Notion / Docs) — apka liczy regularność, wiąże pracę z bitami i składa raport. Logika: `src/lib/writing.ts`, dane: `getWriting` (`planning.ts`), karta: `components/writing.tsx`.
- **Pomysł na szybko:** jedno pole na górze (tabela `ideas`). Z pomysłu: „Premisa” (loguje dzisiejszy trening puent z tą premisą), „→ bit” (bit roboczy Vomit, cały tekst w notatkach), ✕ (odrzucony).
- **Trzy rodzaje pracy** (`WRITING_KINDS`):
  - **trening puent** (premisa + 10 puent) — codziennie: seria dni, kropki tygodnia, „Zrobiłem” z opcjonalną premisą; seria nie zrywa się, dopóki dzień trwa,
  - **generowanie** — cel tygodniowy (`WEEKLY_TARGET`, 2), bit opcjonalny albo nowy draft („Wpisz inne…” zakłada bit Vomit),
  - **redakcja** — cel tygodniowy (2), **zawsze z bitem** (bity z kolejki ⚠ na górze listy).
- **Do poprawki po scenie** (`editQueue`): ostatnia reakcja bitu 😐/👎 i od tamtego grania brak redakcji tego bitu. **Poprawka siadła** (`fixedBits`): 😐/👎 → redakcja → 👍.
- **Bity w pracy** (do redakcji / w testach / drafty): link do tekstu (`bits.docUrl`), ostatnia reakcja ze sceny, ostatnia sesja. Materiał (`/bits`) jest pod tą zakładką.
- Historia sesji: `/writing/history`.
- **W raportach mailowych** (nie w aplikacji): poranny — linijka o serii puent, tygodniu i kolejce; niedzielne podsumowanie — osobna sekcja „✍️ Pisanie” (`getWritingDigest` w `planning.ts`): regularność, poprawki, które siadły, premisy z treningów, praca nad bitami, do poprawki po scenie (z notatką z ostatniego grania i linkiem do tekstu), pomysły.

### Ludzie (`/contacts`, w zakładce Więcej)
- **CRM:** rola (komik / organizator / scena), relacja, aliasy (pomagają dopasować nazwiska ze scrapera), notatki.
- **Historia kontaktu** (`interactions`):
  - kanał to tekst z listy `CHANNELS` w `labels.ts`,
  - „odpisał” to `replied`,
  - wpis może być podpięty do grania (`gigId`), a `contactId` jest opcjonalny, np. open mic pisany do sceny.

### Więcej
- **Materiał** (`/bits`):
  - statusy: `tested`, `testing`, `editing` („do redakcji”), `vomit`, `rejected` (odrzucony: nie liczy się do celu i nie ma go w logu),
  - sekcja „Do pracy”: do redakcji oraz w testach i niegrane od 21+ dni.
- **Statystyki** (`/stats`): skuteczność pisania (wyniki rozmów, % odpowiedzi wg kanału) i moje oceny wg kontekstu, miesiąca i sceny.
- **Cele** (`/goals`): grania na miesiąc i MGM (minuty nowego materiału na miesiąc).
- **Myśli po graniach:** przeszukiwalne notatki z logów.
- **Sceny:** werdykt, ocena miejsca, czas dojazdu.
- **Miasta:** czas dojazdu z Warszawy, nocleg, priorytet.
- **Kalendarz:** feed `.ics` z potwierdzonymi graniami pod tajnym tokenem (`/calendar/<token>.ics`).

### Mini kalendarz (każda podstrona)
- Pływający przycisk w prawym dolnym rogu (`components/mini-calendar.tsx`, w `layout.tsx`); otwarty / zamknięty pamiętany w `localStorage` (`useSyncExternalStore`).
- Miesiąc od poniedziałku, numery tygodni ISO, Σ grań w tygodniu względem rytmu 2–3 (zielone w normie, ochra >3).
- **Kolor = typ grania** (tokeny `--ctx-*` w `globals.css`, paleta sprawdzona walidatorem w obu motywach): open mic niebieski, przed kimś pomarańczowy, support turkusowy, headline żółty, inne szare. **Pełne kółko = potwierdzone, obwódka = w toku**; kropka = drugie granie tego dnia. Legenda zawsze widoczna (jasny turkus/żółty mają <3:1 wobec białego — podpisy są wymagane).
- Tap w dzień: lista grań z typem słownie i linkami; wolny dzień — „Co gra tego dnia?” (wyszukiwarka Okazji z datą). Dane: `/api/month?from=&to=` (bez odrzuconych i odwołanych).

### Logowanie i bezpieczeństwo (`/login`, Więcej → Bezpieczeństwo)
Basic auth zastąpione, bo w PWA na iOS nie trzymał sesji, a odmowy 401 w tle wyglądały jak „brak internetu”.
- **Sesja** (`src/lib/session.ts`): ciasteczko `sum_session` HttpOnly + Secure + SameSite=Lax, rok, odnawiane raz dziennie (proxy). Format `<sid>.<issuedAt>.<hmac>`, klucz HMAC z `SESSION_SECRET` albo `APP_PASSWORD` (zmiana hasła = wylogowanie wszystkich). W tabeli `sessions` tylko SHA-256 z `sid`; ważność sprawdzana w bazie z 60-sekundowym cache.
- **Proxy** (`src/proxy.ts`): bez sesji strony → `/login?next=…`, reszta → 401 JSON. Poza logowaniem: `/login`, `/calendar/<token>.ics`, `/api/notify` (CRON_SECRET), statyczne pliki, ikony, manifest, `sw.js`.
- **Każda akcja serwerowa** zaczyna się od `requireSession()` (`src/lib/auth.ts`) — zgodnie z dokumentacją Next nie polegamy tylko na proxy. Layout bez sesji nie renderuje paska, kalendarza ani bramki oceny.
- **Hasło:** `APP_PASSWORD`, porównanie stałoczasowe, 5 błędnych prób → 15 min blokady logowania hasłem (`app_state` „login-lock”); passkey działa dalej.
- **Face ID / passkeys** (`@simplewebauthn`, tabela `passkeys`): dodawanie tylko po zalogowaniu (Bezpieczeństwo; po pierwszym logowaniu hasłem bez passkeya apka tam przenosi), logowanie bez hasła na `/login`. Wyzwanie w ciasteczku HttpOnly na 5 min, `userVerification: required`, RP = domena z nagłówków (produkcja: su-manager.vercel.app).
- **Ekran Bezpieczeństwo:** passkeys (usuń), zalogowane urządzenia (wyloguj, wyloguj wszystkie inne), wyloguj się.
- Bez `APP_PASSWORD` (lokalnie) logowanie jest wyłączone.

### Powiadomienia i harmonogram
- **Web Push** (PWA, `public/sw.js`, `src/lib/push.ts`, włącznik: Więcej → Powiadomienia, tabela `push_subscriptions`): rano grania do ponowienia oraz „Napisz” do grań w statusie „zainteresowany” na 14 i 7 dni przed (`WRITE_REMINDER_DAYS`, każdy próg raz na granie, zbiorczo; po „Wysłałem” granie przechodzi na „napisałem” i dalej działa ponawianie), wieczorem trening puent (jeśli dziś nie było, z serią) i „jak poszło?” 90 min po starcie grania bez logu (`src/lib/notify.ts`). Każde przypomnienie raz dziennie (`oncePerDay`, tabela `app_state`).
- **Wyzwalanie:** zewnętrzny cron (cron-job.org, Europe/Warsaw) — 10:30 scraper + poranny mail (workflow_dispatch przez API GitHuba), niedziela 19:00 podsumowanie, 10:35 / 21:00 `/api/notify/morning|evening` (Bearer `CRON_SECRET`, poza basic auth). Harmonogram GitHuba to zapas (12:00 / niedz. 21:00); maile wychodzą raz dziennie (`morning-mail`, `weekly-mail`), ręcznie można wymusić (`force_mail`). Szczegóły konfiguracji: README.

## Konwencje w kodzie

- **Daty grań** to lokalny czas Warszawy jako string bez strefy: `"2026-10-14T20:00"` albo sama data `"2026-10-14"` (import, brak godziny). „Teraz” to `nowLocal()` z `src/lib/time.ts`. Porównania są stringowe; `effectiveStart()` dokleja 20:00 do samej daty. `createdAt` jest w UTC (`datetime('now')`).
- **Mutacje to server actions** w `src/app/actions.ts`. Po akcji na tej samej stronie: `refresh()`. Z przejściem: `done(path)` (redirect). Akcje na wydarzeniach unieważniają `EVENTS_TAG`.
- **Odczyty** są w `src/lib/queries.ts` (`server-only`). Wyjątek: `src/lib/planning.ts` (do ponowienia, rytm, najgorętsze) jest bez `server-only` i bez cache Next, bo używa go też skrypt maila. Logika czysta (rytm, ponawianie, szablony) siedzi w osobnych modułach `src/lib/*`, bez bazy, żeby dało się ją testować.
- **Etykiety, tony i listy kanałów** są w `src/lib/labels.ts`. Enumy statusów są w `src/db/schema.ts` (`*_STATUSES`). Enumy drizzle na kolumnach `text` nie tworzą CHECK w SQLite, więc nowa wartość nie wymaga migracji.
- **Progi i stałe** są nazwane i opisane przy definicji (`FOLLOW_UP_BEFORE_DAYS`, `WEEK_MIN/MAX`, `STREAK_WARN`, `COOLDOWN_DAYS`, `MAX_TRAVEL_MIN`, `REVIEW_DELAY_MIN`…).
- **UI:** komponenty iOS-owe z `src/components/ios.tsx` (`Section`, `Row`, `Pill`, `Stat`) i `form.tsx` (`FieldRow`, `PendingButton`). Kolory statusów to tokeny `--st-*` w `globals.css`, akcent limonka `#E4F323`. Wspierany jest tryb jasny i ciemny.
- **Testy:** `pnpm test` (`node:test` przez `tsx`, `tests/*.test.ts` i `*.test.mts` — te drugie, np. powiadomienia, stawiają tymczasową bazę z migracjami), dane w `tests/fixtures/` (odświeżane `scripts/update-fixtures.ts`). Nowy parser = nowy test na przyciętej stronie + oczekiwane wartości. Kontrola zdrowia przebiegu: `src/scraper/health.ts`.
- **Next.js 16** z breaking changes: przed pisaniem kodu czytaj `node_modules/next/dist/docs/` (patrz `AGENTS.md`).

## Baza i wdrożenia

- **Lokalnie:** `local.db` (SQLite). Produkcja: Turso `su-manager`. Podglądy Vercela: osobna baza `su-manager-preview`.
- **Zmiana schematu:** `pnpm db:generate`, potem **przeczytaj wygenerowany SQL**. Drizzle przy przebudowie tabeli (np. zdjęcie `NOT NULL`) potrafi w `INSERT … SELECT` kopiować nieistniejącą jeszcze kolumnę; trzeba to poprawić na `NULL`. Potem `pnpm db:migrate` lokalnie.
- **Kolejność wydania:** kopia prod (`turso db shell su-manager .dump`) → migracja prod i preview → dopiero potem push na `main`. Push na `main` = auto-deploy na Vercel; nowy kod czytający nowe kolumny wysypie się bez migracji.
- **Na wszystko, co dotyka produkcji** (push na `main`, migracje i zapisy w prod DB, env na Vercelu, sekrety GitHuba), **pytaj użytkownika o zgodę**.
- **Kopia zapasowa:** co tydzień w GitHub Actions (`backup.yml`), trzymana 90 dni.
