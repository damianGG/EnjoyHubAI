# EnjoyHubAI

Krótki opis: EnjoyHubAI to projekt ... (polish)

## Uruchomienie
1. Zainstaluj zależności
   npm install
2. Uruchom w trybie deweloperskim
   npm run dev

## Użytkownicy Testowi

Do testowania aplikacji dostępni są predefiniowani użytkownicy:
- **Host:** `host@host.com` / `Haslohost123`
- **User:** `user@user.com` / `Haslouser123`

Szczegóły: [docs/UZYTKOWNICY_TESTOWI.md](docs/UZYTKOWNICY_TESTOWI.md)

## Testy
- Uruchom testy: npm test

## Baza danych

Wersjonowane migracje Supabase znajdują się w `supabase/migrations`.
Nowy, addytywny model sprzedaży biletów jest opisany w
`docs/architecture/ticketing-core.md`. Pliki z katalogu `scripts` opisują starszy
model i nie powinny być uruchamiane jako migracje nowego środowiska.

## Kontrybucja
- Zobacz CONTRIBUTING.md (do dodania)

## Licencja
Ten projekt jest na licencji MIT.
