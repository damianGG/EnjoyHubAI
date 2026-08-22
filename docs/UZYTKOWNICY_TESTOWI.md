# Użytkownicy Testowi - Instrukcja (Polish Guide)

## ⚠️ Ważne - Pobierz Najnowszą Wersję

Upewnij się, że używasz najnowszej wersji skryptu z repozytorium:
```bash
git pull origin main
```

Jeśli widzisz błąd dotyczący UUID (`invalid input syntax for type uuid`), sprawdź czy UUID w linii 71 to: `b1eecd99-9d1c-4ef9-ac7e-7cc0ce491b22` (NIE `b1ffcd99-9d1c-5fg9...`).

## Szybki Start

Skrypt SQL do stworzenia użytkowników testowych znajduje się w: `/scripts/17-create-test-users.sql`

## Dane Logowania

### 1. Użytkownik Host (Właściciel)
- **Email:** `host@host.com`
- **Hasło:** `Haslohost123`
- **Typ:** Host (może tworzyć i zarządzać obiektami)

### 2. Użytkownik Zwykły (Gość)
- **Email:** `user@user.com`
- **Hasło:** `Haslouser123`
- **Typ:** Zwykły użytkownik (może przeglądać i rezerwować)

## Jak Uruchomić

### Metoda 1: Dashboard Supabase (Zalecana)

1. Zaloguj się do [app.supabase.com](https://app.supabase.com)
2. Wybierz swój projekt
3. Przejdź do **SQL Editor** (Edytor SQL)
4. Skopiuj zawartość pliku `/scripts/17-create-test-users.sql`
5. Wklej do edytora
6. Kliknij **RUN** (Uruchom)
7. Sprawdź wyniki - powinny pojawić się 2 użytkowników

### Metoda 2: Supabase CLI

```bash
# Z katalogu głównego projektu
supabase db execute --file scripts/17-create-test-users.sql
```

## Logowanie

Po uruchomieniu skryptu możesz zalogować się do aplikacji używając:

**Jako Host:**
```
Email: host@host.com
Hasło: Haslohost123
```

**Jako Użytkownik:**
```
Email: user@user.com
Hasło: Haslouser123
```

## Co Można Testować

### Jako Host (`host@host.com`)
- ✅ Tworzenie nowych obiektów/atrakcji
- ✅ Edycja istniejących obiektów
- ✅ Zarządzanie rezerwacjami
- ✅ Przesyłanie zdjęć
- ✅ Ustawianie cen i dostępności

### Jako Zwykły Użytkownik (`user@user.com`)
- ✅ Przeglądanie dostępnych obiektów
- ✅ Wyszukiwanie i filtrowanie
- ✅ Tworzenie rezerwacji
- ✅ Dodawanie opinii
- ✅ Zarządzanie ulubionymi
- ✅ Historia rezerwacji

## Weryfikacja

Sprawdź czy użytkownicy zostali utworzeni:

```sql
SELECT id, email, full_name, is_host, is_verified
FROM public.users
WHERE email IN ('host@host.com', 'user@user.com')
ORDER BY email;
```

Powinno pokazać 2 użytkowników:
- `host@host.com` z `is_host = true`
- `user@user.com` z `is_host = false`

## Rozwiązywanie Problemów

### Problem: "relation 'auth.users' does not exist"

**Rozwiązanie:** Uruchom skrypt przez Dashboard Supabase zamiast bezpośredniego połączenia z bazą.

### Problem: Nie mogę się zalogować

**Sprawdź:**
1. Czy użytkownicy zostali utworzeni (zapytanie SQL powyżej)
2. Czy w ustawieniach Supabase Auth nie jest wymagana weryfikacja email
3. Czy hasła spełniają wymagania (min. 8 znaków)

**Rozwiązanie:**
```sql
-- Upewnij się że email jest potwierdzony
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email IN ('host@host.com', 'user@user.com');
```

### Problem: "duplicate key value violates unique constraint"

**Rozwiązanie:** Użytkownicy już istnieją. Usuń ich przed ponownym uruchomieniem:

```sql
DELETE FROM auth.users WHERE email IN ('host@host.com', 'user@user.com');
DELETE FROM public.users WHERE email IN ('host@host.com', 'user@user.com');
```

### Problem: "function gen_salt does not exist"

**Rozwiązanie:** Włącz rozszerzenie pgcrypto:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Usuwanie Użytkowników Testowych

Gdy nie są już potrzebni:

```sql
-- Usuń z auth.users (automatycznie usunie z public.users)
DELETE FROM auth.users 
WHERE email IN ('host@host.com', 'user@user.com');

-- Sprawdź czy zostali usunięci
SELECT COUNT(*) FROM public.users 
WHERE email IN ('host@host.com', 'user@user.com');
-- Powinno zwrócić 0
```

## Bezpieczeństwo

⚠️ **WAŻNE:**

- Te konta są **TYLKO do testów i developmentu**
- **NIE** używaj ich na produkcji
- Usuń lub wyłącz te konta przed wdrożeniem na produkcję
- Te hasła są publiczne - każdy ma do nich dostęp w tym repozytorium

## Więcej Informacji

Szczegółowa dokumentacja (po angielsku): `/docs/TEST_USERS_GUIDE.md`

## Skrypty Powiązane

- `/scripts/01-create-tables.sql` - Tworzenie tabel
- `/scripts/02-fix-user-sync.sql` - Synchronizacja użytkowników
- `/scripts/17-create-test-users.sql` - **Ten skrypt**

## Pomoc

Jeśli masz problemy:
1. Sprawdź logi w Dashboard Supabase
2. Zweryfikuj schemat bazy w `/scripts/01-create-tables.sql`
3. Otwórz issue w repozytorium z opisem problemu
