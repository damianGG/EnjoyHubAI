# Rdzeń sprzedaży biletów — etap 1A

## Cel

Ten etap wprowadza jeden docelowy model danych dla sprzedaży biletów, bez
przełączania działającej aplikacji i bez usuwania obecnych danych.

Stare tabele (`properties`, `offers`, `bookings`, `offer_bookings`,
`offer_availability`, `attraction_availability`) pozostają bez zmian. Nowy model
będzie podłączany do aplikacji dopiero w kolejnych, osobno testowanych krokach.

## Kanoniczny przepływ

```text
organizacja
  └── obiekt
      └── produkt/oferta
          ├── rodzaje biletów
          ├── szablony harmonogramu i wyjątki
          └── terminy z pojemnością
                  ├── czasowe blokady miejsc
                  └── pozycje zamówień
```

Nazwą techniczną oferty jest `products`. W interfejsie nadal używamy polskiego
określenia „Oferta”. Pozwala to uniknąć konfliktu z istniejącą tabelą `offers`
podczas bezpiecznej migracji.

## Najważniejsze decyzje

- Każdy obiekt należy do organizacji, a dostęp pracowników wynika z członkostwa
  i roli: właściciel, administrator, manager, kasjer lub podgląd.
- Godziny konkretnych terminów są przechowywane jako `timestamptz`.
  Harmonogram jest definiowany w lokalnym czasie, a obiekt posiada obowiązkową,
  sprawdzaną strefę IANA, domyślnie `Europe/Warsaw`.
- Rzeczywisty stan magazynowy znajduje się na konkretnym terminie (`sessions`).
  Harmonogram służy wyłącznie do generowania terminów.
- Rodzaj biletu określa liczbę zużywanych miejsc. Dzięki temu jeden bilet rodzinny
  może zużywać np. cztery miejsca.
- Cena i nazwy są kopiowane do pozycji zamówienia. Późniejsza zmiana cennika nie
  zmieni historycznego zamówienia.
- Zamówień i blokad miejsc nie wolno zapisywać bezpośrednio z przeglądarki.
  Atomowa funkcja transakcyjna zostanie dodana w etapie 1B.

## Współpraca z obecną kasą obiektu

Model obsługuje cztery tryby:

1. `native_enjoyhub` — EnjoyHub zarządza całym limitem.
2. `allocated_quota` — obiekt rezerwuje określoną pulę miejsc dla EnjoyHub.
3. `external_api` — dostępność pochodzi z integracji z zewnętrznym systemem.
4. `redirect` — EnjoyHub przekierowuje do zewnętrznej sprzedaży.

Dla pierwszego obiektu posiadającego własny system kasowy domyślnym wyborem jest
`allocated_quota`. Pole `sessions.capacity` oznacza wtedy wyłącznie pulę
przeznaczoną dla EnjoyHub, a nie całkowitą pojemność obiektu.

## RLS i bezpieczeństwo

- Dane publiczne obejmują tylko aktywne obiekty, produkty, rodzaje biletów i
  zaplanowane terminy.
- Pracownik widzi dane organizacji zgodnie ze swoim członkostwem.
- Zwykły użytkownik widzi tylko własne zamówienia.
- Anonimowe zamówienie będzie dostępne wyłącznie przez serwerowy token/API;
  bezpośredni odczyt z Supabase pozostaje zablokowany.
- Druga migracja usuwa błędną, globalną politykę INSERT z legacy tabeli `users`.
  `service_role` nie potrzebuje takiej polityki, ponieważ omija RLS.
- Trzecia migracja usuwa szerokie, domyślne granty Supabase z nowych tabel i
  nadaje rolom `anon` oraz `authenticated` wyłącznie wymagane uprawnienia.

## Etap 1B — atomowy checkout

- `ticketing_create_order_hold` w jednej transakcji blokuje termin, sprawdza
  dostępność i tworzy zamówienie, pozycje oraz czasową blokadę miejsc.
- Dostępność jest liczona w jednostkach pojemności, dzięki czemu np. bilet
  rodzinny może zajmować cztery miejsca.
- `checkout_key` zapewnia idempotencję — ponowienie tego samego żądania nie
  tworzy drugiego zamówienia.
- `ticketing_confirm_order` bezpiecznie zamienia aktywną blokadę w sprzedane
  miejsca, a `ticketing_release_order_hold` zwalnia nieopłacony checkout.
- `ticketing_expire_inventory_holds` wygasza stare blokady w ograniczonych
  partiach i jest przygotowana do wywoływania przez zadanie cykliczne.
- `ticketing_generate_sessions` tworzy brakujące terminy z harmonogramów oraz
  wyjątków, uwzględniając strefę czasową obiektu.
- Funkcje zapisujące są dostępne wyłącznie dla backendu z `service_role`.
  Przeglądarka ma dostęp tylko do bezpiecznego odczytu dostępności.

## Co wchodzi do etapu 1C

- endpoint backendowy wywołujący atomowy checkout,
- limitowanie żądań i ochrona przed masowym blokowaniem miejsc,
- podłączenie operatora płatności i obsługa webhooka potwierdzającego,
- zadanie cykliczne wygaszające blokady,
- formularz wyboru biletów i podsumowanie zamówienia w aplikacji.

## Wdrożenie etapów 1A–1B

1. Wykonać kopię zapasową bazy.
2. Uruchomić wszystkie migracje z `supabase/migrations` w kolejności nazw plików,
   najpierw na osobnym projekcie Supabase/staging.
3. Uruchomić kolejno testy `supabase/tests/database/001_ticketing_core_smoke.sql`
   oraz `supabase/tests/database/002_atomic_ticketing_checkout_smoke.sql`, a
   następnie sprawdzić automatyczne dodanie właściciela po utworzeniu organizacji.
   Na izolowanym stagingu uruchomić również `npm run test:ticketing-concurrency`
   z `ALLOW_TICKETING_CONCURRENCY_TEST=true`; test tworzy tymczasowe dane, wysyła
   dwa checkouty równocześnie i usuwa dane po zakończeniu.
4. Potwierdzić, że dotychczasowe logowanie, wyszukiwanie i rezerwacje nadal
   działają — aplikacja nie używa jeszcze nowych tabel.
5. Dopiero potem zastosować migracje na produkcji.

Nie należy ręcznie uruchamiać starych plików z katalogu `scripts` jako migracji
nowego modelu.
