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

## Co wchodzi do etapu 1B

- atomowa funkcja utworzenia zamówienia i blokady miejsc,
- blokada rekordu terminu podczas liczenia dostępności,
- sumowanie osób/jednostek pojemności, a nie liczby rezerwacji,
- wygaszanie blokad checkoutu,
- generowanie terminów z harmonogramów i wyjątków,
- test równoległych rezerwacji potwierdzający brak oversellingu.

## Wdrożenie etapu 1A

1. Wykonać kopię zapasową bazy.
2. Uruchomić migracje najpierw na osobnym projekcie Supabase/staging.
3. Uruchomić test `supabase/tests/database/001_ticketing_core_smoke.sql`, a następnie
   sprawdzić automatyczne dodanie właściciela po utworzeniu organizacji.
4. Potwierdzić, że dotychczasowe logowanie, wyszukiwanie i rezerwacje nadal
   działają — aplikacja nie używa jeszcze nowych tabel.
5. Dopiero potem zastosować migracje na produkcji.

Nie należy ręcznie uruchamiać starych plików z katalogu `scripts` jako migracji
nowego modelu.
