# Testing Guide for Single-Day Booking System

## Prerequisites

Before testing, ensure you have:
1. A running Supabase instance with the database schema from scripts 01-16
2. At least one property with category 'place-zabaw' (playroom)
3. Run the sample offers script: `scripts/17-add-sample-playroom-offers.sql`

## Test Scenarios

### Scenario 1: Property with Offers (Single-Day Booking)

**Setup:**
1. Run: `psql -d your_database -f scripts/17-add-sample-playroom-offers.sql`
2. This creates offers for the first playroom property found

**Test Steps:**
1. Navigate to the attraction detail page of a playroom
2. **Expected**: BookingWidget component appears (not AvailabilityCalendarCard)
3. **Expected**: Calendar shows single-day selection only
4. Click on a future date
5. **Expected**: Available time slots appear (e.g., "10:00", "12:00", "14:00")
6. Select a time slot
7. **Expected**: Booking form appears with:
   - Number of persons input
   - Customer name, email, phone fields
   - Summary showing: date, time slot, price calculation
8. Fill in the form and submit
9. **Expected**: Booking confirmation page shows:
   - Single booking date (not date range)
   - Specific time slot (e.g., "10:00 - 12:00")
   - Number of persons
   - Status: confirmed

**Database Verification:**
```sql
-- Check the booking was created correctly
SELECT 
  booking_date,
  start_time,
  end_time,
  persons,
  status,
  customer_name,
  customer_email
FROM offer_bookings
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- `booking_date`: Single date (not a range)
- `start_time` and `end_time`: Specific time slots
- `status`: 'confirmed'
- All customer details populated

### Scenario 2: Property without Offers (Legacy Multi-Day Booking)

**Setup:**
1. Identify a property without any offers (e.g., a hotel or regular accommodation)

**Test Steps:**
1. Navigate to the attraction detail page
2. **Expected**: AvailabilityCalendarCard component appears (not BookingWidget)
3. **Expected**: Calendar allows date range selection
4. Select check-in and check-out dates
5. **Expected**: Traditional multi-night booking flow
6. **Expected**: Shows price breakdown per night

**Database Verification:**
```sql
-- Check the booking was created in the old table
SELECT 
  check_in,
  check_out,
  guests_count,
  total_price,
  status
FROM bookings
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- `check_in` and `check_out`: Date range
- Traditional booking fields
- Uses `bookings` table (not `offer_bookings`)

### Scenario 3: Multiple Offers for One Property

**Setup:**
1. Ensure a property has multiple offers (the sample script creates 3 offers)

**Test Steps:**
1. Navigate to the attraction detail page
2. **Expected**: Multiple BookingWidget components appear, one for each offer
3. **Expected**: Each widget shows different:
   - Title (e.g., "2-hour session", "3-hour session", "Birthday package")
   - Duration
   - Price
   - Available time slots based on offer's availability configuration

### Scenario 4: Slot Availability

**Test Steps:**
1. Select today's date
2. Note available time slots
3. Create a booking for one time slot
4. Refresh the page and select the same date
5. **Expected**: The booked time slot is no longer available
6. Select tomorrow's date
7. **Expected**: All configured time slots are available

**Database Verification:**
```sql
-- Check how many slots are booked for a specific date/time
SELECT 
  booking_date,
  start_time,
  COUNT(*) as bookings_count,
  STRING_AGG(customer_name, ', ') as customers
FROM offer_bookings
WHERE booking_date = '2025-12-06' -- Replace with test date
  AND status IN ('pending', 'confirmed')
GROUP BY booking_date, start_time
ORDER BY start_time;
```

### Scenario 5: Weekly Availability Patterns

**Test Steps:**
1. Check availability on a weekday (Monday-Friday)
2. **Expected**: Slots available from 10:00-20:00 for regular sessions
3. **Expected**: No birthday package available on weekdays
4. Check availability on a weekend (Saturday-Sunday)
5. **Expected**: Slots available from 09:00-21:00 for regular sessions
6. **Expected**: Birthday package available 11:00-18:00 on weekends

## Edge Cases to Test

### Edge Case 1: Past Dates
- **Test**: Try to select a date in the past
- **Expected**: Calendar disables past dates
- **Expected**: No time slots appear for past dates

### Edge Case 2: Max Participants
- **Test**: Try to book more participants than `max_participants` for an offer
- **Expected**: Input field limits the maximum value
- **Expected**: Error message if attempting to exceed limit

### Edge Case 3: Concurrent Bookings
- **Test**: Have two users try to book the same slot simultaneously
- **Expected**: First booking succeeds
- **Expected**: Second booking receives "slot fully booked" error

### Edge Case 4: Inactive Offers
```sql
-- Deactivate an offer
UPDATE offers SET is_active = false WHERE id = 'some-offer-id';
```
- **Test**: Visit the attraction page
- **Expected**: Inactive offers don't appear
- **Expected**: Only active offers show BookingWidget

## Performance Testing

### Test 1: Page Load Time
- **Test**: Measure page load time for attraction with offers
- **Expected**: < 2 seconds for initial load
- **Expected**: ISR caching works (revalidate: 120 seconds)

### Test 2: Slot Query Performance
- **Test**: Check slots API response time
```bash
curl -w "@curl-format.txt" "http://localhost:3000/api/offers/{offerId}/slots?date=2025-12-06"
```
- **Expected**: < 500ms response time
- **Expected**: Proper caching headers

## Security Testing

### Test 1: SQL Injection
- **Test**: Try booking with malicious input in customer fields
- **Example**: `customer_name: "'; DROP TABLE offer_bookings; --"`
- **Expected**: Input is safely escaped/sanitized
- **Expected**: Booking fails or creates safely

### Test 2: Authorization
```sql
-- Verify RLS policies
SELECT * FROM offer_bookings WHERE customer_email != (SELECT email FROM auth.users());
```
- **Expected**: Users can only see their own bookings
- **Expected**: Property owners can see bookings for their properties

### Test 3: Rate Limiting
- **Test**: Rapidly submit multiple booking requests
- **Expected**: Appropriate rate limiting
- **Expected**: Prevents slot over-booking

## Rollback Plan

If issues are found:

1. **Immediate Rollback**: Revert the attraction page changes
```bash
git revert d73f511 8bb2a75
```

2. **Database Rollback**: Remove sample offers
```sql
-- Delete sample offer bookings
DELETE FROM offer_bookings WHERE created_at >= '2025-12-05';

-- Delete sample availability
DELETE FROM offer_availability WHERE created_at >= '2025-12-05';

-- Delete sample offers
DELETE FROM offers WHERE created_at >= '2025-12-05';
```

3. **Verify**: Check that attraction pages fall back to AvailabilityCalendarCard

## Success Criteria

✅ Properties with offers use BookingWidget (single-day booking)
✅ Properties without offers use AvailabilityCalendarCard (multi-day booking)
✅ Bookings are created in correct table (`offer_bookings` vs `bookings`)
✅ Time slots respect availability configuration
✅ Slot conflicts are prevented
✅ User experience is smooth and intuitive
✅ No security vulnerabilities introduced
✅ Build completes without errors
✅ No TypeScript errors
✅ Backward compatibility maintained

## Notes

- Both booking systems can coexist
- No data migration required for existing bookings
- Property owners need to create offers to enable time-slot booking
- Sample script can be run on production after testing in staging
