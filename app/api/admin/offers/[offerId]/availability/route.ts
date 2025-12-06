import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

// Helper to check if user is super admin
async function isSuperAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  return userData?.role === "super_admin"
}

// POST - Create new availability slot for an offer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { offerId } = await params
    const supabase = createClient()
    const body = await request.json()

    const {
      weekday,
      start_time,
      end_time,
      slot_length_minutes,
      max_bookings_per_slot,
    } = body

    // Validate required fields
    if (
      weekday === undefined ||
      !start_time ||
      !end_time ||
      !slot_length_minutes ||
      !max_bookings_per_slot
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Validate weekday range
    if (weekday < 0 || weekday > 6) {
      return NextResponse.json(
        { error: "Weekday must be between 0 (Monday) and 6 (Sunday)" },
        { status: 400 }
      )
    }

    // Validate positive numbers
    if (slot_length_minutes <= 0 || max_bookings_per_slot <= 0) {
      return NextResponse.json(
        { error: "slot_length_minutes and max_bookings_per_slot must be positive" },
        { status: 400 }
      )
    }

    // Validate time format and logical constraint
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:MM (e.g., 09:00)" },
        { status: 400 }
      )
    }

    const [startHours, startMinutes] = start_time.split(":").map(Number)
    const [endHours, endMinutes] = end_time.split(":").map(Number)
    const startTotalMinutes = startHours * 60 + startMinutes
    const endTotalMinutes = endHours * 60 + endMinutes

    if (startTotalMinutes >= endTotalMinutes) {
      return NextResponse.json(
        { error: "start_time must be before end_time" },
        { status: 400 }
      )
    }

    // Validate the offer exists
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id")
      .eq("id", offerId)
      .single()

    if (offerError || !offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    }

    // Insert the availability slot
    const { data, error } = await supabase
      .from("offer_availability")
      .insert({
        offer_id: offerId,
        weekday,
        start_time,
        end_time,
        slot_length_minutes,
        max_bookings_per_slot,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error creating availability:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete all availability slots for an offer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { offerId } = await params
    const supabase = createClient()

    const { error } = await supabase
      .from("offer_availability")
      .delete()
      .eq("offer_id", offerId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting availability:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
