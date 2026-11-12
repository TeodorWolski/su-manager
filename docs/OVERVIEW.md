# SU Manager

Osobista apka do zarządzania graniem stand-upu: grania i pipeline statusów, log zaraz po
zejściu ze sceny, CRM komików i organizatorów, materiał, sceny. Jeden użytkownik, używana
z telefonu (PWA), w codziennym użyciu od października 2026. Zastąpiła arkusz i jakieś
10–15 godzin ręcznej roboty tygodniowo.

Stack: Next.js 16 · Drizzle · SQLite (lokalnie plik, na produkcji Turso) · Tailwind 4 · Vercel.

W liczbach: 2 100+ wydarzeń zebranych z bileterii w pierwszy miesiąc, 18 migracji schematu,
17 plików testów (~90 testów), zero zewnętrznych bibliotek do PDF.

## Co działa beze mnie

- Scraper trzech bileterii o 10:30 z kontrolą zdrowia przebiegu, która łapie zmianę strony
  serwisu — czego testy na zapisanych plikach z definicji nie zobaczą
- Poranny mail i pushe: do kogo ponowić, najgorętsze okazje, nowe terminy komików z CRM
- Niedzielne podsumowanie tygodnia
- Bilety kolejowe z Gmaila: PDF → tekst → parser → podpięcie do grania → powiadomienie
- Cotygodniowa kopia bazy w GitHub Actions

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
- **Czysta logika osobno od bazy** w `src/lib/*`, dzięki czemu większość z 17 plików testów
  nie potrzebuje bazy; te, które jej potrzebują (powiadomienia, mail), stawiają tymczasową
  bazę z migracjami
- Dokumentacja domeny: `docs/PRODUCT.md`

## Decyzje, które warto znać

- **Tanio i prosto:** Vercel Hobby i darmowy Turso, bez kolejek. Godziny trzyma zewnętrzny
  cron, harmonogram GitHuba jest tylko zapasem; maile wychodzą raz dziennie (znacznik
  w bazie), więc zapas ich nie dubluje
- **Przypomnienia nie przepadają:** gdy nie ma zapisanego urządzenia, push nic nie odhacza
  jako wysłane; telefon sam odnawia subskrypcję, którą iOS unieważnił
- **Bezpieczeństwo:** sesja w podpisanym ciasteczku i Face ID (passkeys, WebAuthn) zamiast
  basic auth; każda akcja serwerowa sama sprawdza sesję, nie tylko proxy. Dane biletu przy
  imporcie są w adresie po „#”, więc nie trafiają do logów serwera
- **Produkcyjna baza to źródło prawdy:** kolejność wydania to kopia bazy → migracja →
  dopiero deploy
