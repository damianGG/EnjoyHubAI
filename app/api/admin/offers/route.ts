import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Offer } from "@/lib/types/dynamic-fields"

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

// POST - Create a new offer (super admin only)
export async function POST(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = createClient()
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

    // Validate the property exists
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", place_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
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
