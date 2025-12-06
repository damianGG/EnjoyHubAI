# Single-Day Time-Slot Booking System for Playrooms

## Overview

This implementation enables single-day time-slot booking for playrooms (sala zabaw) and similar attractions, replacing the multi-day hotel-style booking system.

## Problem Statement

Previously, all properties (including playrooms) used a hotel-style booking system with:
- Multi-day reservations (check-in/check-out dates)
- Overnight stays logic
- Not suitable for activity-based attractions that operate on hourly/daily slots

## Solution

The system now intelligently uses two booking methods:

### 1. **Time-Slot Booking (NEW)** - For properties with offers
- Single-day bookings with specific time slots
- Based on `offers` and `offer_bookings` tables
- Configurable session durations (e.g., 2 hours, 3 hours)
- Slot availability management
- Support for concurrent bookings (configurable max per slot)

### 2. **Multi-Day Booking (LEGACY)** - For properties without offers
- Traditional check-in/check-out system
- Based on `properties` and `bookings` tables
- Used as fallback for backward compatibility

## How It Works

### Attraction Detail Page Logic

The `/attractions/[slug]` page now:

1. Loads the property details
2. Queries for associated offers (`offers.place_id = property.id`)
3. **If offers exist**: Displays `BookingWidget` component for time-slot booking
4. **If no offers**: Falls back to `AvailabilityCalendarCard` for multi-day booking

### Database Schema

#### Offers Table
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY,
  place_id UUID REFERENCES properties(id),
  title TEXT,
  description TEXT,
  base_price NUMERIC(10, 2),
  currency TEXT DEFAULT 'PLN',
  duration_minutes INTEGER,
  min_participants INTEGER,
  max_participants INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

#### Offer Availability Table
```sql
CREATE TABLE offer_availability (
  id UUID PRIMARY KEY,
  offer_id UUID REFERENCES offers(id),
  weekday INTEGER CHECK (weekday >= 0 AND weekday <= 6), -- 0=Monday, 6=Sunday
  start_time TIME,
  end_time TIME,
  slot_length_minutes INTEGER,
  max_bookings_per_slot INTEGER DEFAULT 1
);
```

#### Offer Bookings Table
```sql
CREATE TABLE offer_bookings (
  id UUID PRIMARY KEY,
  offer_id UUID REFERENCES offers(id),
  place_id UUID REFERENCES properties(id),
  booking_date DATE,
  start_time TIME,
  end_time TIME,
  persons INTEGER,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  payment_status TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT
);
```

## Setting Up Offers for Playrooms

### Step 1: Identify Playroom Properties
Properties with `category_id` matching the 'place-zabaw' category are playrooms.

### Step 2: Create Offers
Run the migration script:
```bash
psql -d your_database -f scripts/17-add-sample-playroom-offers.sql
```

This creates sample offers like:
- "Sesja w sali zabaw - 2 godziny" (2-hour session)
- "Sesja w sali zabaw - 3 godziny" (3-hour session)
- "Pakiet urodzinowy" (Birthday party package)

### Step 3: Configure Availability
The script also creates weekly recurring availability:
- Weekdays (Mon-Fri): 10:00-20:00
- Weekends (Sat-Sun): 09:00-21:00
- Birthday packages: Weekends only, 11:00-18:00

## User Experience

### For Customers
1. Visit attraction detail page
2. Select a date from calendar
3. Choose from available time slots
4. Enter number of participants and contact details
5. Confirm single-day booking

### For Property Owners
- Create offers for their properties
- Set availability windows by day of week
- Configure max bookings per slot
- Manage bookings through admin panel

## Files Modified

- `/app/attractions/[slug]/page.tsx` - Main attraction detail page
  - Added offer loading
  - Conditional rendering based on offers existence
  - Imports BookingWidget component

## Files Added

- `/scripts/17-add-sample-playroom-offers.sql` - Sample data migration

## Testing

### Manual Testing Steps
1. Run the sample offers script
2. Navigate to a playroom attraction page
3. Verify BookingWidget appears (not AvailabilityCalendarCard)
4. Select a date and time slot
5. Complete a test booking
6. Verify booking is created in `offer_bookings` table

### Expected Behavior
- Playrooms with offers: Show time-slot booking widget
- Properties without offers: Show traditional calendar booking
- Single-day bookings only (no multi-day ranges)
- Time slots respect availability windows
- Bookings are exclusive (one per slot) unless configured otherwise

## Future Enhancements

1. **Admin Interface**: UI for property owners to create/manage offers
2. **Booking Management**: Dashboard for viewing/managing offer bookings
3. **Payment Integration**: Connect payment processing for offer bookings
4. **Notifications**: Email confirmations for time-slot bookings
5. **Cancellation Policy**: Time-based cancellation rules
6. **Recurring Bookings**: Support for weekly/monthly recurring slots

## Migration Guide

For existing playroom properties:

1. Create offers for your playroom activities
2. Define availability windows (weekly schedule)
3. Existing multi-day bookings remain in `bookings` table
4. New bookings use `offer_bookings` table
5. Both systems can coexist during transition

## API Endpoints

- `POST /api/bookings` - Create new time-slot booking
- `GET /api/offers/[offerId]/slots?date=YYYY-MM-DD` - Get available slots
- `GET /api/offers/[id]` - Get offer details

## Notes

- The system is backward compatible
- Properties without offers continue using the old booking system
- No data migration required for existing bookings
- Both booking systems use proper RLS (Row Level Security) policies
