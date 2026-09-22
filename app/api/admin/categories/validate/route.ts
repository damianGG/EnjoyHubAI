import { NextResponse } from "next/server"

import { getPlatformContentApiClient } from "@/lib/platform-admin/api-access"

type CategoryRow = {
  id: string
  name: string
  slug: string
}

type SubcategoryRow = {
  id: string
  parent_category_id: string
  name: string
  slug: string
}

async function validateCatalog() {
  const supabase = await getPlatformContentApiClient()
  if (!supabase) return { unauthorized: true as const }

  const [categoriesResult, subcategoriesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,name,slug")
      .eq("catalog_visible", true)
      .order("name"),
    supabase
      .from("subcategories")
      .select("id,parent_category_id,name,slug")
      .order("name"),
  ])

  const error = categoriesResult.error || subcategoriesResult.error
  if (error) return { error: error.message }

  const categories = (categoriesResult.data ?? []) as CategoryRow[]
  const subcategories = (subcategoriesResult.data ?? []) as SubcategoryRow[]
  const categoriesStatus = categories.map((category) => {
    const activities = subcategories.filter((activity) => activity.parent_category_id === category.id)
    return {
      category_id: category.id,
      category_name: category.name,
      category_slug: category.slug,
      activity_count: activities.length,
      is_valid: activities.length > 0,
      issue: activities.length > 0 ? null : "Kategoria nie ma żadnego rodzaju atrakcji.",
    }
  })

  const invalidCategories = categoriesStatus.filter((category) => !category.is_valid)
  return {
    total_categories: categories.length,
    valid_categories: categoriesStatus.length - invalidCategories.length,
    invalid_categories: invalidCategories.length,
    categories_with_issues: invalidCategories,
  }
}

export async function GET() {
  try {
    const result = await validateCatalog()
    if ("unauthorized" in result) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await validateCatalog()
    if ("unauthorized" in result) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({
      ...result,
      success: result.invalid_categories === 0,
      message: result.invalid_categories === 0
        ? "Katalog ma poprawną strukturę kategorii i rodzajów atrakcji."
        : "Dodaj co najmniej jeden rodzaj atrakcji do każdej kategorii. EnjoyHub nie tworzy sztucznych podkategorii automatycznie.",
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
