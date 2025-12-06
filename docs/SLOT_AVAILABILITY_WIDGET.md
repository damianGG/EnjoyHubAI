# Slot Availability Widget Implementation

## Overview

This document describes the slot availability widget feature added to property detail pages.

## Feature Description

The Slot Availability Widget allows users to:
1. Select a date using an interactive calendar (defaults to today)
2. View the next available time slot for bookings on that date
3. See the price for the offer
4. Click "Zarezerwuj" (Reserve) to navigate to the offer booking flow

## Implementation

### Components

**SlotAvailabilityWidget** (`components/slot-availability-widget.tsx`)
- Client-side React component
- Uses shadcn/ui Calendar for date selection
- Fetches slot data from `/api/properties/[propertyId]/slots` API
- Displays loading states, errors, and slot information
- Redirects to `/offers/[offerId]` for booking

### Integration

The widget is integrated into the property detail page at `app/attractions/[slug]/page.tsx`:
- Located in the right sidebar below the AvailabilityCalendarCard
- Uses sticky positioning to stay visible while scrolling
- Properly spaced with existing components

### API Integration

**Endpoint**: `/api/properties/[propertyId]/slots`

**Query Parameters**:
- `date_start`: Start date in YYYY-MM-DD format
- `date_end`: End date in YYYY-MM-DD format (default: 30 days from start)

**Response**:
```json
{
  "next_available_slot": {
    "date": "2025-12-15",
    "startTime": "10:00"
  },
  "price_from": 89,
  "offerId": "abc123"
}
```

### Configuration

**Constants**:
- `SLOT_SEARCH_RANGE_DAYS`: Set to 30 days (can be adjusted in the component)

## User Flow

1. User lands on property detail page
2. Widget shows calendar with today's date selected
3. User can select any future date
4. Widget fetches and displays next available slot for selected date
5. If slot is available:
   - Shows date, time, and price
   - "Zarezerwuj" button is enabled
   - Clicking button navigates to offer booking page
6. If no slot is available:
   - Shows "Brak dostępnych terminów" message

## Error Handling

- Network errors: Shows error message to user
- Invalid API responses: Gracefully handles with fallback error message
- Invalid date formats: Validates input before formatting
- Missing Supabase configuration: Shows appropriate error message

## Performance Optimizations

- Uses `useMemo` for today's date calculation to avoid re-renders
- Efficient state management with React hooks
- Loading states prevent multiple simultaneous requests

## Testing

The widget was tested with:
- Date selection functionality
- API integration (with mock property ID)
- Error handling (when Supabase not configured)
- Loading states
- Responsive design

## Future Enhancements

Potential improvements:
- Add internationalization support
- Allow configurable search range
- Show multiple available slots instead of just the next one
- Cache slot data to reduce API calls
- Add animations for better UX
