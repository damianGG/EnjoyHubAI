import { NextResponse } from "next/server"

import { getPlatformContentApiClient } from "@/lib/platform-admin/api-access"
import { createClient } from "@/lib/supabase/server"
import type { CategoryField } from "@/lib/types/dynamic-fields"
import { isRequiredCategoryField, validateRequiredFieldType } from "@/lib/validation/category-fields"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("category_id")
    const supabase = createClient()
    let query = supabase.from("category_fields").select("*").order("field_order")
    if (categoryId) query = query.eq("category_id", categoryId)
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
    const { category_id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text } = body
    if (!category_id || !field_name || !field_label || !field_type) {
      return NextResponse.json({ error: "Category ID, field name, field label, and field type are required" }, { status: 400 })
    }

    const validTypes = ["text", "textarea", "number", "select", "checkbox", "file"]
    if (!validTypes.includes(field_type)) return NextResponse.json({ error: "Invalid field type" }, { status: 400 })
    if (!validateRequiredFieldType(field_name, field_type)) {
      return NextResponse.json({ error: `Field '${field_name}' is a required category field and must be of type 'number'` }, { status: 400 })
    }

    const { data, error } = await supabase.from("category_fields").insert({
      category_id,
      field_name,
      field_label,
      field_type,
      field_order: field_order || 0,
      is_required: is_required || false,
      validation_rules: validation_rules || {},
      options: options || [],
      placeholder,
      help_text,
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
    const { id, field_name, field_label, field_type, field_order, is_required, validation_rules, options, placeholder, help_text } = body
    if (!id) return NextResponse.json({ error: "Field ID is required" }, { status: 400 })
    if (field_name && field_type && !validateRequiredFieldType(field_name, field_type)) {
      return NextResponse.json({ error: `Field '${field_name}' has an invalid type` }, { status: 400 })
    }

    const updateData: Partial<CategoryField> = {}
    if (field_name) updateData.field_name = field_name
    if (field_label) updateData.field_label = field_label
    if (field_type) updateData.field_type = field_type
    if (field_order !== undefined) updateData.field_order = field_order
    if (is_required !== undefined) updateData.is_required = is_required
    if (validation_rules !== undefined) updateData.validation_rules = validation_rules
    if (options !== undefined) updateData.options = options
    if (placeholder !== undefined) updateData.placeholder = placeholder
    if (help_text !== undefined) updateData.help_text = help_text

    const { data, error } = await supabase.from("category_fields").update(updateData).eq("id", id).select().single()
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
    if (!id) return NextResponse.json({ error: "Field ID is required" }, { status: 400 })

    const { data: existingField } = await supabase.from("category_fields").select("field_name").eq("id", id).single()
    if (existingField && isRequiredCategoryField(existingField.field_name)) {
      return NextResponse.json({ error: `Cannot delete required category field '${existingField.field_name}'. This field is mandatory for all categories.` }, { status: 400 })
    }

    const { error } = await supabase.from("category_fields").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
