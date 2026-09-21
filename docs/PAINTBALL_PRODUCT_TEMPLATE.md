# Paintball: kategorie i profil obiektu

Kategorie główne (np. Adrenalina) grupują istniejące aktywności (Paintball, Gokarty). Mapowanie jest w `lib/category-groups.ts`; pokazujemy grupy mające aktywności w katalogu. Identyfikatory `categories`, dotychczasowe slugi, definicje pól i filtry pozostają zgodne. Starsze `subcategories` pozostają dodatkowym rodzajem aktywności w formularzach. Nie przenosimy rekordów między tabelami ani nie tworzymy duplikatów.

W Supply i formularzach organizatora wybierz kategorię główną, potem aktywność. Nowe aktywności dodawane do bazy trafiają do grup zgodnie ze slugiem; nierozpoznane są w „Inne atrakcje”. Dodanie nowej grupy lub przypisania wymaga aktualizacji mapowania.

Każda publiczna atrakcja o kategorii albo podkategorii `paintball` otrzymuje szablon na istniejącym adresie `/attractions/[slug]`. Mapa i canonical używają wspólnej funkcji adresu. Szablon nie zastępuje galerii, kontaktu, opinii, dojazdu ani aktualnego kalendarza.

## Dane

- Potwierdzone pola obiektu: Supply → AI i kompletność. Publiczne są tylko wartości verified/owner_confirmed z jawnej listy pól.
- Pakiety: aktywne produkty aktywnego obiektu. Czas, liczebność, wyposażenie i instrukcje pochodzą z produktu, ceny i waluta z jego aktywnych rodzajów biletów.
- Wiek, kulki i wariant: istniejące pola products.restrictions dla paintballa.
- Braki nie stają się wartościami domyślnymi. Strona kieruje do kontaktu; nie obiecuje określonego wieku, liczby kulek ani dostępności.
- Cena pakietu nie gwarantuje wolnego terminu. Dostępność i finalny wybór oferty obsługuje istniejący kalendarz.

## Wdrożenie i testy

Najpierw zastosować `20260921033123_paintball_public_profile.sql`, potem wdrożyć kod. Bez RPC profil nadal otworzy się, ale szczegóły będą oznaczone jako niedostępne.

`node scripts/test-paintball-template.mjs` sprawdza treść, braki danych, grupy i adresy z mapy. `npm run test:ticketing-db` zawiera test filtrowania sugestii i nieaktywnych profili. Testy nie zastępują sprawdzenia mapy i finalnej rezerwacji w przeglądarce po wdrożeniu.
