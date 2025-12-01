import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Subcategory } from "@/lib/types/dynamic-fields"

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

// GET - List all subcategories or subcategories for a specific category
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("categoryId")

    let query = supabase.from("subcategories").select("*").order("name")

    if (categoryId) {
      query = query.eq("parent_category_id", categoryId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new subcategory (super admin only)
export async function POST(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const { parent_category_id, name, slug, icon, description, image_url, image_public_id } = body

    if (!parent_category_id || !name || !slug) {
      return NextResponse.json({ error: "Parent category ID, name, and slug are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("subcategories")
      .insert({
        parent_category_id,
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

// PATCH - Update a subcategory (super admin only)
export async function PATCH(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const { id, parent_category_id, name, slug, icon, description, image_url, image_public_id } = body

    if (!id) {
      return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })
    }

    const updateData: Partial<Subcategory> = {}
    if (parent_category_id !== undefined) updateData.parent_category_id = parent_category_id
    if (name) updateData.name = name
    if (slug) updateData.slug = slug
    if (icon !== undefined) updateData.icon = icon
    if (description !== undefined) updateData.description = description
    if (image_url !== undefined) updateData.image_url = image_url
    if (image_public_id !== undefined) updateData.image_public_id = image_public_id

    const { data, error } = await supabase.from("subcategories").update(updateData).eq("id", id).select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete a subcategory (super admin only)
export async function DELETE(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })
    }

    const { error } = await supabase.from("subcategories").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
