import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get("propertyId")

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID is required" }, { status: 400 })
    }

    const cookieStore = cookies()
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

    // Get all bookings for this property that are confirmed or pending
    // Only get bookings from today onwards
    const today = new Date().toISOString().split("T")[0]
    
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("check_in, check_out")
      .eq("property_id", propertyId)
      .in("status", ["confirmed", "pending"])
      .gte("check_out", today)

    if (error) {
      console.error("Error fetching booked dates:", error)
      return NextResponse.json({ error: "Error fetching booked dates" }, { status: 500 })
    }

    // Generate array of all booked dates
    const bookedDates: string[] = []
    
    for (const booking of bookings || []) {
      const checkIn = new Date(booking.check_in)
      const checkOut = new Date(booking.check_out)
      
      // Add all dates between check-in and check-out (inclusive of check-in, exclusive of check-out)
      const currentDate = new Date(checkIn)
      while (currentDate < checkOut) {
        bookedDates.push(currentDate.toISOString().split("T")[0])
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Remove duplicates
    const uniqueBookedDates = [...new Set(bookedDates)]

    return NextResponse.json({ bookedDates: uniqueBookedDates })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
