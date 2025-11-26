import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import type { Slot, SlotsResponse, OfferAvailability, Offer } from "@/lib/types/dynamic-fields"

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
 * Validates a date string in ISO format (YYYY-MM-DD)
 */
function isValidDateString(dateStr: string): boolean {
  return parseDate(dateStr) !== null
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { offerId } = await params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    // Validate date parameter
    if (!date) {
      return NextResponse.json(
        { error: "Missing required query parameter: date" },
        { status: 400 }
      )
    }

    if (!isValidDateString(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()

    // Load offer by id
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id, duration_minutes, is_active")
      .eq("id", offerId)
      .single()

    if (offerError || !offer) {
      console.error("Offer fetch error:", offerError)
      return NextResponse.json(
        { error: "Offer not found" },
        { status: 404 }
      )
    }

    if (!offer.is_active) {
      return NextResponse.json(
        { error: "Offer is not available" },
        { status: 404 }
      )
    }

    // Get weekday for the date
    const weekday = getWeekday(date)

    // Load offer availability for this offer and weekday
    const { data: availabilities, error: availError } = await supabase
      .from("offer_availability")
      .select("*")
      .eq("offer_id", offerId)
      .eq("weekday", weekday)

    if (availError) {
      console.error("Availability fetch error:", availError)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    // If no availability, return empty slots
    if (!availabilities || availabilities.length === 0) {
      const response: SlotsResponse = { slots: [] }
      return NextResponse.json(response, { status: 200 })
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

    // Get all bookings for this offer and date with active status
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("start_time")
      .eq("offer_id", offerId)
      .eq("booking_date", date)
      .in("status", ["pending", "confirmed"])

    if (bookingsError) {
      console.error("Bookings fetch error:", bookingsError)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    // Count bookings per slot
    const bookingCounts: Record<string, number> = {}
    if (bookings) {
      for (const booking of bookings) {
        const key = booking.start_time
        bookingCounts[key] = (bookingCounts[key] || 0) + 1
      }
    }

    // Build final slots response
    const slots: Slot[] = allGeneratedSlots.map((slot) => {
      const currentBookings = bookingCounts[slot.startTime] || 0
      const capacityLeft = slot.maxBookingsPerSlot - currentBookings

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: capacityLeft > 0,
        capacityLeft: Math.max(0, capacityLeft),
      }
    })

    // Sort slots by start time
    slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

    const response: SlotsResponse = { slots }
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
