import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import type { BlockDatesRequest, BlockDatesResponse } from "@/lib/types/dynamic-fields"

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: BlockDatesRequest = await request.json()
    const { dates, action } = body

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid dates array" } as BlockDatesResponse,
        { status: 400 }
      )
    }

    if (action !== "block" && action !== "unblock") {
      return NextResponse.json(
        { success: false, message: "Invalid action. Must be 'block' or 'unblock'" } as BlockDatesResponse,
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" } as BlockDatesResponse,
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
        { success: false, message: "Property not found" } as BlockDatesResponse,
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
        { success: false, message: "Unauthorized. You must be the property owner or admin." } as BlockDatesResponse,
        { status: 403 }
      )
    }

    // Get existing availability configuration
    const { data: existingAvailability } = await supabase
      .from("attraction_availability")
      .select("blocked_dates")
      .eq("property_id", id)
      .single()

    let currentBlockedDates: string[] = existingAvailability?.blocked_dates || []

    // Update blocked dates based on action
    let updatedBlockedDates: string[]
    if (action === "block") {
      // Add new dates, avoiding duplicates
      const newDates = dates.filter(date => !currentBlockedDates.includes(date))
      updatedBlockedDates = [...currentBlockedDates, ...newDates]
    } else {
      // Remove dates
      updatedBlockedDates = currentBlockedDates.filter(date => !dates.includes(date))
    }

    // Upsert attraction_availability
    const { data: updatedAvailability, error: upsertError } = await supabase
      .from("attraction_availability")
      .upsert(
        {
          property_id: id,
          blocked_dates: updatedBlockedDates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "property_id",
        }
      )
      .select("blocked_dates")
      .single()

    if (upsertError) {
      console.error("Upsert error:", upsertError)
      return NextResponse.json(
        { success: false, message: "Failed to update blocked dates" } as BlockDatesResponse,
        { status: 500 }
      )
    }

    const response: BlockDatesResponse = {
      success: true,
      message: `Successfully ${action}ed ${dates.length} date(s)`,
      blocked_dates: updatedAvailability?.blocked_dates || updatedBlockedDates,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" } as BlockDatesResponse,
      { status: 500 }
    )
  }
}
