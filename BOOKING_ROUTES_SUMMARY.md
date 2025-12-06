# Booking Routes Analysis - Quick Summary

## Question
The user asked to analyze the code and identify the two booking routes/systems, specifically which route is triggered from the main view and which one they actually want to use.

## Answer

### Two Different Booking Systems

The application has **TWO separate booking systems**:

1. **Property Booking System** (OLD) - Multi-day stays
2. **Offer/Slot Booking System** (NEW) - Time-based attractions

### System 1: Property Bookings (Multi-day stays)

**Route:** `/attractions/[slug]` → `AvailabilityCalendarCard` → `createBooking` action → `/booking-confirmation/[id]`

**Use Case:** Hotel/apartment-style bookings with check-in/check-out dates

**Database:** `bookings` table

### System 2: Offer Bookings (Time slots)

This is the NEW system that has **TWO different routes**:

#### Route A: From Main View (Attractions Page) 🔴 CURRENTLY USED

```
/attractions/[slug]
  → SlotAvailabilityWidget
  → /offers/[offerId]/book?date=YYYY-MM-DD&time=HH:mm
  → Booking form
  → POST /api/bookings
  → /offers/bookings/[id]
```

**Characteristics:**
- Two-step process
- Automatically selects first available slot
- No choice of preferred time
- Redirects to separate booking page
- Redirects to separate confirmation page

#### Route B: Direct Offer Page ⭐ RECOMMENDED

```
/offers/[id]
  → BookingWidget (everything in one place)
  → Select date from calendar
  → Select preferred time from grid
  → Fill booking form
  → POST /api/bookings
  → Success message inline
```

**Characteristics:**
- One-step process
- Shows all available time slots
- User chooses preferred time
- Everything in one page
- Better UX

### Which Route is from Main View?

**Route A** (SlotAvailabilityWidget → /offers/[offerId]/book) is triggered from the main attractions page at `/attractions/[slug]`.

This is the route you probably **DON'T want to use** because:
- It's simpler but less flexible
- Doesn't show all available time slots
- Requires multiple redirects
- User has no control over time selection

### Which Route You Want to Use?

**Route B** (/offers/[id] with BookingWidget) is the one you likely **WANT to use** because:
- Shows all available time slots
- Better user experience
- Everything in one place
- User has full control
- Fewer clicks to complete booking

## Recommendation

### Current Situation
On `/attractions/[slug]` page, BOTH widgets are shown:

```tsx
<AvailabilityCalendarCard />  {/* Old system - stays */}
<SlotAvailabilityWidget />     {/* New system - slots */}
```

### Suggested Changes

**Option 1:** Change redirect destination
```tsx
// In SlotAvailabilityWidget
const handleBooking = () => {
  if (slotData?.offerId) {
    // INSTEAD OF: router.push(`/offers/${slotData.offerId}/book?date=${date}&time=${startTime}`)
    // USE:
    router.push(`/offers/${slotData.offerId}`)
  }
}
```

**Option 2:** Enhance SlotAvailabilityWidget
- Make it work like BookingWidget
- Show all available time slots
- Include booking form inline
- Show success message without redirect

## Files Reference

### Route A (Current from main view)
- `components/slot-availability-widget.tsx` - Widget on attractions page
- `app/offers/[offerId]/book/page.tsx` - Separate booking form page
- `app/offers/bookings/[id]/page.tsx` - Separate confirmation page

### Route B (Recommended)
- `app/offers/[id]/page.tsx` - Offer detail page
- `components/booking-widget.tsx` - Complete booking widget

### API (Shared by both routes)
- `app/api/bookings/route.ts` - POST endpoint for creating bookings
- Database table: `offer_bookings`

## Documentation Files Created

1. **BOOKING_SYSTEMS_ANALYSIS.md** - Comprehensive analysis in Polish
2. **BOOKING_FLOWS_DIAGRAM.md** - Visual flow diagrams with ASCII art
3. **BOOKING_ROUTES_SUMMARY.md** - This quick summary in English
