import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

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
 */
function parseDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null
  }

  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

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
  const day = date.getUTCDay()
  return day === 0 ? 6 : day - 1
}

/**
 * Converts time string "HH:MM" to minutes from midnight
 * Returns -1 if invalid format
 */
function timeToMinutes(time: string): number {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return -1
  }
  
  const parts = time.split(":")
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return -1
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

/**
 * Generate array of dates between start and end (inclusive)
 */
function getDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  
  while (current <= endDate) {
    const year = current.getUTCFullYear()
    const month = String(current.getUTCMonth() + 1).padStart(2, "0")
    const day = String(current.getUTCDate()).padStart(2, "0")
    dates.push(`${year}-${month}-${day}`)
    current.setUTCDate(current.getUTCDate() + 1)
  }
  
  return dates
}

export interface DayAvailability {
  date: string
  isAvailable: boolean
  hasAvailability: boolean // if the offer has any availability configuration for this day
  totalSlots: number
  bookedSlots: number
}

export interface AvailabilityResponse {
  days: DayAvailability[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { offerId } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Validate parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required query parameters: startDate, endDate" },
        { status: 400 }
      )
    }

    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    const start = parseDate(startDate)!
    const end = parseDate(endDate)!

    if (start > end) {
      return NextResponse.json(
        { error: "startDate must be before or equal to endDate" },
        { status: 400 }
      )
    }

    // Limit range to 3 months for performance
    const maxDays = 90
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > maxDays) {
      return NextResponse.json(
        { error: `Date range too large. Maximum ${maxDays} days allowed.` },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()

    // Load offer by id
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id, is_active")
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
        { error: "Offer is not available" },
        { status: 404 }
      )
    }

    // Load all availability configurations for this offer
    const { data: availabilities, error: availError } = await supabase
      .from("offer_availability")
      .select("weekday, start_time, end_time, slot_length_minutes, max_bookings_per_slot")
      .eq("offer_id", offerId)

    if (availError) {
      console.error("Availability fetch error:", availError)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    // Create map of weekday -> whether it has any availability
    const weekdayHasAvailability = new Map<number, boolean>()
    if (availabilities && availabilities.length > 0) {
      for (const avail of availabilities) {
        weekdayHasAvailability.set(avail.weekday, true)
      }
    }

    // Get all dates in range
    const dates = getDateRange(start, end)

    // Get all bookings for this offer in the date range
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("booking_date, start_time")
      .eq("offer_id", offerId)
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .in("status", ["pending", "confirmed"])

    if (bookingsError) {
      console.error("Bookings fetch error:", bookingsError)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    // Count unique time slots booked per date
    const dateSlotBookings = new Map<string, Set<string>>()
    if (bookings) {
      for (const booking of bookings) {
        const key = booking.booking_date
        if (!dateSlotBookings.has(key)) {
          dateSlotBookings.set(key, new Set())
        }
        dateSlotBookings.get(key)!.add(booking.start_time)
      }
    }

    // Pre-calculate total unique slots per weekday for performance
    const weekdayTotalSlots = new Map<number, number>()
    for (let weekday = 0; weekday < 7; weekday++) {
      const dayAvailabilities = availabilities?.filter(a => a.weekday === weekday) || []
      const seenSlots = new Set<string>()
      
      for (const avail of dayAvailabilities) {
        const startMinutes = timeToMinutes(avail.start_time)
        const endMinutes = timeToMinutes(avail.end_time)
        const slotLength = avail.slot_length_minutes
        
        // Validate time values and slot length
        if (startMinutes < 0 || endMinutes < 0 || slotLength <= 0) {
          console.warn(`Invalid availability config for weekday ${weekday}: start=${avail.start_time}, end=${avail.end_time}, slotLength=${slotLength}`)
          continue
        }
        
        for (let current = startMinutes; current < endMinutes; current += slotLength) {
          const slotTime = minutesToTime(current)
          seenSlots.add(slotTime)
        }
      }
      
      weekdayTotalSlots.set(weekday, seenSlots.size)
    }

    // Build response
    const days: DayAvailability[] = dates.map((date) => {
      const weekday = getWeekday(date)
      const hasAvailability = weekdayHasAvailability.get(weekday) || false
      const bookedSlots = dateSlotBookings.get(date)?.size || 0
      const totalUniqueSlots = weekdayTotalSlots.get(weekday) || 0
      const isAvailable = hasAvailability && bookedSlots < totalUniqueSlots

      return {
        date,
        isAvailable,
        hasAvailability,
        totalSlots: totalUniqueSlots,
        bookedSlots,
      }
    })

    const response: AvailabilityResponse = { days }
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
