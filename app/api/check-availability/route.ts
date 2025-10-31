import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { propertyId, checkIn, checkOut } = await request.json()

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json({ available: false, error: "Missing required fields" }, { status: 400 })
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

    // Check for conflicting bookings
    const { data: conflictingBookings, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("property_id", propertyId)
      .in("status", ["confirmed", "pending"])
      .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`)

    if (error) {
      console.error("Availability check error:", error)
      return NextResponse.json({ available: false, error: "Error checking availability" }, { status: 500 })
    }

    return NextResponse.json({ available: conflictingBookings.length === 0 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ available: false, error: "Internal server error" }, { status: 500 })
  }
}
