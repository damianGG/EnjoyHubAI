# Rdzeń sprzedaży biletów — etapy 1A–2A i jeden panel właściciela

## Cel

Projekt posiada jeden docelowy model danych dla sprzedaży biletów oraz jeden
panel właściciela oparty na tym modelu, bez usuwania obecnych danych.

Stare tabele (`properties`, `offers`, `bookings`, `offer_bookings`,
`offer_availability`, `attraction_availability`) pozostają bez zmian do czasu
osobnego przełączenia publicznego marketplace'u. Panel właściciela nie zapisuje
już do tych tabel i korzysta z `organizations`, `venues`, `products`, `sessions`,
`orders` oraz `tickets`.

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

## Etap 1C — pierwszy checkout live

Etap 1C udostępnia pierwszy testowalny przepływ pod `/checkout`:

- publiczną listę aktywnych terminów oraz formularz wyboru rodzajów biletów,
- backend wywołujący atomowy checkout wyłącznie z `service_role`,
- trwałe ograniczenie prób na zanonimizowany skrót IP i e-maila,
- cookie `HttpOnly` wymagane do odczytu i anulowania bieżącego zamówienia,
- ekran podsumowania z odliczaniem 15-minutowej blokady,
- chroniony `CRON_SECRET` endpoint sprzątający stare blokady i liczniki.

Do testu stagingowego służy fixture
`supabase/tests/fixtures/001_ticketing_live_demo.sql`. Po jego wykonaniu testowa
oferta pojawi się pod `/checkout`; płatność i wystawienie biletów dodaje etap 1D.

## Etap 1D — płatność i wystawienie biletów

Etap 1D zamyka pierwszy pełny przebieg sprzedaży:

- serwer tworzy Stripe Checkout wyłącznie dla zamówienia dostępnego przez
  chronione cookie i z kwotą ponownie odczytaną z bazy;
- identyfikator próby płatności jest kluczem idempotencji Stripe, dlatego
  ponowienie żądania nie tworzy drugiej sesji ani drugiego obciążenia;
- webhook weryfikuje podpis na surowym body i dopiero status `paid` może
  atomowo potwierdzić zamówienie oraz zamienić blokadę w sprzedane miejsca;
- identyfikatory zdarzeń i skróty payloadów zapobiegają podwójnemu fulfillmentowi;
- jeden rekord `tickets` powstaje dla każdej sztuki pozycji zamówienia, a
  unikalne ograniczenie chroni przed ponownym wystawieniem przy retry webhooka;
- klient otrzymuje ekran potwierdzenia i oddzielny kod QR dla każdego biletu;
- właściciel widzi obrót, zamówienia i liczbę ważnych biletów pod
  `/host/sprzedaz`;
- właściciel, manager lub kasjer może zeskanować bilet zwykłym aparatem telefonu
  i atomowo oznaczyć wejście; ponowne skanowanie pokazuje czas pierwszego użycia;
- panel `/host/skaner` zawiera instrukcję dla kasjera i awaryjne ręczne wpisanie
  kodu biletu bez instalowania osobnej aplikacji.

Stripe Checkout ma minimalny czas ważności 30 minut. Przy rozpoczęciu płatności
blokada miejsc jest wydłużana do 35 minut, a sesja Stripe wygasa wcześniej.
Pięciominutowy bufor pozwala odebrać podpisany webhook bez ryzyka, że te same
miejsca zostaną w międzyczasie sprzedane ponownie.

Pierwszy pilot płatniczy obsługuje zamówienia w PLN. Metody płatności są
dynamiczne: BLIK i Przelewy24 należy włączyć na koncie Stripe, bez wpisywania ich
na stałe w kodzie.

## Etap 2A — samoobsługowe uruchomienie sprzedaży

Etap 2A usuwa konieczność ręcznego tworzenia danych ticketingu w Supabase:

- właściciel, administrator lub manager przechodzi do
  `/host/sprzedaz/konfiguracja` i w jednym formularzu wybiera istniejący obiekt
  albo tworzy organizację i obiekt od zera;
- kreator zapisuje ofertę, rodzaje biletów, tygodniowy harmonogram i pierwsze 90
  dni konkretnych terminów w jednej transakcji — nieudany zapis nie pozostawia
  częściowej konfiguracji;
- obiekt z własną kasą wybiera `allocated_quota`, więc pojemność wpisana w
  kreatorze oznacza wyłącznie pulę przekazaną do EnjoyHub;
- nowa oferta otrzymuje stały publiczny adres `/bilety/:productId`, z którego
  kupujący wybiera termin i przechodzi do atomowego checkoutu;
- właściciel może jednym kliknięciem wstrzymać i wznowić publiczną sprzedaż;
- chroniony codzienny cron wywołuje `ticketing_extend_active_sessions` i
  idempotentnie utrzymuje 90-dniowy horyzont terminów bez pracy ręcznej.

Tryby `external_api` i `redirect` pozostają poza samoobsługowym kreatorem. Ich
uruchomienie wymaga osobnego adaptera dla systemu kasowego konkretnego obiektu.

## Konsolidacja panelu właściciela

- `/host` jest wejściem do jednego panelu ticketingu i pokazuje funkcje zgodne z
  rolą użytkownika.
- Właściciel, administrator i manager przechodzą do ofert, terminów, zamówień i
  skanera. Użytkownik z rolą podglądu widzi sprzedaż bez funkcji zarządzania.
- Kasjer widzi wyłącznie kontrolę wejścia. Panel zamówień nie ujawnia mu danych
  klientów ani wyników finansowych.
- Dawne strony `/host/properties/*` i `/host/bookings` zostały wycofane. Stare
  zakładki i linki są bezpiecznie przekierowywane odpowiednio do konfiguracji
  ofert albo zamówień w nowym panelu.
- Usunięto nieużywany kod formularzy, dostępności i endpointów należących tylko
  do dawnego panelu hosta. Publiczny marketplace i jego legacy API pozostają
  bez zmian do kolejnego, osobno testowanego etapu.
- Konsolidacja nie wymaga migracji SQL i nie usuwa żadnych rekordów z bazy.

## Wdrożenie etapów 1A–2A

1. Wykonać kopię zapasową bazy.
2. Uruchomić wszystkie migracje z `supabase/migrations` w kolejności nazw plików,
   najpierw na osobnym projekcie Supabase/staging.
3. Uruchomić kolejno testy `supabase/tests/database/001_ticketing_core_smoke.sql`
   oraz `supabase/tests/database/002_atomic_ticketing_checkout_smoke.sql`, a
   następnie sprawdzić automatyczne dodanie właściciela po utworzeniu organizacji.
   Na izolowanym stagingu uruchomić również `npm run test:ticketing-concurrency`
   z `ALLOW_TICKETING_CONCURRENCY_TEST=true`; test tworzy tymczasowe dane, wysyła
   dwa checkouty równocześnie i usuwa dane po zakończeniu.
4. Dla etapu 1C uruchomić migrację
   `20260812234000_ticketing_checkout_rate_limits.sql` i test
   `003_ticketing_checkout_rate_limits_smoke.sql`.
5. Dla etapu 1D uruchomić migrację
   `20260813070000_ticketing_payments_and_tickets.sql`, a następnie test
   `004_ticketing_payments_and_tickets_smoke.sql`. Lokalnie oba kroki, razem ze
   wszystkimi wcześniejszymi migracjami i smoke testami, wykonuje
   `npm run test:ticketing-db` w izolowanej bazie PGlite.
6. Dla etapu 2A uruchomić migrację
   `20260814210000_ticketing_self_service_setup.sql` i test
   `005_ticketing_self_service_setup_smoke.sql`. Następnie zalogowany właściciel
   może utworzyć pierwszą ofertę z poziomu kreatora, bez fixture SQL.
7. Na Vercelu dodać serwerowe zmienne `SUPABASE_SERVICE_ROLE_KEY`,
   `TICKETING_FINGERPRINT_SECRET` i `CRON_SECRET`. Na podglądzie ustawić
   `TICKETING_CHECKOUT_ENABLED=true`, pozostawiając produkcję wyłączoną.
8. Dla płatności dodać `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET`, a w Stripe
   utworzyć endpoint `/api/webhooks/stripe` dla zdarzeń:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed` i `checkout.session.expired`.
   Dopiero wtedy ustawić `TICKETING_PAYMENTS_ENABLED=true` na Preview.
9. Opcjonalnie uruchomić stagingowy fixture live i sprawdzić: utworzenie
   zamówienia, licznik, anulowanie oraz powrót miejsc do puli.
10. W trybie testowym Stripe sprawdzić udaną płatność, ponowienie webhooka,
   wystawienie biletów QR, pojawienie się zamówienia w `/host/sprzedaz` oraz
   jednokrotne wykorzystanie biletu przez zalogowanego kasjera.
11. Potwierdzić, że `/host` pokazuje wyłącznie nowy panel, stare adresy hosta
   przekierowują poprawnie, a dotychczasowe logowanie, wyszukiwanie i publiczne
   rezerwacje nadal działają równolegle z nowym ticketingiem.
12. Dopiero potem zastosować migracje na produkcji.

Nie należy ręcznie uruchamiać starych plików z katalogu `scripts` jako migracji
nowego modelu.
