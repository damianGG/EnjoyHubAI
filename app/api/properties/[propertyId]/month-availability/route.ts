import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Converts time string "HH:MM" to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Gets the weekday (0-6, Monday = 0) for a given date string (YYYY-MM-DD)
 */
function getWeekday(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z")
  const day = date.getUTCDay()
  return day === 0 ? 6 : day - 1
}

/**
 * GET - Get all days in a date range that have available slots
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing required query parameters: start and end" },
        { status: 400 }
      )
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get all active offers for this property
    const { data: offers, error: offersError } = await supabase
      .from("offers")
      .select("id")
      .eq("place_id", propertyId)
      .eq("is_active", true)

    if (offersError || !offers || offers.length === 0) {
      return NextResponse.json({ daysWithSlots: [] })
    }

    // Get all availability configurations for these offers
    const offerIds = offers.map((o) => o.id)
    const { data: availabilities, error: availError } = await supabase
      .from("offer_availability")
      .select("weekday, start_time, end_time")
      .in("offer_id", offerIds)

    if (availError || !availabilities || availabilities.length === 0) {
      return NextResponse.json({ daysWithSlots: [] })
    }

    // Group availabilities by weekday
    const availabilityByWeekday: Record<number, boolean> = {}
    for (const avail of availabilities) {
      availabilityByWeekday[avail.weekday] = true
    }

    // Generate list of dates between start and end
    const startDate = new Date(start + "T00:00:00Z")
    const endDate = new Date(end + "T00:00:00Z")
    const daysWithSlots: string[] = []

    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0]
      const weekday = getWeekday(dateStr)

      // Check if this weekday has any availability configured
      if (availabilityByWeekday[weekday]) {
        daysWithSlots.push(dateStr)
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    return NextResponse.json({ daysWithSlots })
  } catch (error) {
    console.error("API error:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
