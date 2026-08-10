import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const supabase = createClient()

    // Get property with host information
    // Note: Using explicit foreign key constraint name as properties table
    // has host_id referencing users. This is the standard Supabase pattern
    // when multiple foreign keys reference the same table.
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select(`
        address,
        users!properties_host_id_fkey (
          phone,
          email,
          full_name
        )
      `)
      .eq("id", propertyId)
      .eq("is_active", true)
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

    // Return contact information
    return NextResponse.json(
      {
        phone: property.users?.phone || null,
        email: property.users?.email || null,
        address: property.address || null,
        host_name: property.users?.full_name || null,
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
