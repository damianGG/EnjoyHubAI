# Multi-Booking Capacity Feature - Implementation Summary

## Overview
This feature adds the ability for venues like play centers, museums, and event spaces to sell multiple tickets/bookings for the same day, with visual capacity indicators on the calendar.

## Key Features

### 1. Daily Capacity Management
- Administrators can enable "multi-booking mode" for their properties
- Set a maximum number of bookings that can be accepted per day
- Example: A play center can accept 20 bookings per day

### 2. Visual Calendar Indicators
- Calendar displays occupancy levels with a gradient fill (green → yellow → orange → red)
- Fill animates from bottom to top based on occupancy percentage
- Shows "booked/capacity" numbers on each day (e.g., "5/20")
- Makes it easy for users to see availability at a glance

### 3. Automatic Capacity Enforcement
- Booking API checks available capacity before accepting reservations
- Prevents overbooking by enforcing the daily limit
- Returns capacity information with availability checks

## Database Changes

### Schema Update (scripts/17-add-daily-capacity.sql)
```sql
-- Added to attraction_availability table:
- enable_multi_booking (BOOLEAN): Flag to enable/disable multi-booking
- daily_capacity (INTEGER): Maximum bookings per day
```

**Constraint**: When multi-booking is enabled, daily_capacity must be > 0

## API Updates

### 1. Settings API (`/api/attractions/[id]/settings`)
**New Request Fields**:
```typescript
{
  enable_multi_booking?: boolean
  daily_capacity?: number | null
}
```

**Validation**:
- If `enable_multi_booking` is true, `daily_capacity` must be >= 1

### 2. Availability API (`/api/attractions/[id]/availability`)
**Enhanced Response** (DateAvailability):
```typescript
{
  date: "2025-12-05"
  available: true
  capacity: 20        // NEW: Total capacity
  booked: 5           // NEW: Current bookings
  occupancyRate: 25   // NEW: Percentage (0-100)
  // ... other fields
}
```

### 3. Check Availability API (`/api/check-availability`)
**Enhanced Response**:
```typescript
{
  available: true
  capacityInfo: {      // NEW: When multi-booking enabled
    total: 20
    booked: 5
    remaining: 15
  }
}
```

## UI Components

### 1. CapacityDayButton (`components/ui/capacity-calendar-day.tsx`)
Custom calendar day component that:
- Shows capacity gradient fill based on occupancy
- Color coding:
  - Green (< 25%): High availability
  - Lime (25-50%): Good availability
  - Amber (50-75%): Limited availability
  - Orange (75-90%): Very limited
  - Red (≥ 90%): Nearly full
- Displays "booked/capacity" text
- Fills from bottom to top with smooth gradient

**Props**:
```typescript
{
  occupancyRate?: number  // 0-100 percentage
  capacity?: number       // Total capacity
  booked?: number        // Current bookings
  showCapacityIndicator?: boolean
}
```

### 2. AvailabilityManager Updates (`components/availability-manager.tsx`)
New "Multi-Booking Capacity" section in Settings tab:
- Toggle switch to enable/disable multi-booking
- Input field for daily capacity (visible when enabled)
- Helpful description text explaining the feature

### 3. AvailabilityCalendarCard Updates (`components/availability-calendar-card.tsx`)
- Automatically uses CapacityDayButton when multi-booking is enabled
- Shows occupancy indicators only for properties with capacity > 1
- Seamlessly works with existing calendar functionality

## TypeScript Types

### Updated Interfaces (`lib/types/dynamic-fields.ts`)

```typescript
export interface AttractionAvailability {
  // ... existing fields
  enable_multi_booking?: boolean
  daily_capacity?: number
}

export interface DateAvailability {
  // ... existing fields
  capacity?: number
  booked?: number
  occupancyRate?: number
}
```

## Usage Guide

### For Property Owners/Administrators

#### Enabling Multi-Booking
1. Navigate to your property's availability settings
2. Go to the "Settings" tab
3. Enable the "Multi-Booking" toggle switch
4. Set the "Daily Capacity" (e.g., 20 for 20 bookings per day)
5. Click "Save Settings"

#### Visual Feedback
- Calendar now shows occupancy gradient on each date
- Numbers below each date show current bookings vs. capacity
- Colors help quickly identify availability:
  - 🟢 Green: Plenty of spots available
  - 🟡 Yellow: Moderate availability
  - 🟠 Orange: Limited spots
  - 🔴 Red: Almost full

### For Users/Guests

#### Viewing Availability
- Browse properties with multi-booking enabled
- Calendar displays visual indicators for each day:
  - Gradient fill shows how full each day is
  - Numbers show exact availability (e.g., "5/20")
- Select dates as normal - capacity is automatically enforced

#### Booking Process
- System prevents booking when capacity is reached
- Real-time capacity information during booking
- Clear feedback if selected date is full

## Technical Details

### Capacity Calculation Logic

**For Multi-Booking Enabled**:
```typescript
// Count bookings for specific date
const bookingsOnDate = existingBookings.filter(booking => 
  dateStr >= booking.check_in && dateStr < booking.check_out
).length

// Calculate availability
const isAvailable = bookingsOnDate < dailyCapacity
const occupancyRate = (bookingsOnDate / dailyCapacity) * 100
```

**For Traditional Mode** (multi-booking disabled):
- Works as before - only one booking per date range
- No capacity indicators shown

### Color Gradient Algorithm
```typescript
getOccupancyColor(rate: number) {
  if (rate >= 90) return "red"      // 90-100%
  if (rate >= 75) return "orange"   // 75-90%
  if (rate >= 50) return "amber"    // 50-75%
  if (rate >= 25) return "lime"     // 25-50%
  return "green"                     // 0-25%
}
```

### Visual Fill Effect
- CSS gradient from bottom to top
- Height based on occupancy percentage
- Smooth transition with `transition-all duration-300`
- Semi-transparent overlay (opacity: 0.3) to maintain readability

## Migration Path

### For Existing Properties
1. Feature is **opt-in** - disabled by default
2. Existing properties continue working normally
3. No data migration required
4. Admins can enable on a per-property basis

### Database Migration
Run the migration script:
```bash
# In your database
\i scripts/17-add-daily-capacity.sql
```

This adds the new columns with default values that maintain backward compatibility.

## Security Considerations

### Authorization
- Only property owners and super_admins can modify capacity settings
- RLS policies enforce ownership checks
- All settings updates are authenticated

### Validation
- Server-side validation ensures capacity > 0 when enabled
- Database constraint prevents invalid configurations
- API validates all input before database updates

### Capacity Enforcement
- Backend enforces capacity limits, not just frontend
- Prevents race conditions with proper booking checks
- Returns meaningful error messages when capacity exceeded

## Examples

### Use Cases

1. **Play Center** (Sale zabaw)
   - Capacity: 20 children per day
   - Parents can see real-time availability
   - Visual indicators help choose less crowded days

2. **Museum**
   - Capacity: 100 tickets per day
   - Avoid overcrowding with automatic limits
   - Easy capacity monitoring for staff

3. **Event Space**
   - Capacity: 50 participants per session
   - Clear visual feedback for organizers
   - Professional booking experience

### Configuration Example
```typescript
// Property Settings
{
  booking_mode: "daily",
  min_stay: 1,
  enable_multi_booking: true,
  daily_capacity: 20
}

// Result: Property accepts up to 20 separate bookings per day
// Calendar shows green → red gradient as bookings increase
```

## Future Enhancements

Potential improvements:
1. **Variable Capacity**: Different capacity per day of week
2. **Time-based Capacity**: Combine with hourly booking mode
3. **Capacity Analytics**: Dashboard showing occupancy trends
4. **Automatic Pricing**: Increase prices as capacity fills
5. **Waitlist**: Queue for fully booked days
6. **Group Bookings**: Reserve multiple slots at once

## Testing Checklist

- [x] Database migration runs successfully
- [ ] Settings save and load correctly
- [ ] Calendar displays gradient properly
- [ ] Capacity limits are enforced
- [ ] Multi-booking can be enabled/disabled
- [ ] Traditional mode still works
- [ ] Responsive design on mobile
- [ ] Performance with large date ranges
- [ ] Edge cases (capacity = 1, capacity = 1000)

## Support

For issues or questions:
1. Check API responses for detailed error messages
2. Verify database migration was applied
3. Confirm RLS policies allow your operations
4. Check browser console for client-side errors
5. Review component props and state in React DevTools
