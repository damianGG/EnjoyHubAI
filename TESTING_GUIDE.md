# Multi-Booking Capacity Feature - Testing Guide

## Manual Testing Checklist

### Prerequisites
1. Database migration applied: `scripts/17-add-daily-capacity.sql`
2. Application running locally or in test environment
3. Test user account with property ownership permissions

## Test Scenarios

### 1. Admin Configuration Tests

#### Test 1.1: Enable Multi-Booking
**Steps:**
1. Log in as property owner
2. Navigate to property availability settings
3. Go to "Settings" tab
4. Toggle "Enable Multi-Booking" switch to ON
5. Set "Daily Capacity" to 10
6. Click "Save Settings"

**Expected Result:**
- Settings save successfully
- Success message appears
- Settings persist after page refresh

#### Test 1.2: Validate Capacity Requirements
**Steps:**
1. Enable multi-booking
2. Try to save with empty capacity field
3. Try to save with capacity = 0

**Expected Result:**
- Validation error appears
- Settings are not saved
- Error message: "Daily capacity must be at least 1 when multi-booking is enabled"

#### Test 1.3: Disable Multi-Booking
**Steps:**
1. Toggle "Enable Multi-Booking" to OFF
2. Save settings

**Expected Result:**
- Settings save successfully
- Capacity field becomes hidden
- Calendar returns to traditional single-booking mode

### 2. Calendar Visualization Tests

#### Test 2.1: Gradient Display
**Steps:**
1. Enable multi-booking with capacity = 20
2. Create test bookings: 0, 5, 10, 15, 18, 19 bookings for different days
3. View calendar as guest

**Expected Results:**
Day with 0 bookings: Green gradient (0%)
Day with 5 bookings: Green gradient (25%)
Day with 10 bookings: Amber gradient (50%)
Day with 15 bookings: Orange gradient (75%)
Day with 18 bookings: Red gradient (90%)
Day with 19 bookings: Red gradient (95%)

#### Test 2.2: Capacity Numbers Display
**Steps:**
1. View calendar with multi-booking enabled
2. Check each date square

**Expected Result:**
- Each date shows "X/Y" format (e.g., "5/20")
- X = current bookings
- Y = total capacity
- Numbers are readable and properly positioned

#### Test 2.3: Gradient Animation
**Steps:**
1. Create new booking
2. Immediately check calendar

**Expected Result:**
- Gradient updates smoothly
- Numbers update to reflect new booking
- Animation is smooth (300ms transition)

### 3. Booking Enforcement Tests

#### Test 3.1: Accept Booking Within Capacity
**Steps:**
1. Property with capacity = 10, currently 8 bookings
2. Attempt to create new booking

**Expected Result:**
- Booking succeeds
- Confirmation shown
- Capacity shows 9/10

#### Test 3.2: Reject Booking At Capacity
**Steps:**
1. Property with capacity = 10, currently 10 bookings
2. Attempt to create new booking

**Expected Result:**
- Booking rejected
- Error message: capacity exceeded
- Availability calendar shows date as unavailable/full

#### Test 3.3: Multi-Day Booking Capacity Check
**Steps:**
1. Property with capacity = 5
2. Day 1: 4 bookings, Day 2: 2 bookings, Day 3: 5 bookings
3. Attempt to book Day 1-3

**Expected Result:**
- Booking rejected (Day 3 is full)
- Error indicates which day has no capacity
- Suggestion to select different dates

### 4. API Response Tests

#### Test 4.1: Availability API Response
**Request:**
```
GET /api/attractions/[id]/availability?start_date=2025-12-01&end_date=2025-12-10
```

**Expected Response:**
```json
{
  "dates": [
    {
      "date": "2025-12-05",
      "available": true,
      "capacity": 20,
      "booked": 5,
      "occupancyRate": 25,
      // ... other fields
    }
  ]
}
```

#### Test 4.2: Check Availability Response (Multi-Booking)
**Request:**
```
POST /api/check-availability
{
  "propertyId": "...",
  "checkIn": "2025-12-05",
  "checkOut": "2025-12-07"
}
```

**Expected Response:**
```json
{
  "available": true,
  "capacityInfo": {
    "total": 20,
    "maxBooked": 5,
    "remaining": 15
  }
}
```

#### Test 4.3: Settings Save Response
**Request:**
```
POST /api/attractions/[id]/settings
{
  "enable_multi_booking": true,
  "daily_capacity": 20,
  // ... other settings
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    // Updated settings
  }
}
```

### 5. Edge Cases Tests

#### Test 5.1: Capacity = 1 (Same as Traditional Mode)
**Steps:**
1. Set capacity = 1
2. Test booking behavior

**Expected Result:**
- Behaves like traditional single-booking mode
- Only one booking allowed per day
- Visual indicator shows 0/1 or 1/1

#### Test 5.2: Very High Capacity (e.g., 1000)
**Steps:**
1. Set capacity = 1000
2. Create multiple bookings
3. Check performance

**Expected Result:**
- System handles high numbers gracefully
- Calendar renders smoothly
- Calculations are correct

#### Test 5.3: Same-Day Concurrent Bookings
**Steps:**
1. Capacity = 10, currently 9 bookings
2. Two users attempt to book simultaneously

**Expected Result:**
- One booking succeeds (gets slot #10)
- Other booking fails (capacity full)
- No race condition / double booking

### 6. Mobile/Responsive Tests

#### Test 6.1: Mobile Calendar View
**Device:** iPhone, Android phone
**Steps:**
1. View calendar on mobile
2. Check gradient visibility
3. Check capacity numbers readability

**Expected Result:**
- Gradient is visible and clear
- Numbers are readable (not too small)
- Touch interactions work smoothly

#### Test 6.2: Tablet View
**Device:** iPad, Android tablet
**Expected Result:**
- Calendar displays properly
- All features functional
- Good use of screen space

### 7. Backward Compatibility Tests

#### Test 7.1: Existing Properties Without Multi-Booking
**Steps:**
1. Access property that doesn't have multi-booking enabled
2. View calendar
3. Attempt booking

**Expected Result:**
- Works exactly as before
- No capacity indicators shown
- Traditional single-booking behavior

#### Test 7.2: Migration from Traditional to Multi-Booking
**Steps:**
1. Property with existing bookings
2. Enable multi-booking
3. Set capacity = 5
4. View calendar

**Expected Result:**
- Existing bookings count toward capacity
- No data loss
- Smooth transition

## Performance Tests

### Test P1: Large Date Range
**Steps:**
1. Request 6 months of availability data
2. Measure response time

**Expected Result:**
- Response < 2 seconds
- All dates calculated correctly

### Test P2: High Booking Volume
**Steps:**
1. Property with 100+ bookings
2. Calculate availability

**Expected Result:**
- Calculations complete in reasonable time
- No timeouts
- Correct occupancy rates

## Security Tests

### Test S1: Authorization
**Steps:**
1. Try to modify another user's property settings
2. Attempt to set capacity without authentication

**Expected Result:**
- Unauthorized requests rejected (401/403)
- Only owner can modify settings
- RLS policies enforced

### Test S2: Input Validation
**Steps:**
1. Send negative capacity value
2. Send non-numeric capacity
3. Send extremely large capacity (e.g., 999999)

**Expected Result:**
- Validation errors returned
- No database corruption
- Safe handling of invalid input

### Test S3: SQL Injection
**Steps:**
1. Attempt SQL injection in capacity field
2. Try injection in property ID

**Expected Result:**
- Inputs sanitized
- No SQL execution
- Parameterized queries protect database

## Accessibility Tests

### Test A1: Screen Reader
**Steps:**
1. Use screen reader (NVDA, JAWS, VoiceOver)
2. Navigate calendar
3. Listen to capacity information

**Expected Result:**
- Capacity info announced clearly
- Dates properly labeled
- All interactive elements accessible

### Test A2: Keyboard Navigation
**Steps:**
1. Navigate calendar using only keyboard
2. Tab through form elements

**Expected Result:**
- All elements reachable via keyboard
- Focus indicators visible
- Logical tab order

## Bug Reports Template

When reporting issues, include:
```
**Title:** Brief description of issue

**Environment:**
- Browser: [Chrome/Firefox/Safari/etc.]
- Version: [version number]
- Device: [Desktop/Mobile/Tablet]
- OS: [Windows/Mac/iOS/Android]

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happened

**Screenshots:**
[Attach screenshots if applicable]

**Additional Context:**
Any other relevant information
```

## Test Results Template

```markdown
## Test Run: [Date]

**Tester:** [Name]
**Environment:** [Production/Staging/Local]

### Results Summary
- Total Tests: X
- Passed: Y
- Failed: Z
- Blocked: W

### Failed Tests
1. **Test ID:** [Test reference]
   - **Issue:** [Description]
   - **Severity:** [Critical/High/Medium/Low]
   - **Assigned to:** [Developer]

### Notes
[Any additional observations]
```
