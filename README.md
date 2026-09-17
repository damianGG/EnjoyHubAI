# EnjoyHub

EnjoyHub to marketplace atrakcji i biletów. Aplikacja łączy publiczne wyszukiwanie atrakcji z systemem ticketingu, checkoutem, panelem gospodarza oraz narzędziami administracyjnymi.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, RLS, RPC)
- Stripe + Stripe Connect
- Vercel
- Cloudinary
- Resend
- Sentry

## Uruchomienie lokalne

Wymagany jest Node.js 22.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Następnie uzupełnij wymagane zmienne w `.env.local`. Nigdy nie zapisuj prawdziwych sekretów w repozytorium.

## Kontrola jakości

Pełny lokalny quality gate:

```bash
npm run ci
```

Pipeline obejmuje lint, TypeScript, testy kontraktowe i production build. Ten sam zestaw jest uruchamiany przez GitHub Actions dla pull requestów do `master`.

## Struktura

- `app/` — routing, strony, route handlers i server actions
- `components/` — komponenty aplikacyjne i UI
- `hooks/` — współdzielone hooki React
- `lib/` — logika domenowa, integracje i warstwa dostępu do usług
- `supabase/migrations/` — kanoniczna historia migracji bazy
- `supabase/tests/` — testy bazy i kontraktów SQL
- `scripts/` — narzędzia oraz historyczne skrypty pomocnicze; plików SQL z tego katalogu nie należy traktować jako migracji nowego środowiska
- `docs/` — dokumentacja techniczna i operacyjna

## Baza danych

Źródłem prawdy dla zmian schematu są wersjonowane migracje w `supabase/migrations/`.

Nie wykonuj ręcznie historycznych plików `scripts/*.sql` na produkcji. Przed usunięciem tabel, kolumn, RPC, triggerów lub polityk RLS trzeba potwierdzić brak aktywnych callerów w aplikacji i zgodność historii migracji.

## Ticketing i checkout

Aktualny marketplace korzysta z nowego modelu ticketingu. Stary model oparty o legacy `bookings`, `offers` i dawne strony gospodarza jest stopniowo wycofywany; kontrakty tras pilnują, aby usunięte moduły nie wracały przypadkiem.

Najważniejsze flagi:

- `TICKETING_CHECKOUT_ENABLED` — udostępnia flow wyboru sesji i checkoutu
- `TICKETING_PAYMENTS_ENABLED` — aktywuje płatności Stripe; zależy od aktywnego checkoutu
- `STRIPE_CONNECT_ENABLED` — aktywuje marketplace settlements / Stripe Connect

Nie usuwaj flag tylko dlatego, że funkcja jest wdrożona w kodzie — najpierw potwierdź konfigurację produkcji i brak potrzebnej ścieżki awaryjnej.

## Dokumentacja

Najważniejsze dokumenty:

- `docs/architecture/ticketing-core.md` — architektura ticketingu
- `docs/architecture/ticket-lifecycle.md` — cykl życia biletu
- `docs/architecture/organizer-dashboard.md` — panel gospodarza
- `docs/architecture/organizer-team-and-permissions.md` — role i uprawnienia gospodarza
- `docs/architecture/platform-admin-and-support.md` — panel platformy i support
- `docs/AUTHENTICATION_FLOWS.md` — flow logowania i autoryzacji
- `docs/MONITORING.md` — monitoring i diagnostyka
- `docs/REPOSITORY_CLEANUP_2026-09.md` — bieżący audyt i plan usuwania legacy

## Zasady zmian

1. Zmiany trafiają przez branch i pull request do `master`.
2. Przed merge wymagany jest zielony `npm run ci` / workflow `Quality`.
3. Migracje bazy są addytywne i wersjonowane; nie poprawiaj historii już zastosowanej na produkcji.
4. Nie usuwaj route/API/RPC tylko na podstawie nazwy — sprawdź callerów, redirecty, SEO i kontrakty.
5. Sekrety pozostają wyłącznie w bezpiecznych zmiennych środowiskowych.
