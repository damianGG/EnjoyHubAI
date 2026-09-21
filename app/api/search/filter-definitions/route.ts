import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

type RawDefinition = {
  key: string
  label: string
  value_type: "text" | "number" | "boolean" | "select" | "textarea"
  options: unknown
  unit: string | null
  sort_order: number
}

type FilterDefinition = {
  scope: "supply" | "product"
  key: string
  label: string
  valueType: RawDefinition["value_type"]
  options: string[]
  unit: string | null
  sortOrder: number
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replaceAll("_", "-")
}

function safeOptions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string").slice(0, 100)
}

function mapDefinition(scope: FilterDefinition["scope"], definition: RawDefinition): FilterDefinition {
  return {
    scope,
    key: definition.key,
    label: definition.label,
    valueType: definition.value_type,
    options: safeOptions(definition.options),
    unit: definition.unit,
    sortOrder: definition.sort_order,
  }
}

export const revalidate = 300

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = normalizeSlug(searchParams.get("category") || "")

  if (!slug || !/^[a-z0-9-]{2,80}$/.test(slug)) {
    return NextResponse.json({ category: null, definitions: [] })
  }

  const supabase = createAdminClient()
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle()

  if (categoryError) {
    console.error("[search filters] Failed to resolve category", categoryError)
    return NextResponse.json({ error: "Unable to load filters" }, { status: 500 })
  }

  let resolvedCategory = category
  let resolvedSubcategory: { id: string; name: string; slug: string; parent_category_id: string } | null = null

  if (!resolvedCategory) {
    const { data: subcategory, error: subcategoryError } = await supabase
      .from("subcategories")
      .select("id,name,slug,parent_category_id")
      .eq("slug", slug)
      .maybeSingle()

    if (subcategoryError) {
      console.error("[search filters] Failed to resolve subcategory", subcategoryError)
      return NextResponse.json({ error: "Unable to load filters" }, { status: 500 })
    }

    if (!subcategory) return NextResponse.json({ category: null, definitions: [] })
    resolvedSubcategory = subcategory

    const { data: parentCategory, error: parentError } = await supabase
      .from("categories")
      .select("id,name,slug")
      .eq("id", subcategory.parent_category_id)
      .single()

    if (parentError || !parentCategory) {
      console.error("[search filters] Failed to resolve parent category", parentError)
      return NextResponse.json({ error: "Unable to load filters" }, { status: 500 })
    }
    resolvedCategory = parentCategory
  }

  const [categorySupply, subcategorySupply, productDefinitions] = await Promise.all([
    supabase
      .from("supply_attribute_definitions")
      .select("key,label,value_type,options,unit,sort_order")
      .eq("category_id", resolvedCategory.id)
      .is("subcategory_id", null)
      .eq("active", true)
      .eq("filterable", true)
      .order("sort_order"),
    resolvedSubcategory
      ? supabase
          .from("supply_attribute_definitions")
          .select("key,label,value_type,options,unit,sort_order")
          .eq("subcategory_id", resolvedSubcategory.id)
          .eq("active", true)
          .eq("filterable", true)
          .order("sort_order")
      : Promise.resolve({ data: [] as RawDefinition[], error: null }),
    supabase
      .from("product_attribute_definitions")
      .select("key,label,value_type,options,unit,sort_order")
      .eq("category_id", resolvedCategory.id)
      .eq("active", true)
      .eq("filterable", true)
      .order("sort_order"),
  ])

  const firstError = categorySupply.error || subcategorySupply.error || productDefinitions.error
  if (firstError) {
    console.error("[search filters] Failed to load definitions", firstError)
    return NextResponse.json({ error: "Unable to load filters" }, { status: 500 })
  }

  const supplyByKey = new Map<string, FilterDefinition>()
  for (const definition of (categorySupply.data || []) as RawDefinition[]) {
    supplyByKey.set(definition.key, mapDefinition("supply", definition))
  }
  for (const definition of (subcategorySupply.data || []) as RawDefinition[]) {
    supplyByKey.set(definition.key, mapDefinition("supply", definition))
  }

  const definitions = [
    ...supplyByKey.values(),
    ...((productDefinitions.data || []) as RawDefinition[]).map((definition) => mapDefinition("product", definition)),
  ].sort((a, b) => a.scope.localeCompare(b.scope) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl"))

  const response = NextResponse.json({
    category: {
      slug,
      name: resolvedSubcategory?.name || resolvedCategory.name,
      kind: resolvedSubcategory ? "subcategory" : "category",
      parentSlug: resolvedSubcategory ? resolvedCategory.slug : null,
    },
    definitions,
  })
  response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900")
  return response
}
