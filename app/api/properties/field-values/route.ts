import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Helper to check if user owns the property
async function userOwnsProperty(propertyId: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data } = await supabase.from("properties").select("host_id").eq("id", propertyId).single()

  return data?.host_id === user.id
}

// GET - Get field values for a property
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get("property_id")

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID is required" }, { status: 400 })
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from("object_field_values")
      .select(
        `
        *,
        field:category_fields(*)
      `,
      )
      .eq("property_id", propertyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create or update field values for a property
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const body = await request.json()

    const { property_id, field_values } = body

    if (!property_id || !field_values || !Array.isArray(field_values)) {
      return NextResponse.json({ error: "Property ID and field values array are required" }, { status: 400 })
    }

    // Check if user owns the property
    if (!(await userOwnsProperty(property_id))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Upsert field values
    const results = []
    for (const fieldValue of field_values) {
      const { field_id, value, file_url } = fieldValue

      if (!field_id) {
        continue
      }

      const { data, error } = await supabase
        .from("object_field_values")
        .upsert(
          {
            property_id,
            field_id,
            value,
            file_url,
          },
          {
            onConflict: "property_id,field_id",
          },
        )
        .select()
        .single()

      if (error) {
        console.error("Error upserting field value:", error)
        continue
      }

      results.push(data)
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update field values for a property (same as POST, for convenience)
export async function PUT(request: Request) {
  return POST(request)
}

// DELETE - Delete a field value
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const propertyId = searchParams.get("property_id")

    if (!id || !propertyId) {
      return NextResponse.json({ error: "Field value ID and property ID are required" }, { status: 400 })
    }

    // Check if user owns the property
    if (!(await userOwnsProperty(propertyId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = createClient()
    const { error } = await supabase.from("object_field_values").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
