import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { OfferAvailability } from "@/lib/types/dynamic-fields"

function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}

/**
 * Parses and validates a date string in ISO format (YYYY-MM-DD)
 * Returns the Date object if valid, null otherwise
 */
function parseDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null
  }

  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  // Verify the parsed date matches the input components
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

/**
 * Gets the weekday (0-6, Monday = 0) for a given date string (YYYY-MM-DD)
 */
function getWeekday(dateStr: string): number {
  const date = parseDate(dateStr)!
  // getUTCDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  // We need 0 for Monday, ..., 6 for Sunday
  const day = date.getUTCDay()
  return day === 0 ? 6 : day - 1
}

/**
 * Converts time string "HH:MM" to minutes from midnight
 * Assumes input is in valid format (from database)
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

/**
 * Generates time slots for a given availability window
 */
function generateSlots(
  availability: OfferAvailability,
  durationMinutes: number
): Array<{ startTime: string; endTime: string; maxBookingsPerSlot: number }> {
  const slots: Array<{ startTime: string; endTime: string; maxBookingsPerSlot: number }> = []
  const startMinutes = timeToMinutes(availability.start_time)
  const endMinutes = timeToMinutes(availability.end_time)
  const slotLengthMinutes = availability.slot_length_minutes

  for (let current = startMinutes; current < endMinutes; current += slotLengthMinutes) {
    const slotEnd = current + durationMinutes
    // Only add slot if it ends within or at the availability window end
    if (slotEnd <= endMinutes) {
      slots.push({
        startTime: minutesToTime(current),
        endTime: minutesToTime(slotEnd),
        maxBookingsPerSlot: availability.max_bookings_per_slot,
      })
    }
  }

  return slots
}

/**
 * Formats a date to ISO string format (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0")
  const day = date.getUTCDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Increments a date by one day
 */
function incrementDate(dateStr: string): string {
  const date = parseDate(dateStr)!
  date.setUTCDate(date.getUTCDate() + 1)
  return formatDate(date)
}

/**
 * Gets the next available slot for an offer within a date range
 * @param offerId - The ID of the offer
 * @param dateStart - Start date in YYYY-MM-DD format
 * @param dateEnd - End date in YYYY-MM-DD format
 * @returns Object with date and startTime of the next available slot, or null if none found
 */
export async function getNextAvailableSlot(
  offerId: string,
  dateStart: string,
  dateEnd: string
): Promise<{ date: string; startTime: string } | null> {
  const supabase = createSupabaseServerClient()

  // Load offer by id
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("id, duration_minutes, is_active")
    .eq("id", offerId)
    .single()

  if (offerError || !offer) {
    console.error("Offer fetch error:", offerError)
    return null
  }

  if (!offer.is_active) {
    return null
  }

  // Loop through dates from dateStart to dateEnd
  let currentDate = dateStart
  const endDate = parseDate(dateEnd)!

  while (parseDate(currentDate)! <= endDate) {
    const weekday = getWeekday(currentDate)

    // Load offer availability for this offer and weekday
    const { data: availabilities, error: availError } = await supabase
      .from("offer_availability")
      .select("*")
      .eq("offer_id", offerId)
      .eq("weekday", weekday)

    if (availError) {
      console.error("Availability fetch error:", availError)
      currentDate = incrementDate(currentDate)
      continue
    }

    // If no availability for this weekday, skip to next day
    if (!availabilities || availabilities.length === 0) {
      currentDate = incrementDate(currentDate)
      continue
    }

    // Generate all slots from availability windows
    const allGeneratedSlots: Array<{
      startTime: string
      endTime: string
      maxBookingsPerSlot: number
    }> = []

    for (const availability of availabilities as OfferAvailability[]) {
      const slots = generateSlots(availability, offer.duration_minutes)
      allGeneratedSlots.push(...slots)
    }

    // Sort slots by start time
    allGeneratedSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

    // Get all bookings for this offer and date with active status
    const { data: bookings, error: bookingsError } = await supabase
      .from("offer_bookings")
      .select("start_time")
      .eq("offer_id", offerId)
      .eq("booking_date", currentDate)
      .in("status", ["pending", "confirmed"])

    if (bookingsError) {
      console.error("Bookings fetch error:", bookingsError)
      currentDate = incrementDate(currentDate)
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

    // Find first available slot
    for (const slot of allGeneratedSlots) {
      const currentBookings = bookingCounts[slot.startTime] || 0
      const capacityLeft = slot.maxBookingsPerSlot - currentBookings

      if (capacityLeft > 0) {
        return {
          date: currentDate,
          startTime: slot.startTime,
        }
      }
    }

    // No available slots on this day, move to next day
    currentDate = incrementDate(currentDate)
  }

  // No available slots found in the entire date range
  return null
}
