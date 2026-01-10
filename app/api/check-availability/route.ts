import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { AttractionAvailability } from "@/lib/types/dynamic-fields"

export async function POST(request: Request) {
  try {
    const { propertyId, checkIn, checkOut } = await request.json()

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json({ available: false, error: "Missing required fields" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      },
    )

    // Get attraction availability settings to check if multi-booking is enabled
    const { data: availability, error: availError } = await supabase
      .from("attraction_availability")
      .select("enable_multi_booking, daily_capacity")
      .eq("property_id", propertyId)
      .single()

    const isMultiBookingEnabled = availability?.enable_multi_booking ?? false
    const dailyCapacity = availability?.daily_capacity ?? 1

    // Check for conflicting bookings
    const { data: conflictingBookings, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out")
      .eq("property_id", propertyId)
      .in("status", ["confirmed", "pending"])
      .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`)

    if (error) {
      console.error("Availability check error:", error)
      return NextResponse.json({ available: false, error: "Error checking availability" }, { status: 500 })
    }

    if (isMultiBookingEnabled && dailyCapacity > 1) {
      // Multi-booking mode: check capacity for each day in the requested range
      // We need to ensure no single day exceeds capacity
      
      // Parse dates
      const startDate = new Date(checkIn)
      const endDate = new Date(checkOut)
      
      // Check each day in the range
      const currentDate = new Date(startDate)
      let maxOccupancy = 0
      
      while (currentDate < endDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        
        // Count bookings that overlap with this specific date
        const bookingsOnThisDate = conflictingBookings?.filter(booking => {
          return dateStr >= booking.check_in && dateStr < booking.check_out
        }).length ?? 0
        
        maxOccupancy = Math.max(maxOccupancy, bookingsOnThisDate)
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      // Available if all days have capacity
      const available = maxOccupancy < dailyCapacity
      
      return NextResponse.json({ 
        available, 
        capacityInfo: {
          total: dailyCapacity,
          maxBooked: maxOccupancy,
          remaining: dailyCapacity - maxOccupancy
        }
      })
    } else {
      // Traditional single-booking mode
      return NextResponse.json({ available: conflictingBookings.length === 0 })
    }
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ available: false, error: "Internal server error" }, { status: 500 })
  }
}
