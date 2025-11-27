import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Offer, OfferAvailability } from "@/lib/types/dynamic-fields"

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
 * Validates a date string in ISO format (YYYY-MM-DD)
 */
function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false
  }

  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Validates a time string in HH:mm format
 */
function isValidTimeString(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    return false
  }

  const [hours, minutes] = timeStr.split(":").map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/**
 * Gets the weekday (0-6, Monday = 0) for a given date string (YYYY-MM-DD)
 */
function getWeekday(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  // getUTCDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  // We need 0 for Monday, ..., 6 for Sunday
  const dayOfWeek = date.getUTCDay()
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1
}

/**
 * Converts time string "HH:mm" to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const parts = time.split(":")
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  return hours * 60 + minutes
}

/**
 * Converts minutes from midnight to time string "HH:mm"
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

/**
 * Checks if startTime is within an availability window [start_time, end_time)
 * and if the full booking duration fits within the window
 */
function isTimeInAvailabilityWindow(
  startTime: string,
  durationMinutes: number,
  availability: OfferAvailability
): boolean {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + durationMinutes
  const windowStartMinutes = timeToMinutes(availability.start_time)
  const windowEndMinutes = timeToMinutes(availability.end_time)

  return startMinutes >= windowStartMinutes && endMinutes <= windowEndMinutes
}

interface BookingRequestBody {
  offerId: string
  date: string
  startTime: string
  persons: number
  customerName: string
  customerEmail: string
  customerPhone: string
}

export async function POST(request: Request) {
  try {
    let body: BookingRequestBody

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const { offerId, date, startTime, persons, customerName, customerEmail, customerPhone } = body

    // Validate required fields
    if (!offerId || typeof offerId !== "string") {
      return NextResponse.json(
        { error: "offerId is required and must be a string" },
        { status: 400 }
      )
    }

    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { error: "date is required and must be a string" },
        { status: 400 }
      )
    }

    if (!isValidDateString(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    if (!startTime || typeof startTime !== "string") {
      return NextResponse.json(
        { error: "startTime is required and must be a string" },
        { status: 400 }
      )
    }

    if (!isValidTimeString(startTime)) {
      return NextResponse.json(
        { error: "Invalid startTime format. Expected HH:mm" },
        { status: 400 }
      )
    }

    if (persons === undefined || persons === null || typeof persons !== "number") {
      return NextResponse.json(
        { error: "persons is required and must be a number" },
        { status: 400 }
      )
    }

    if (persons <= 0 || !Number.isInteger(persons)) {
      return NextResponse.json(
        { error: "persons must be a positive integer" },
        { status: 400 }
      )
    }

    if (!customerName || typeof customerName !== "string" || customerName.trim() === "") {
      return NextResponse.json(
        { error: "customerName is required and must be a non-empty string" },
        { status: 400 }
      )
    }

    if (!customerEmail || typeof customerEmail !== "string" || customerEmail.trim() === "") {
      return NextResponse.json(
        { error: "customerEmail is required and must be a non-empty string" },
        { status: 400 }
      )
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json(
        { error: "customerEmail must be a valid email address" },
        { status: 400 }
      )
    }

    if (!customerPhone || typeof customerPhone !== "string" || customerPhone.trim() === "") {
      return NextResponse.json(
        { error: "customerPhone is required and must be a non-empty string" },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()

    // a) Load offer and check it exists and is active
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id, place_id, duration_minutes, is_active")
      .eq("id", offerId)
      .single()

    if (offerError || !offer) {
      return NextResponse.json(
        { error: "Offer not found" },
        { status: 404 }
      )
    }

    if (!offer.is_active) {
      return NextResponse.json(
        { error: "Offer is not active" },
        { status: 404 }
      )
    }

    // b) Load availability for this offer and date
    const weekday = getWeekday(date)

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

    // Find matching availability window where startTime is within [start_time, end_time)
    // and the booking duration fits
    const matchingAvailability = (availabilities as OfferAvailability[] | null)?.find(
      (avail) => isTimeInAvailabilityWindow(startTime, offer.duration_minutes, avail)
    )

    if (!matchingAvailability) {
      return NextResponse.json(
        { error: "The selected time slot is not available" },
        { status: 409 }
      )
    }

    // c) Calculate endTime
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = startMinutes + offer.duration_minutes
    const endTime = minutesToTime(endMinutes)

    // d) Count existing bookings for this slot
    const { count: activeBookingsCount, error: countError } = await supabase
      .from("offer_bookings")
      .select("*", { count: "exact", head: true })
      .eq("offer_id", offerId)
      .eq("booking_date", date)
      .eq("start_time", startTime)
      .in("status", ["pending", "confirmed"])

    if (countError) {
      console.error("Booking count error:", countError)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    const currentActiveBookings = activeBookingsCount ?? 0

    if (currentActiveBookings >= matchingAvailability.max_bookings_per_slot) {
      return NextResponse.json(
        { error: "The selected time slot is fully booked" },
        { status: 409 }
      )
    }

    // e) Insert new booking
    const { data: booking, error: insertError } = await supabase
      .from("offer_bookings")
      .insert({
        offer_id: offerId,
        place_id: offer.place_id,
        booking_date: date,
        start_time: startTime,
        end_time: endTime,
        persons: persons,
        status: "confirmed",
        payment_status: "not_required",
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim(),
        source: "online_enjoyhub",
      })
      .select("id, status, payment_status, booking_date, start_time, end_time, persons, offer_id, place_id")
      .single()

    if (insertError) {
      console.error("Booking insert error:", insertError)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    // f) Return booking details
    return NextResponse.json(
      {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.payment_status,
        date: booking.booking_date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        persons: booking.persons,
        offerId: booking.offer_id,
        placeId: booking.place_id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Unexpected error in booking creation:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
