import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import type { 
  AttractionAvailability, 
  DateAvailability, 
  AvailabilityCalendar,
  SeasonalPrice 
} from "@/lib/types/dynamic-fields"

async function createSupabaseServerClient() {
  const cookieStore = await cookies()
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
 * Parses a date string in YYYY-MM-DD format
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Formats a date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Checks if a date falls within a seasonal pricing period
 */
function getSeasonalPrice(date: string, seasonalPrices: SeasonalPrice[]): SeasonalPrice | null {
  for (const season of seasonalPrices) {
    if (date >= season.start_date && date <= season.end_date) {
      return season
    }
  }
  return null
}

/**
 * Generates availability data for a date range
 */
function generateAvailabilityDates(
  startDate: string,
  endDate: string,
  basePrice: number,
  availability: AttractionAvailability,
  existingBookings: Array<{ check_in: string; check_out: string }>
): DateAvailability[] {
  const dates: DateAvailability[] = []
  const current = parseDate(startDate)
  const end = parseDate(endDate)
  
  const isMultiBookingEnabled = availability.enable_multi_booking ?? false
  const dailyCapacity = availability.daily_capacity ?? 1

  while (current <= end) {
    const dateStr = formatDate(current)
    const isBlocked = availability.blocked_dates.includes(dateStr)
    
    // Get seasonal price if applicable
    const seasonalPrice = getSeasonalPrice(dateStr, availability.seasonal_prices)

    if (isMultiBookingEnabled && dailyCapacity > 1) {
      // Multi-booking mode: count bookings for this specific date
      const bookingsOnDate = existingBookings.filter(booking => {
        return dateStr >= booking.check_in && dateStr < booking.check_out
      }).length
      
      const isAvailable = !isBlocked && availability.is_available && bookingsOnDate < dailyCapacity
      const occupancyRate = dailyCapacity > 0 ? Math.round((bookingsOnDate / dailyCapacity) * 100) : 0

      dates.push({
        date: dateStr,
        available: isAvailable,
        price: seasonalPrice?.price ?? basePrice,
        isBlocked,
        isSeasonal: !!seasonalPrice,
        seasonalName: seasonalPrice?.name,
        capacity: dailyCapacity,
        booked: bookingsOnDate,
        occupancyRate,
      })
    } else {
      // Traditional single-booking mode
      const isBooked = existingBookings.some(booking => {
        return dateStr >= booking.check_in && dateStr < booking.check_out
      })

      dates.push({
        date: dateStr,
        available: !isBlocked && !isBooked && availability.is_available,
        price: seasonalPrice?.price ?? basePrice,
        isBlocked,
        isSeasonal: !!seasonalPrice,
        seasonalName: seasonalPrice?.name,
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return dates
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // If no date range provided, default to next 3 months
    const now = new Date()
    const defaultStart = formatDate(now)
    const defaultEnd = new Date(now.setMonth(now.getMonth() + 3))
    const defaultEndStr = formatDate(defaultEnd)

    const start = startDate || defaultStart
    const end = endDate || defaultEndStr

    const supabase = await createSupabaseServerClient()

    // Get property details
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, price_per_night, is_active")
      .eq("id", id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      )
    }

    if (!property.is_active) {
      return NextResponse.json(
        { error: "Property is not active" },
        { status: 404 }
      )
    }

    // Get availability configuration
    const { data: availability, error: availError } = await supabase
      .from("attraction_availability")
      .select("*")
      .eq("property_id", id)
      .single()

    // If no availability configuration exists, create a default one for daily mode
    let availabilityConfig: AttractionAvailability
    if (availError || !availability) {
      availabilityConfig = {
        id: "",
        property_id: id,
        booking_mode: "daily",
        blocked_dates: [],
        seasonal_prices: [],
        min_stay: 1,
        max_stay: undefined,
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    } else {
      availabilityConfig = availability as AttractionAvailability
    }

    // Get existing bookings for this property in the date range
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("check_in, check_out")
      .eq("property_id", id)
      .in("status", ["pending", "confirmed"])
      .gte("check_out", start)
      .lte("check_in", end)

    if (bookingsError) {
      console.error("Bookings fetch error:", bookingsError)
      return NextResponse.json(
        { error: "Error fetching bookings" },
        { status: 500 }
      )
    }

    // Generate availability dates
    const dates = generateAvailabilityDates(
      start,
      end,
      property.price_per_night,
      availabilityConfig,
      bookings || []
    )

    const response: AvailabilityCalendar = {
      property_id: id,
      booking_mode: availabilityConfig.booking_mode,
      min_stay: availabilityConfig.min_stay,
      max_stay: availabilityConfig.max_stay,
      dates,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
