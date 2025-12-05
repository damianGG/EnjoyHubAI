# Attraction Reservation System - Implementation Summary

## Overview
This implementation adds a comprehensive reservation system similar to Airbnb/Booking.com for managing attraction availability, pricing, and bookings.

## Database Changes

### New Table: `attraction_availability`
Located in: `scripts/16-add-attraction-availability.sql`

**Purpose**: Manages booking configurations, blocked dates, and seasonal pricing for properties.

**Key Fields**:
- `booking_mode`: Choose between 'daily' (multi-day stays) or 'hourly' (time-slot bookings)
- `blocked_dates`: Array of dates unavailable for booking (YYYY-MM-DD format)
- `seasonal_prices`: JSON array of seasonal pricing rules with start/end dates
- `min_stay` / `max_stay`: Minimum and maximum stay requirements

**Usage**: Create one record per property to enable advanced availability management.

### Extended Table: `bookings`
**New Fields**:
- `booking_type`: Distinguishes between 'property' and 'attraction' bookings
- `start_time` / `end_time`: For hourly booking mode support
- `applied_price_per_unit`: Stores the actual price applied (considering seasonal rates)

## API Endpoints

### 1. GET /api/attractions/[id]/availability
**Purpose**: Fetch availability calendar with pricing information

**Query Parameters**:
- `start_date` (optional): Start date in YYYY-MM-DD format (defaults to today)
- `end_date` (optional): End date in YYYY-MM-DD format (defaults to 3 months from start)

**Response**:
```json
{
  "property_id": "uuid",
  "booking_mode": "daily",
  "min_stay": 2,
  "max_stay": 14,
  "dates": [
    {
      "date": "2025-01-15",
      "available": true,
      "price": 150.00,
      "isBlocked": false,
      "isSeasonal": true,
      "seasonalName": "Winter Season"
    }
  ]
}
```

### 2. POST /api/attractions/[id]/block-dates
**Purpose**: Block or unblock specific dates (owner/admin only)

**Request Body**:
```json
{
  "property_id": "uuid",
  "dates": ["2025-01-15", "2025-01-16"],
  "action": "block" // or "unblock"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully blocked 2 date(s)",
  "blocked_dates": ["2025-01-15", "2025-01-16", "2025-01-20"]
}
```

### 3. POST /api/attractions/[id]/settings
**Purpose**: Update availability settings (owner/admin only)

**Request Body**:
```json
{
  "booking_mode": "daily",
  "min_stay": 2,
  "max_stay": 14,
  "seasonal_prices": [
    {
      "start_date": "2025-06-01",
      "end_date": "2025-08-31",
      "price": 200.00,
      "name": "Summer Season"
    }
  ]
}
```

## UI Components

### 1. AvailabilityCalendarCard
**File**: `components/availability-calendar-card.tsx`

**Purpose**: Replaces the original BookingCard component on attraction detail pages.

**Features**:
- Interactive calendar with date range selection
- Real-time availability checking
- Dynamic pricing display based on seasonal rates
- Minimum/maximum stay validation
- Automatic price calculation with breakdown
- Visual indicators for available/unavailable dates

**Usage**: Already integrated in `/app/attractions/[slug]/page.tsx`

### 2. AvailabilityManager
**File**: `components/availability-manager.tsx`

**Purpose**: Admin panel for property owners to manage their attraction availability.

**Features**:
- **Settings Tab**: Configure booking mode (daily/hourly) and min/max stay requirements
- **Blocked Dates Tab**: Select and block specific dates from booking
- **Seasonal Pricing Tab**: Create multiple seasonal pricing periods with custom rates

**Access**: Navigate to `/host/properties/[id]/availability` or click "Manage Availability" button on property edit page.

## User Workflows

### For Property Owners

#### Setting Up Availability
1. Navigate to your property in the host dashboard
2. Click "Manage Availability" button
3. Configure:
   - **Booking Mode**: Choose daily or hourly
   - **Min/Max Stay**: Set stay requirements
   - **Blocked Dates**: Select dates to make unavailable
   - **Seasonal Pricing**: Add special pricing for peak seasons

#### Managing Bookings
- View existing bookings in the host dashboard
- Block dates for maintenance or personal use
- Adjust prices seasonally without changing base price

### For Guests

#### Booking an Attraction
1. Browse attractions at `/attractions`
2. Select an attraction to view details
3. Use the interactive calendar to select check-in and check-out dates
4. Calendar automatically shows:
   - Available dates in primary color
   - Unavailable/blocked dates in muted color
   - Current pricing (including seasonal rates)
   - Total price breakdown
5. Select number of guests
6. Click "Reserve" to complete booking

## Technical Details

### Date Handling
- All dates stored and transmitted in ISO 8601 format (YYYY-MM-DD)
- Uses `date-fns` library with `parseISO` for timezone-safe date parsing
- Calendar component uses UTC dates to prevent timezone shifts

### Price Calculation
1. Base price from property record
2. Override with seasonal price if date falls within a seasonal period
3. Calculate total based on number of nights
4. Add service fee (10%) and cleaning fee
5. Display breakdown to user

### Availability Logic
A date is considered available if:
- Not in the `blocked_dates` array
- Not already booked (status: 'pending' or 'confirmed')
- Property `is_available` flag is true
- Falls within min/max stay constraints when combined with other selected dates

### Security
- Row Level Security (RLS) policies ensure:
  - Anyone can view availability for active properties
  - Only property owners can manage their availability
  - Super admins can manage all properties
- Authentication required for all write operations
- User ownership verified before allowing modifications

## Migration Guide

### Running the Database Migration
```sql
-- Execute the migration script
\i scripts/16-add-attraction-availability.sql
```

### Enabling for Existing Properties
The system works with existing properties without requiring data migration. When a property is accessed:
1. If no `attraction_availability` record exists, default settings are used
2. Property owners can create configuration via the admin panel
3. Existing bookings continue to work normally

## TypeScript Types

All new types are available in `lib/types/dynamic-fields.ts`:
- `AttractionAvailability`
- `SeasonalPrice`
- `DateAvailability`
- `AvailabilityCalendar`
- `BlockDatesRequest`
- `BlockDatesResponse`
- `BookingMode`: 'daily' | 'hourly'
- `BookingType`: 'property' | 'attraction'

## Future Enhancements

Potential improvements for future iterations:
1. **Hourly Booking UI**: Implement time-slot selection for hourly mode
2. **Advanced Pricing Rules**: Day-of-week pricing, last-minute discounts
3. **Availability Templates**: Quick apply common blocking patterns
4. **Booking Analytics**: Dashboard showing occupancy rates and revenue
5. **Multi-Property Management**: Bulk operations across multiple properties
6. **iCal Integration**: Sync with external calendars
7. **Automated Pricing**: Dynamic pricing based on demand

## Support

For questions or issues:
1. Check the API endpoint responses for detailed error messages
2. Review the database migration script for schema details
3. Inspect browser console for client-side errors
4. Verify Supabase RLS policies are correctly applied
