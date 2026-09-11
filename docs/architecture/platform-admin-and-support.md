# Platform administration and support

## Cel

Panel `/admin` jest oddzielną warstwą administracyjną EnjoyHub. Nie zastępuje ról organizatora i nie daje administratorom członkostwa we wszystkich organizacjach.

Model rozdziela trzy niezależne poziomy:

1. **Tożsamość konta** — `auth.users` / profil `public.users`. Jedna osoba ma jedno konto EnjoyHub.
2. **Uprawnienia w organizacji** — `organization_memberships` z rolami `owner`, `admin`, `manager`, `cashier`, `viewer`.
3. **Uprawnienia platformowe** — `platform_staff` z rolami administracji EnjoyHub.

Administrator platformy zawsze pozostaje swoim własnym użytkownikiem. Nie loguje się na konto właściciela, nie zna jego hasła i nie przejmuje jego sesji.

## Role platformowe

| Rola | Główne uprawnienia | Celowo niedostępne |
| --- | --- | --- |
| `platform_superadmin` | pełny panel, administratorzy, organizacje, użytkownicy, treści, finanse, wsparcie, audyt | — |
| `platform_support` | organizacje, użytkownicy, zespół organizacji, obiekty, szkice atrakcji, tryb wsparcia, operacyjne dane zamówień | NIP/dane prawne, obrót, aktywacja płatności, kategorie/pola, role platformowe |
| `platform_content` | organizacje w zakresie treści, obiekty, atrakcje, kategorie, podkategorie i pola | użytkownicy, zespół, audyt, obrót, dane prawne i finansowe |
| `platform_finance` | dane prawne, NIP, weryfikacja, status płatności, obrót i audyt | użytkownicy, zespół, treści, obiekty/atrakcje jako edycja, role platformowe |

Zasada: backend zwraca tylko dane potrzebne danej roli. Ukrywanie elementów UI nie jest traktowane jako zabezpieczenie.

## Tryb wsparcia

`platform_support_context` przechowuje wybraną organizację, w kontekście której superadmin/support aktualnie pomaga.

Tryb wsparcia:

- nie tworzy `organization_memberships`,
- nie zmienia `auth.uid()`,
- nie podszywa się pod właściciela,
- pokazuje stały komunikat w panelu, że użytkownik działa jako administrator EnjoyHub,
- zapisuje wejście i wyjście z kontekstu w audycie,
- wszystkie faktyczne zmiany wykonują dedykowane RPC administratora jako bieżący administrator platformy.

Dzięki temu wpis audytowy mówi np. „platform_support zmienił przypisanie użytkownika w organizacji X”, a nie udaje działania właściciela.

## Audyt

`platform_admin_audit_log` zapisuje:

- `actor_user_id` i jego rolę platformową,
- organizację, jeśli operacja jej dotyczy,
- akcję i typ encji,
- identyfikator encji,
- stan `before_data` i `after_data`,
- dodatkowe metadata,
- czas operacji.

Mutacje organizacji, członkostw, obiektów, atrakcji, kontekstu wsparcia i administratorów przechodzą przez SECURITY DEFINER RPC i zapisują audyt jawnie.

Mutacje kategorii, podkategorii i pól kategorii są audytowane triggerami bazy, ponieważ te moduły używają bezpośrednich operacji tabelowych przez istniejące API.

Support otrzymuje audyt ograniczony do operacji związanych z organizacjami, z redakcją pól prawnych/rozliczeniowych. Superadmin i finanse mają pełniejszy zakres zgodny z ich rolą.

## Granice bezpieczeństwa

Najważniejsze operacje platformowe są dostępne przez funkcje `platform_admin_*` z `SECURITY DEFINER`, ale każda funkcja na początku sprawdza aktywną rolę w `platform_staff`.

RLS dla `categories`, `subcategories` i `category_fields` zezwala na mutacje wyłącznie aktywnemu `platform_superadmin` lub `platform_content`.

`platform_support`:

- może przypisywać role organizacyjne `admin`, `manager`, `cashier`, `viewer`,
- nie może nadać roli `owner`,
- nie może aktywować płatności ani zatwierdzić weryfikacji,
- nie otrzymuje NIP-u, danych prawnych ani obrotu.

`platform_finance`:

- może zmienić weryfikację i gotowość płatności,
- nie może zmienić nazwy ani statusu operacyjnego organizacji,
- nie otrzymuje listy członków zespołu.

`platform_content`:

- nie może pobrać globalnej listy użytkowników,
- nie widzi członków organizacji, danych prawnych ani wyników finansowych,
- może zarządzać treściami i strukturą atrakcji.

## Zarządzanie administratorami

Tylko `platform_superadmin` może wejść do `/admin/administratorzy` i wywołać `platform_admin_upsert_staff`.

Dodawane konto musi już istnieć w EnjoyHub. Nie tworzymy specjalnych kont administracyjnych poza zwykłym Auth — nadajemy istniejącemu kontu dodatkową rolę platformową.

Baza blokuje:

- odebranie sobie przez bieżącego superadmina własnej roli,
- dezaktywację własnego superadmina,
- usunięcie/dezaktywację ostatniego aktywnego superadmina.

Zmiana roli lub aktywności administratora trafia do `platform_admin_audit_log`.

## Panel

Główne moduły:

- `/admin` — centrum operacyjne,
- `/admin/organizacje` — wszystkie organizacje,
- `/admin/organizacje/[organizationId]` — zespół, obiekty, atrakcje, oferty i ustawienia zależne od roli,
- `/admin/wsparcie/[organizationId]` — jawny kontekst pomocy bez impersonacji,
- `/admin/uzytkownicy` — katalog użytkowników dla superadmin/support,
- `/admin/audyt` — dziennik działań,
- `/admin/administratorzy` — role platformowe, tylko superadmin,
- `/admin/categories` i `/admin/fields` — administracja treścią dla superadmin/content.

Legacy `/admin/properties` kieruje do nowego modelu organizacji zamiast do starego panelu `property/host`.

## Zasady na przyszłość

Nowe funkcje administracyjne muszą spełniać jednocześnie:

1. nie dodawać administratora jako członka organizacji tylko po to, aby ominąć RLS,
2. nie używać service role w kliencie,
3. sprawdzać rolę platformową na backendzie/bazie,
4. zwracać tylko potrzebne pola dla danej roli,
5. logować każdą mutację administracyjną,
6. unikać impersonacji użytkowników,
7. zachować ochronę ostatniego superadmina.

Rozliczenia, prowizje, refundy i wypłaty będą rozszerzeniem roli `platform_finance` w punkcie 12 i powinny korzystać z tego samego modelu audytu i least privilege.
