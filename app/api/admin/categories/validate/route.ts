import { NextResponse } from "next/server"

import { getPlatformContentApiClient } from "@/lib/platform-admin/api-access"
import { REQUIRED_CATEGORY_FIELDS, validateCategoryFields } from "@/lib/validation/category-fields"

export async function GET() {
  try {
    const supabase = await getPlatformContentApiClient()
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const { data: categories, error: categoriesError } = await supabase.from("categories").select("id, name, slug")
    if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 400 })

    const { data: allFields, error: fieldsError } = await supabase.from("category_fields").select("*").order("field_order")
    if (fieldsError) return NextResponse.json({ error: fieldsError.message }, { status: 400 })

    const categoriesStatus = categories?.map((category) => {
      const categoryFields = allFields?.filter((field) => field.category_id === category.id) || []
      const validation = validateCategoryFields(categoryFields)
      return {
        category_id: category.id,
        category_name: category.name,
        category_slug: category.slug,
        is_valid: validation.isValid,
        missing_fields: validation.missingFields,
      }
    })

    const invalidCategories = categoriesStatus?.filter((category) => !category.is_valid) || []
    return NextResponse.json({
      total_categories: categories?.length || 0,
      valid_categories: categoriesStatus?.filter((category) => category.is_valid).length || 0,
      invalid_categories: invalidCategories.length,
      categories_with_issues: invalidCategories,
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await getPlatformContentApiClient()
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const { data: categories, error: categoriesError } = await supabase.from("categories").select("id")
    if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 400 })

    const { data: allFields, error: fieldsError } = await supabase.from("category_fields").select("*")
    if (fieldsError) return NextResponse.json({ error: fieldsError.message }, { status: 400 })

    let fixedCount = 0
    const fieldsToCreate: Record<string, unknown>[] = []

    for (const category of categories || []) {
      const categoryFields = allFields?.filter((field) => field.category_id === category.id) || []
      const existingFieldNames = new Set(categoryFields.map((field) => field.field_name))
      const maxOrder = categoryFields.length > 0
        ? categoryFields.reduce((max, field) => Math.max(max, field.field_order), -1)
        : -1

      for (const [index, requiredField] of REQUIRED_CATEGORY_FIELDS.entries()) {
        if (!existingFieldNames.has(requiredField.field_name)) {
          fieldsToCreate.push({
            category_id: category.id,
            field_name: requiredField.field_name,
            field_label: requiredField.field_label,
            field_type: requiredField.field_type,
            field_order: maxOrder + 1 + index,
            is_required: requiredField.is_required,
            validation_rules: requiredField.validation_rules,
            options: [],
            placeholder: requiredField.placeholder,
            help_text: requiredField.help_text,
          })
          fixedCount++
        }
      }
    }

    if (fieldsToCreate.length > 0) {
      const { error: insertError } = await supabase.from("category_fields").insert(fieldsToCreate)
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: `Added ${fixedCount} missing required fields to categories`, fields_added: fixedCount })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
