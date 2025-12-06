# Analiza Systemów Rezerwacji w EnjoyHub

## Podsumowanie Wykonawcze

W aplikacji EnjoyHub istnieją **DWA różne systemy rezerwacji**, które obsługują różne przypadki użycia:

1. **System rezerwacji nieruchomości** (stary system) - dla rezerwacji wielodniowych pobytów
2. **System rezerwacji ofert/slotów czasowych** (nowy system) - dla rezerwacji czasowych atrakcji

## System 1: Rezerwacje Nieruchomości (Stary System)

### Przepływ Użytkownika
```
/attractions/[slug] 
  → AvailabilityCalendarCard (wybór dat check-in/check-out)
  → createBooking action
  → /booking-confirmation/[id]
```

### Kluczowe Pliki
- **Komponent UI**: `components/availability-calendar-card.tsx`
- **Alternatywny komponent**: `components/booking-card.tsx` (starsza wersja)
- **Akcja serwera**: `lib/booking-actions.ts`
- **Tabela bazy danych**: `bookings`
- **Strona potwierdzenia**: `app/booking-confirmation/[id]/page.tsx`

### Charakterystyka
- **Typ rezerwacji**: Wielodniowe pobyty (check-in → check-out)
- **Model danych**: 
  - `check_in` / `check_out` (daty)
  - `guests_count` (liczba gości)
  - `total_price` (cena całkowita)
  - `booking_type: 'property'`
- **Funkcje**:
  - Kalendarz z blokowanymi datami
  - Ceny sezonowe
  - Minimalna/maksymalna długość pobytu
  - Płatność online
- **Stan**: ✅ Działający system, używany dla rezerwacji pobytów

### Punkt wejścia z głównego widoku
Na stronie `/attractions/[slug]` komponent `AvailabilityCalendarCard` jest wyświetlany razem z nowym systemem:

```tsx
// app/attractions/[slug]/page.tsx, linie 225-232
<AvailabilityCalendarCard
  propertyId={attraction.id}
  pricePerNight={attraction.price_per_night}
  maxGuests={attraction.max_guests}
  avgRating={roundedRating}
  reviewCount={ratings.length}
/>
<SlotAvailabilityWidget propertyId={attraction.id} />
```

---

## System 2: Rezerwacje Ofert/Slotów (Nowy System)

### Przepływ Użytkownika - Główna Trasa (z głównego widoku)
```
/attractions/[slug]
  → SlotAvailabilityWidget (wybór daty)
  → /offers/[offerId]/book?date=YYYY-MM-DD&time=HH:mm
  → Formularz rezerwacji
  → POST /api/bookings
  → /offers/bookings/[id]
```

### Przepływ Alternatywny - Bezpośrednia Rezerwacja
```
/offers/[id]
  → BookingWidget (wybór daty i czasu w jednym miejscu)
  → POST /api/bookings
  → Success message w komponencie
```

### Kluczowe Pliki

#### Główna Trasa (z attractions)
- **Widget wyboru slotu**: `components/slot-availability-widget.tsx`
- **Strona rezerwacji**: `app/offers/[offerId]/book/page.tsx`
- **API endpoint**: `app/api/bookings/route.ts` (POST)
- **Strona potwierdzenia**: `app/offers/bookings/[id]/page.tsx`

#### Alternatywna Trasa (bezpośrednia)
- **Widget rezerwacji**: `components/booking-widget.tsx`
- **Strona oferty**: `app/offers/[id]/page.tsx`
- **API endpoint**: `app/api/bookings/route.ts` (POST - ten sam)

### Charakterystyka
- **Typ rezerwacji**: Sloty czasowe (data + godzina rozpoczęcia)
- **Model danych**: 
  - `booking_date` (pojedyncza data)
  - `start_time` / `end_time` (czasy w formacie HH:mm)
  - `persons` (liczba osób)
  - `customer_name`, `customer_email`, `customer_phone`
  - `status: 'confirmed'`
  - `payment_status: 'not_required'`
- **Tabela bazy danych**: `offer_bookings`
- **Funkcje**:
  - Dostępność według dni tygodnia (weekday 0-6)
  - Sloty czasowe o określonej długości
  - Maksymalna liczba rezerwacji na slot
  - Walidacja dostępności w czasie rzeczywistym
  - Płatność na miejscu
- **Stan**: ✅ Nowo zaimplementowany, pełna funkcjonalność

### Różnice między dwoma trasami nowego systemu

| Aspekt | SlotAvailabilityWidget → /offers/[offerId]/book | BookingWidget w /offers/[id] |
|--------|------------------------------------------------|------------------------------|
| **Lokalizacja** | Strona atrakcji `/attractions/[slug]` | Dedykowana strona oferty `/offers/[id]` |
| **UI Flow** | Dwuetapowy (wybór slotu → formularz) | Jednoetapowy (wszystko w jednym miejscu) |
| **Wybór daty** | Kalendarz → przekierowanie z parametrami | Kalendarz inline |
| **Wybór czasu** | Automatyczny (następny dostępny slot) | Siatka przycisków z dostępnymi godzinami |
| **Potwierdzenie** | Osobna strona `/offers/bookings/[id]` | Success message w komponencie |
| **Przypadek użycia** | Szybka rezerwacja z widoku atrakcji | Pełny przegląd oferty przed rezerwacją |

---

## Które Trasy Są "Te Dwie Logiki Bookowania"

Odpowiadając na pytanie użytkownika, **dwie główne trasy rezerwacji** to:

### 1️⃣ Trasa z głównego widoku (attractions) - GŁÓWNA TRASA
**Przepływ**: `/attractions/[slug]` → `SlotAvailabilityWidget` → `/offers/[offerId]/book`

Ta trasa jest **najprawdopodobniej tą, której NIE chcesz używać**, ponieważ:
- Jest prostsza (automatycznie wybiera pierwszy dostępny slot)
- Nie pokazuje wszystkich dostępnych godzin
- Wymaga przekierowania do osobnej strony
- Użytkownik nie widzi pełnych opcji czasowych

### 2️⃣ Trasa bezpośrednia (offers) - NOWA TRASA
**Przepływ**: `/offers/[id]` → `BookingWidget` → Success

Ta trasa jest **prawdopodobnie tą, którą chcesz używać**, ponieważ:
- Pokazuje wszystkie dostępne sloty czasowe
- Użytkownik może wybrać preferowaną godzinę
- Wszystko dzieje się w jednym miejscu (lepsze UX)
- Bardziej kompleksowy przepływ rezerwacji

---

## API Endpoints Rezerwacji

### Nowy System (Offer Bookings)
```
POST /api/bookings
Body: {
  offerId: string
  date: "YYYY-MM-DD"
  startTime: "HH:mm"
  persons: number
  customerName: string
  customerEmail: string
  customerPhone: string
}
Response: { id, status, paymentStatus, ... }
```

### Stary System (Property Bookings)
```
Server Action: createBooking
Data: {
  propertyId: string
  checkIn: "YYYY-MM-DD"
  checkOut: "YYYY-MM-DD"
  guestsCount: number
}
```

---

## Konfiguracja Dostępności

### Dla Ofert (Nowy System)
- **Panel admina**: `/admin/offers/[offerId]/availability`
- **Komponent**: `OfferAvailabilityManager`
- **Tabela**: `offer_availability`
- **Konfiguracja**:
  - Dzień tygodnia (0-6)
  - Przedział czasowy (start_time - end_time)
  - Długość slotu (slot_length_minutes)
  - Maksymalna liczba rezerwacji na slot

### Dla Nieruchomości (Stary System)
- **Panel hosta**: `/host/properties/[id]/availability`
- **Komponent**: `AvailabilityManager`
- **Tabela**: `attraction_availability`
- **Konfiguracja**:
  - Tryb rezerwacji (daily/hourly)
  - Zablokowane daty
  - Ceny sezonowe
  - Min/max długość pobytu

---

## Rekomendacje

### Obecna Sytuacja
Masz **oba systemy działające jednocześnie** na stronie `/attractions/[slug]`:
```tsx
<AvailabilityCalendarCard />  {/* Stary system - pobyty */}
<SlotAvailabilityWidget />     {/* Nowy system - sloty */}
```

### Zalecenia

1. **Jeśli oferujesz tylko atrakcje czasowe (nie pobyty)**:
   - Usuń `AvailabilityCalendarCard` ze strony atrakcji
   - Zachowaj tylko `SlotAvailabilityWidget`
   - Ale zmień logikę, aby przekierowywać do `/offers/[id]` zamiast `/offers/[offerId]/book`
   
2. **Jeśli oferujesz zarówno pobyty jak i atrakcje**:
   - Zachowaj oba widgety
   - Dodaj wyraźne etykiety ("Rezerwuj pobyt" vs "Zarezerwuj termin")
   - Rozważ warunkowe wyświetlanie (jeśli property ma offers, pokaż SlotWidget)

3. **Aby uprościć do jednej trasy dla slotów**:
   - Zmodyfikuj `SlotAvailabilityWidget` aby przekierowywać do `/offers/[id]`
   - Albo ulepsz widget aby pokazywał wszystkie dostępne godziny (jak `BookingWidget`)
   - Usuń stronę `/offers/[offerId]/book` jeśli nie jest potrzebna

---

## Struktura Bazy Danych

### Tabele dla Nowego Systemu
```sql
offers (
  id UUID PRIMARY KEY,
  place_id UUID REFERENCES properties,
  title TEXT,
  description TEXT,
  base_price NUMERIC,
  currency TEXT DEFAULT 'PLN',
  duration_minutes INTEGER,
  max_participants INTEGER,
  is_active BOOLEAN
)

offer_availability (
  id UUID PRIMARY KEY,
  offer_id UUID REFERENCES offers,
  weekday INTEGER (0-6),
  start_time TIME,
  end_time TIME,
  slot_length_minutes INTEGER,
  max_bookings_per_slot INTEGER
)

offer_bookings (
  id UUID PRIMARY KEY,
  offer_id UUID REFERENCES offers,
  place_id UUID REFERENCES properties,
  booking_date DATE,
  start_time TIME,
  end_time TIME,
  persons INTEGER,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT,
  payment_status TEXT
)
```

### Tabele dla Starego Systemu
```sql
bookings (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties,
  guest_id UUID REFERENCES users,
  check_in DATE,
  check_out DATE,
  guests_count INTEGER,
  total_price NUMERIC,
  status TEXT,
  booking_type TEXT
)

attraction_availability (
  property_id UUID REFERENCES properties,
  booking_mode TEXT (daily/hourly),
  blocked_dates DATE[],
  seasonal_prices JSONB,
  min_stay INTEGER,
  max_stay INTEGER
)
```

---

## Wnioski

### Odpowiedź na Twoje Pytanie
Masz **dwa różne systemy rezerwacji**:

1. **System pobytów** (`AvailabilityCalendarCard`) - dla wielodniowych rezerwacji
2. **System slotów** (`SlotAvailabilityWidget` + `BookingWidget`) - dla rezerwacji czasowych

A w systemie slotów masz **dwie różne trasy**:

1. **Z głównego widoku**: `SlotAvailabilityWidget` → `/offers/[offerId]/book` (prostsza, automatyczna)
2. **Bezpośrednia**: `/offers/[id]` z `BookingWidget` (pełniejsza, z wyborem godzin)

### Która Trasa Jest Używana Z Głównego Widoku
Z `/attractions/[slug]` używana jest trasa przez:
```
SlotAvailabilityWidget → /offers/[offerId]/book
```

Jest to prostsza trasa, która automatycznie wybiera pierwszy dostępny slot.

### Którą Chcesz Prawdopodobnie Używać
Prawdopodobnie chcesz używać **trasy bezpośredniej** `/offers/[id]` z `BookingWidget`, ponieważ:
- Daje użytkownikowi pełną kontrolę nad wyborem godziny
- Pokazuje wszystkie dostępne sloty
- Lepsze UX (wszystko w jednym miejscu)
- Bardziej intuicyjna dla użytkownika

### Sugerowane Zmiany
Aby zmienić `SlotAvailabilityWidget` aby przekierowywał do lepszej trasy:

```tsx
// W components/slot-availability-widget.tsx, linia 84
const handleBooking = () => {
  if (slotData?.offerId) {
    // ZAMIAST: router.push(`/offers/${slotData.offerId}/book?date=${date}&time=${startTime}`)
    // UŻYJ:
    router.push(`/offers/${slotData.offerId}`)
  }
}
```

Albo jeszcze lepiej - ulepsz `SlotAvailabilityWidget` aby działał jak `BookingWidget` i pokazywał wszystkie dostępne godziny do wyboru.
