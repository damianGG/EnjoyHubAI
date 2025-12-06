import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { offerId } = await params

    const supabase = createClient()

    // Get offer details with place info
    const { data: offer, error } = await supabase
      .from("offers")
      .select(`
        *,
        properties!offers_place_id_fkey (
          title,
          city,
          country,
          address
        )
      `)
      .eq("id", offerId)
      .eq("is_active", true)
      .single()

    if (error || !offer) {
      return NextResponse.json(
        { error: "Offer not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(offer, { status: 200 })
  } catch (error) {
    console.error("API error:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
