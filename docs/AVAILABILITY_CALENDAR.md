# Kalendarz Dostępności - Dokumentacja

## Opis funkcjonalności

Kalendarz dostępności pozwala użytkownikom zobaczyć wizualnie, które dni są dostępne, a które są zarezerwowane dla danej oferty. Komponent wykorzystuje bibliotekę shadcn/ui i jest w pełni responsywny.

## Komponenty

### 1. API Endpoint: `/api/offers/[offerId]/availability`

**Ścieżka**: `app/api/offers/[offerId]/availability/route.ts`

#### Parametry zapytania:
- `startDate` (wymagane): Data początkowa w formacie YYYY-MM-DD
- `endDate` (wymagane): Data końcowa w formacie YYYY-MM-DD

#### Przykład użycia:
```
GET /api/offers/123/availability?startDate=2024-01-01&endDate=2024-01-31
```

#### Odpowiedź:
```json
{
  "days": [
    {
      "date": "2024-01-01",
      "isAvailable": true,
      "hasAvailability": true,
      "totalSlots": 5,
      "bookedSlots": 2
    },
    {
      "date": "2024-01-02",
      "isAvailable": false,
      "hasAvailability": true,
      "totalSlots": 5,
      "bookedSlots": 5
    }
  ]
}
```

### 2. Komponent: `AvailabilityCalendar`

**Ścieżka**: `components/availability-calendar.tsx`

Komponent wyświetla kalendarz z wizualną reprezentacją dostępności:

- 🟢 **Zielony** - Dni dostępne (można zarezerwować)
- 🔴 **Czerwony** - Dni w pełni zarezerwowane
- ⚪ **Szary (przyciemniony)** - Dni bez dostępności oferty

#### Props:
- `offerId` (string): ID oferty do wyświetlenia
- `className?` (string): Opcjonalne klasy CSS

#### Przykład użycia:
```tsx
import AvailabilityCalendar from "@/components/availability-calendar"

<AvailabilityCalendar offerId="offer-123" />
```

## Funkcje

### Interaktywność:
1. **Wybór dnia**: Kliknięcie na dzień w kalendarzu wyświetla szczegółowe informacje
2. **Nawigacja miesiąca**: Automatyczne pobieranie danych przy zmianie miesiąca
3. **Legenda**: Wyjaśnia znaczenie kolorów
4. **Szczegóły**: Panel z informacjami o wybranym dniu:
   - Status dostępności
   - Liczba zarezerwowanych miejsc
   - Liczba wolnych miejsc

### Ograniczenia:
- Zakres dat nie może przekroczyć 90 dni (dla wydajności)
- Dni w przeszłości są automatycznie wyłączone
- Kalendarz automatycznie odświeża dane przy zmianie miesiąca

## Integracja

Komponent jest zintegrowany z:
- Stroną szczegółów oferty (`app/offers/[id]/page.tsx`)
- Kalendarzem shadcn/ui (`components/ui/calendar.tsx`)
- API slotów (`app/api/offers/[offerId]/slots/route.ts`)

## Logika biznesowa

Kalendarz oblicza dostępność na podstawie:
1. **Konfiguracji dostępności** (`offer_availability`):
   - Dni tygodnia, w które oferta jest dostępna
   - Maksymalna liczba rezerwacji na slot
   
2. **Istniejących rezerwacji** (`bookings`):
   - Zlicza rezerwacje ze statusem 'pending' lub 'confirmed'
   - Porównuje z maksymalną pojemnością

3. **Wynik**:
   - `isAvailable = true` gdy są wolne miejsca
   - `isAvailable = false` gdy wszystkie miejsca zajęte
   - `hasAvailability = false` gdy oferta nie jest dostępna w danym dniu tygodnia

## Wykorzystane technologie

- **Next.js 15**: Server Components i API Routes
- **React 19**: Hooks (useState, useEffect, useMemo)
- **shadcn/ui**: Card, Calendar, Badge, Alert
- **Lucide Icons**: Ikony interfejsu
- **react-day-picker**: Podstawa komponentu kalendarza
- **Supabase**: Baza danych i autoryzacja

## Testowanie

Aby przetestować funkcjonalność:

1. Uruchom serwer deweloperski:
   ```bash
   npm run dev
   ```

2. Przejdź do strony szczegółów oferty:
   ```
   http://localhost:3000/offers/[id]
   ```

3. Przewiń do sekcji "Kalendarz dostępności"

4. Przetestuj:
   - Zmianę miesiąca
   - Kliknięcie na różne dni
   - Wyświetlanie informacji o dostępności
