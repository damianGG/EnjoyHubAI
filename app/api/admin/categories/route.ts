import { NextResponse } from "next/server"

import { getPlatformContentApiClient } from "@/lib/platform-admin/api-access"
import { createClient } from "@/lib/supabase/server"
import type { Category } from "@/lib/types/dynamic-fields"

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("categories").select("*").eq("catalog_visible", true).order("name")
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
    const { name, slug, icon, description, image_url, image_public_id } = body
    if (!name || !slug || !icon) return NextResponse.json({ error: "Name, slug, and icon are required" }, { status: 400 })

    const { data, error } = await supabase.from("categories").insert({ name, slug, icon, description, image_url, image_public_id }).select().single()
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
    const { id, name, slug, icon, description, image_url, image_public_id } = body
    if (!id) return NextResponse.json({ error: "Category ID is required" }, { status: 400 })

    const updateData: Partial<Category> = {}
    if (name) updateData.name = name
    if (slug) updateData.slug = slug
    if (icon) updateData.icon = icon
    if (description !== undefined) updateData.description = description
    if (image_url !== undefined) updateData.image_url = image_url
    if (image_public_id !== undefined) updateData.image_public_id = image_public_id

    const { data, error } = await supabase.from("categories").update(updateData).eq("id", id).select().single()
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
    if (!id) return NextResponse.json({ error: "Category ID is required" }, { status: 400 })

    const { error } = await supabase.from("categories").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
