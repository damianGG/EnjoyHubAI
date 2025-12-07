import { createClient } from "@/lib/supabase/server"

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

  // Parse the date to get the weekday
  const dateObj = new Date(date + "T00:00:00Z")
  const utcDay = dateObj.getUTCDay()
  // Convert to Monday=0, ..., Sunday=6 (same as offer_availability.weekday)
  const weekday = utcDay === 0 ? 6 : utcDay - 1

  // Fetch all active offers for the property
  const { data: offers, error: offersError } = await supabase
    .from("offers")
    .select("id, duration_minutes")
    .eq("place_id", propertyId)
    .eq("is_active", true)

  if (offersError || !offers || offers.length === 0) {
    return false
  }

  // For each offer, check if it has availability on this weekday and date
  for (const offer of offers) {
    // Check if this offer has availability configured for this weekday
    const { data: availabilities, error: availError } = await supabase
      .from("offer_availability")
      .select("*")
      .eq("offer_id", offer.id)
      .eq("weekday", weekday)

    if (availError || !availabilities || availabilities.length === 0) {
      continue
    }

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
        continue
      }

      // Get existing bookings for this offer on this date
      const { data: bookings, error: bookingsError } = await supabase
        .from("offer_bookings")
        .select("start_time")
        .eq("offer_id", offer.id)
        .eq("booking_date", date)
        .in("status", ["pending", "confirmed"])

      if (bookingsError) {
        continue
      }

      // Count bookings per slot
      const bookingCounts: Record<string, number> = {}
      if (bookings) {
        for (const booking of bookings) {
          const key = booking.start_time
          bookingCounts[key] = (bookingCounts[key] || 0) + 1
        }
      }

      // Check if any slot has capacity
      for (const slot of slots) {
        const currentBookings = bookingCounts[slot.startTime] || 0
        const capacityLeft = slot.maxBookingsPerSlot - currentBookings

        if (capacityLeft > 0) {
          return true
        }
      }
    }
  }

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
 * Converts time string "HH:MM" to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const parts = time.split(":")
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
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
