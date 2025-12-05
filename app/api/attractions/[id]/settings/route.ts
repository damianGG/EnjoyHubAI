import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import type { SeasonalPrice, BookingMode } from "@/lib/types/dynamic-fields"

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

interface SettingsUpdateRequest {
  booking_mode: BookingMode
  min_stay: number
  max_stay?: number | null
  seasonal_prices: SeasonalPrice[]
  enable_multi_booking?: boolean
  daily_capacity?: number | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: SettingsUpdateRequest = await request.json()
    const { booking_mode, min_stay, max_stay, seasonal_prices, enable_multi_booking, daily_capacity } = body

    // Validate required fields
    if (!booking_mode || !min_stay) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (booking_mode !== "daily" && booking_mode !== "hourly") {
      return NextResponse.json(
        { error: "Invalid booking mode" },
        { status: 400 }
      )
    }

    // Validate multi-booking settings
    if (enable_multi_booking && (!daily_capacity || daily_capacity < 1)) {
      return NextResponse.json(
        { error: "Daily capacity must be at least 1 when multi-booking is enabled" },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify user owns this property or is super admin
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, host_id")
      .eq("id", id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      )
    }

    // Check if user is owner or super admin
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    const isSuperAdmin = userProfile?.role === "super_admin"
    const isOwner = property.host_id === user.id

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. You must be the property owner or admin." },
        { status: 403 }
      )
    }

    // Upsert attraction_availability settings
    const { data, error: upsertError } = await supabase
      .from("attraction_availability")
      .upsert(
        {
          property_id: id,
          booking_mode,
          min_stay,
          max_stay: max_stay || null,
          seasonal_prices: seasonal_prices || [],
          enable_multi_booking: enable_multi_booking ?? false,
          daily_capacity: enable_multi_booking ? daily_capacity : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "property_id",
        }
      )
      .select()
      .single()

    if (upsertError) {
      console.error("Upsert error:", upsertError)
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    )
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
