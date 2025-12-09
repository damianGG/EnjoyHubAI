import { createClient } from "@/lib/supabase/server"

// Enable debug logging in development
const DEBUG = process.env.NODE_ENV === 'development'

/**
 * Checks if a property has any available slots on a specific date
 * @param propertyId - The ID of the property
 * @param date - Date in YYYY-MM-DD format
 * @returns true if property has availability on the date, false otherwise
 */
export async function getAvailabilityForPropertyOnDate(
  propertyId: string,
  date: string
): Promise<boolean> {
  const supabase = createClient()

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    if (DEBUG) console.error("Invalid date format:", date)
    return false
  }

  // Parse the date to get the weekday
  const [year, month, day] = date.split("-").map(Number)
  const dateObj = new Date(Date.UTC(year, month - 1, day))
  
  // Verify the parsed date is valid
  if (isNaN(dateObj.getTime())) {
    if (DEBUG) console.error("Invalid date:", date)
    return false
  }
  
  const utcDay = dateObj.getUTCDay()
  // Convert to Monday=0, ..., Sunday=6 (same as offer_availability.weekday)
  const weekday = utcDay === 0 ? 6 : utcDay - 1

  console.error(`\n=== Date Availability Check ===`)
  console.error(`Property ID: ${propertyId}`)
  console.error(`Date: ${date}`)
  console.error(`Weekday: ${weekday} (0=Mon, 6=Sun)`)
  console.error(`\nSQL Query 1 (offers):`)
  console.error(`SELECT id, duration_minutes FROM offers WHERE place_id = '${propertyId}' AND is_active = true;`)

  // Fetch all active offers for the property
  const { data: offers, error: offersError } = await supabase
    .from("offers")
    .select("id, duration_minutes")
    .eq("place_id", propertyId)
    .eq("is_active", true)

  if (offersError) {
    console.error("Error fetching offers:", offersError)
    return false
  }
  
  if (!offers || offers.length === 0) {
    console.error(`Result: No active offers found`)
    console.error(`=== End Check ===\n`)
    return false
  }
  
  console.error(`Result: Found ${offers.length} offers:`, offers.map(o => `ID=${o.id}, duration=${o.duration_minutes}min`).join(', '))

  // For each offer, check if it has availability on this weekday and date
  for (const offer of offers) {
    console.error(`\nSQL Query 2 (offer_availability for offer ${offer.id}):`)
    console.error(`SELECT * FROM offer_availability WHERE offer_id = '${offer.id}' AND weekday = ${weekday};`)
    
    // Check if this offer has availability configured for this weekday
    const { data: availabilities, error: availError } = await supabase
      .from("offer_availability")
      .select("*")
      .eq("offer_id", offer.id)
      .eq("weekday", weekday)

    if (availError) {
      console.error(`Error fetching availability for offer ${offer.id}:`, availError)
      continue
    }
    
    if (!availabilities || availabilities.length === 0) {
      console.error(`Result: No availability configured for this weekday`)
      continue
    }
    
    console.error(`Result: Found ${availabilities.length} availability windows:`)
    availabilities.forEach((av: any) => {
      console.error(`  - ${av.start_time} to ${av.end_time}, slot_length=${av.slot_length_minutes}min, max_bookings=${av.max_bookings_per_slot}`)
    })

    // Generate time slots for this offer on this date
    for (const availability of availabilities) {
      const slots = generateSlots(
        availability.start_time,
        availability.end_time,
        availability.slot_length_minutes,
        offer.duration_minutes,
        availability.max_bookings_per_slot
      )

      if (slots.length === 0) {
        console.error(`  Generated 0 slots (duration ${offer.duration_minutes}min too long for window)`)
        continue
      }
      
      console.error(`  Generated ${slots.length} time slots`)

      console.error(`\nSQL Query 3 (offer_bookings):`)
      console.error(`SELECT start_time FROM offer_bookings WHERE offer_id = '${offer.id}' AND booking_date = '${date}' AND status IN ('pending', 'confirmed');`)

      // Get existing bookings for this offer on this date
      const { data: bookings, error: bookingsError } = await supabase
        .from("offer_bookings")
        .select("start_time")
        .eq("offer_id", offer.id)
        .eq("booking_date", date)
        .in("status", ["pending", "confirmed"])

      if (bookingsError) {
        console.error(`Error fetching bookings:`, bookingsError)
        continue
      }
      
      console.error(`Result: Found ${bookings?.length || 0} bookings:`, bookings?.map(b => b.start_time).join(', ') || 'none')

      // Count bookings per slot
      const bookingCounts: Record<string, number> = {}
      if (bookings) {
        for (const booking of bookings) {
          const key = booking.start_time
          bookingCounts[key] = (bookingCounts[key] || 0) + 1
        }
      }

      // Check if any slot has capacity
      console.error(`\nChecking slot capacity:`)
      for (const slot of slots) {
        const currentBookings = bookingCounts[slot.startTime] || 0
        const capacityLeft = slot.maxBookingsPerSlot - currentBookings

        console.error(`  Slot ${slot.startTime}: ${currentBookings}/${slot.maxBookingsPerSlot} booked, capacity left: ${capacityLeft}`)

        if (capacityLeft > 0) {
          console.error(`✅ AVAILABLE SLOT FOUND at ${slot.startTime}`)
          console.error(`=== End Check ===\n`)
          return true
        }
      }
    }
  }

  console.error(`❌ No available slots found`)
  console.error(`=== End Check ===\n`)
  return false
}

/**
 * Helper function to generate time slots for a given availability window
 */
function generateSlots(
  startTime: string,
  endTime: string,
  slotLengthMinutes: number,
  durationMinutes: number,
  maxBookingsPerSlot: number
): Array<{ startTime: string; endTime: string; maxBookingsPerSlot: number }> {
  const slots: Array<{ startTime: string; endTime: string; maxBookingsPerSlot: number }> = []
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  for (let current = startMinutes; current < endMinutes; current += slotLengthMinutes) {
    const slotEnd = current + durationMinutes
    // Only add slot if it ends within or at the availability window end
    if (slotEnd <= endMinutes) {
      slots.push({
        startTime: minutesToTime(current),
        endTime: minutesToTime(slotEnd),
        maxBookingsPerSlot,
      })
    }
  }

  return slots
}

/**
 * Converts time string "HH:MM" or "HH:MM:SS" to minutes from midnight
 */
function timeToMinutes(time: string): number {
  // Accept both HH:MM and HH:MM:SS formats
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
    console.error("Invalid time format:", time)
    return 0
  }
  const parts = time.split(":")
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  // Ignore seconds if present
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error("Invalid time values:", time)
    return 0
  }
  return hours * 60 + minutes
}

/**
 * Converts minutes from midnight to time string "HH:MM"
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}
