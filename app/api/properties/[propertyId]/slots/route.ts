import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"
import { getNextAvailableSlotForProperty } from "@/lib/properties/getNextAvailableSlotForProperty"

/**
 * Parses a date string in ISO format (YYYY-MM-DD) to a Date object
 */
function parseDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null
  }

  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  // Verify the parsed date matches the input components
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const { searchParams } = new URL(request.url)
    const dateStart = searchParams.get("date_start")
    const dateEnd = searchParams.get("date_end")

    // Validate required parameters
    if (!dateStart) {
      return NextResponse.json(
        { error: "Missing required query parameter: date_start" },
        { status: 400 }
      )
    }

    if (!dateEnd) {
      return NextResponse.json(
        { error: "Missing required query parameter: date_end" },
        { status: 400 }
      )
    }

    // Validate date formats
    if (!isValidDateString(dateStart)) {
      return NextResponse.json(
        { error: "Invalid date_start format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    if (!isValidDateString(dateEnd)) {
      return NextResponse.json(
        { error: "Invalid date_end format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    // Validate date range
    const startDate = parseDate(dateStart)!
    const endDate = parseDate(dateEnd)!
    if (startDate > endDate) {
      return NextResponse.json(
        { error: "date_start must be before or equal to date_end" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Verify property exists and is active (RLS-safe query)
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("is_active")
      .eq("id", propertyId)
      .maybeSingle()

    if (propertyError) {
      console.error("Property fetch error:", propertyError.message)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      )
    }

    if (!property.is_active) {
      return NextResponse.json(
        { error: "Property is not available" },
        { status: 404 }
      )
    }

    // Get next available slot for the property
    const result = await getNextAvailableSlotForProperty(
      propertyId,
      dateStart,
      dateEnd
    )

    if (!result) {
      return NextResponse.json(
        {
          next_available_slot: null,
          price_from: null,
          offerId: null,
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        next_available_slot: {
          date: result.date,
          startTime: result.startTime,
        },
        price_from: result.price_from,
        offerId: result.offerId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("API error:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
