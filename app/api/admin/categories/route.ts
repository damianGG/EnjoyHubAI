import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Category } from "@/lib/types/dynamic-fields"

// Helper to check if user is super admin
async function isSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  return userData?.role === "super_admin"
}

// GET - List all categories
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("categories").select("*").order("name")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new category (super admin only)
export async function POST(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const { name, slug, icon, description, image_url, image_public_id } = body

    if (!name || !slug || !icon) {
      return NextResponse.json({ error: "Name, slug, and icon are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name,
        slug,
        icon,
        description,
        image_url,
        image_public_id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update a category (super admin only)
export async function PATCH(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const { id, name, slug, icon, description, image_url, image_public_id } = body

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    const updateData: Partial<Category> = {}
    if (name) updateData.name = name
    if (slug) updateData.slug = slug
    if (icon) updateData.icon = icon
    if (description !== undefined) updateData.description = description
    if (image_url !== undefined) updateData.image_url = image_url
    if (image_public_id !== undefined) updateData.image_public_id = image_public_id

    const { data, error } = await supabase.from("categories").update(updateData).eq("id", id).select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete a category (super admin only)
export async function DELETE(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    const { error } = await supabase.from("categories").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
