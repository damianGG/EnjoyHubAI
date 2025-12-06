import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { REQUIRED_CATEGORY_FIELDS, validateCategoryFields } from "@/lib/validation/category-fields"

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

// GET - Check which categories are missing required fields
export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = createClient()

    // Get all categories
    const { data: categories, error: categoriesError } = await supabase.from("categories").select("id, name, slug")

    if (categoriesError) {
      return NextResponse.json({ error: categoriesError.message }, { status: 400 })
    }

    // Get all category fields
    const { data: allFields, error: fieldsError } = await supabase
      .from("category_fields")
      .select("*")
      .order("field_order")

    if (fieldsError) {
      return NextResponse.json({ error: fieldsError.message }, { status: 400 })
    }

    // Check each category
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

    const invalidCategories = categoriesStatus?.filter((c) => !c.is_valid) || []

    return NextResponse.json({
      total_categories: categories?.length || 0,
      valid_categories: categoriesStatus?.filter((c) => c.is_valid).length || 0,
      invalid_categories: invalidCategories.length,
      categories_with_issues: invalidCategories,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Auto-fix categories by adding missing required fields
export async function POST() {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = createClient()

    // Get all categories
    const { data: categories, error: categoriesError } = await supabase.from("categories").select("id")

    if (categoriesError) {
      return NextResponse.json({ error: categoriesError.message }, { status: 400 })
    }

    // Get all category fields
    const { data: allFields, error: fieldsError } = await supabase.from("category_fields").select("*")

    if (fieldsError) {
      return NextResponse.json({ error: fieldsError.message }, { status: 400 })
    }

    let fixedCount = 0
    const fieldsToCreate = []

    // Check each category and collect missing fields
    for (const category of categories || []) {
      const categoryFields = allFields?.filter((field) => field.category_id === category.id) || []
      const existingFieldNames = new Set(categoryFields.map((f) => f.field_name))

      // Get the next available field_order
      const maxOrder = categoryFields.reduce((max, field) => Math.max(max, field.field_order), -1)

      for (const [index, requiredField] of REQUIRED_CATEGORY_FIELDS.entries()) {
        if (!existingFieldNames.has(requiredField.field_name)) {
          fieldsToCreate.push({
            category_id: category.id,
            field_name: requiredField.field_name,
            field_label: requiredField.field_label,
            field_type: requiredField.field_type,
            field_order: maxOrder + index + 1,
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

    // Insert all missing fields
    if (fieldsToCreate.length > 0) {
      const { error: insertError } = await supabase.from("category_fields").insert(fieldsToCreate)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added ${fixedCount} missing required fields to categories`,
      fields_added: fixedCount,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
