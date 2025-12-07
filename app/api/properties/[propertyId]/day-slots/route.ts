import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Converts time string "HH:MM" to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
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
 * Gets the weekday (0-6, Monday = 0) for a given date string (YYYY-MM-DD)
 */
function getWeekday(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z")
  const day = date.getUTCDay()
  return day === 0 ? 6 : day - 1
}

/**
 * GET - Get all available 30-minute slots for a specific date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json(
        { error: "Missing required query parameter: date" },
        { status: 400 }
      )
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Verify property exists and is active
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("is_active")
      .eq("id", propertyId)
      .maybeSingle()

    if (propertyError) {
      console.error("Property fetch error:", propertyError.message)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (!property.is_active) {
      return NextResponse.json({ error: "Property is not available" }, { status: 404 })
    }

    // Get all active offers for this property
    const { data: offers, error: offersError } = await supabase
      .from("offers")
      .select("id, base_price, currency")
      .eq("place_id", propertyId)
      .eq("is_active", true)

    if (offersError || !offers || offers.length === 0) {
      return NextResponse.json({
        date,
        slots: [],
        price: 0,
        currency: "PLN",
      })
    }

    // Use the first offer's pricing (assuming all offers for a property have same price)
    const offer = offers[0]
    const weekday = getWeekday(date)

    // Get availability configuration for this weekday across all offers
    const offerIds = offers.map((o) => o.id)
    const { data: availabilities, error: availError } = await supabase
      .from("offer_availability")
      .select("*")
      .in("offer_id", offerIds)
      .eq("weekday", weekday)

    if (availError || !availabilities || availabilities.length === 0) {
      return NextResponse.json({
        date,
        slots: [],
        price: offer.base_price,
        currency: offer.currency,
      })
    }

    // Generate all 30-minute slots from availability windows
    const allSlots: Array<{
      time: string
      offerId: string
      capacity: number
    }> = []

    for (const availability of availabilities) {
      const startMinutes = timeToMinutes(availability.start_time)
      const endMinutes = timeToMinutes(availability.end_time)

      // Generate slots every 30 minutes
      for (let current = startMinutes; current < endMinutes; current += 30) {
        allSlots.push({
          time: minutesToTime(current),
          offerId: availability.offer_id,
          capacity: availability.max_bookings_per_slot,
        })
      }
    }

    // Sort slots by time
    allSlots.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))

    // Get existing bookings for this date
    const { data: bookings, error: bookingsError } = await supabase
      .from("offer_bookings")
      .select("start_time, persons")
      .in("offer_id", offerIds)
      .eq("booking_date", date)
      .in("status", ["pending", "confirmed"])

    if (bookingsError) {
      console.error("Bookings fetch error:", bookingsError.message)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Count bookings per slot
    const bookingCounts: Record<string, number> = {}
    if (bookings) {
      for (const booking of bookings) {
        bookingCounts[booking.start_time] = (bookingCounts[booking.start_time] || 0) + 1
      }
    }

    // Build response with availability info
    const slotsWithAvailability = allSlots.map((slot) => ({
      time: slot.time,
      available: true,
      capacity: slot.capacity,
      bookedCount: bookingCounts[slot.time] || 0,
      offerId: slot.offerId,
    }))

    return NextResponse.json({
      date,
      slots: slotsWithAvailability,
      price: offer.base_price,
      currency: offer.currency,
    })
  } catch (error) {
    console.error("API error:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
