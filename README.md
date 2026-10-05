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
