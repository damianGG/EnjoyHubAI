import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
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

// Zod schema for booking request validation
const bookingRequestSchema = z.object({
  offerId: z.string().min(1, "offerId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD").refine(
    (date) => {
      const [year, month, day] = date.split("-").map(Number)
      const d = new Date(Date.UTC(year, month - 1, day))
      return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    },
    { message: "Invalid date value" }
  ),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid startTime format. Expected HH:mm").refine(
    (time) => {
      const [hours, minutes] = time.split(":").map(Number)
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
    },
    { message: "Invalid startTime value" }
  ),
  persons: z.number().int("persons must be an integer").positive("persons must be greater than 0"),
  customerName: z.string().min(1, "customerName is required").transform(s => s.trim()),
  customerEmail: z.string().min(1, "customerEmail is required").email("customerEmail must be a valid email address").transform(s => s.trim()),
  customerPhone: z.string().min(1, "customerPhone is required").transform(s => s.trim()),
})

export async function POST(request: Request) {
  try {
    let rawBody: unknown

    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    // Validate request body using Zod
    const parseResult = bookingRequestSchema.safeParse(rawBody)
    
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }

    const { offerId, date, startTime, persons, customerName, customerEmail, customerPhone } = parseResult.data

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
      .select("id", { count: "exact", head: true })
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

    // e) Insert new booking with "pending" status
    const { data: booking, error: insertError } = await supabase
      .from("offer_bookings")
      .insert({
        offer_id: offerId,
        place_id: offer.place_id,
        booking_date: date,
        start_time: startTime,
        end_time: endTime,
        persons: persons,
        status: "pending",
        payment_status: "not_required",
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
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
