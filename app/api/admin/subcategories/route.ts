import { NextResponse } from "next/server"

import { getPlatformContentApiClient } from "@/lib/platform-admin/api-access"
import { createClient } from "@/lib/supabase/server"
import type { Subcategory } from "@/lib/types/dynamic-fields"

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const categoryId = new URL(request.url).searchParams.get("categoryId")
    let query = supabase.from("subcategories").select("*").order("name")
    if (categoryId) query = query.eq("parent_category_id", categoryId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getPlatformContentApiClient()
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const body = await request.json()
    const { parent_category_id, name, slug, icon, description, image_url, image_public_id } = body
    if (!parent_category_id || !name || !slug) {
      return NextResponse.json({ error: "Parent category ID, name, and slug are required" }, { status: 400 })
    }

    const { data, error } = await supabase.from("subcategories").insert({
      parent_category_id,
      name,
      slug,
      icon,
      description,
      image_url,
      image_public_id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getPlatformContentApiClient()
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const body = await request.json()
    const { id, parent_category_id, name, slug, icon, description, image_url, image_public_id } = body
    if (!id) return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })

    const updateData: Partial<Subcategory> = {}
    if (parent_category_id !== undefined) updateData.parent_category_id = parent_category_id
    if (name) updateData.name = name
    if (slug) updateData.slug = slug
    if (icon !== undefined) updateData.icon = icon
    if (description !== undefined) updateData.description = description
    if (image_url !== undefined) updateData.image_url = image_url
    if (image_public_id !== undefined) updateData.image_public_id = image_public_id

    const { data, error } = await supabase.from("subcategories").update(updateData).eq("id", id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getPlatformContentApiClient()
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })

    const { error } = await supabase.from("subcategories").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
