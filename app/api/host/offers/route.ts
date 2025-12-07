import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Offer } from "@/lib/types/dynamic-fields"

// Helper to check if user owns the property
async function isPropertyOwner(propertyId: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data: property } = await supabase
    .from("properties")
    .select("host_id")
    .eq("id", propertyId)
    .single()

  return property?.host_id === user.id
}

// POST - Create a new offer (property owner only)
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const {
      place_id,
      title,
      description,
      base_price,
      duration_minutes,
      currency,
      max_participants,
      is_active,
    } = body

    // Validate required fields
    if (!place_id || !title || base_price === undefined || !duration_minutes) {
      return NextResponse.json(
        { error: "place_id, title, base_price, and duration_minutes are required" },
        { status: 400 }
      )
    }

    // Verify the property exists and belongs to the user
    if (!(await isPropertyOwner(place_id))) {
      return NextResponse.json({ error: "Unauthorized - property not found or not owned by user" }, { status: 403 })
    }

    // Insert the offer
    const { data, error } = await supabase
      .from("offers")
      .insert({
        place_id,
        title,
        description: description || null,
        base_price,
        duration_minutes,
        currency: currency || "PLN",
        max_participants: max_participants || null,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error creating offer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET - Get all offers for properties owned by the user
export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all properties owned by the user
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("host_id", user.id)

    if (!properties || properties.length === 0) {
      return NextResponse.json([])
    }

    const propertyIds = properties.map(p => p.id)

    // Get all offers for these properties
    const { data: offers, error } = await supabase
      .from("offers")
      .select("*")
      .in("place_id", propertyIds)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(offers || [])
  } catch (error) {
    console.error("Error fetching offers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
