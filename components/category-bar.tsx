"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { ScrollableCategoryNav, type Category } from "@/components/scrollable-category-nav"
import { ScrollableSubcategoryNav } from "@/components/scrollable-subcategory-nav"
import { buildCategoryCatalog } from "@/lib/categories/catalog"
import { createClient } from "@/lib/supabase/client"

interface CategoryBarProps {
  selectedCategory?: string
  onCategorySelect?: (categorySlug: string | null) => void
  onFiltersClick?: () => void
  activeFiltersCount?: number
  useNavigation?: boolean
  compact?: boolean
}

export function CategoryBar({
  selectedCategory,
  onCategorySelect,
  useNavigation = false,
  compact = false,
}: CategoryBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearchString = searchParams.toString()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [localSelectedCategory, setLocalSelectedCategory] = useState<string | null>(selectedCategory ?? null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)

  useEffect(() => {
    const loadCatalog = async () => {
      const supabase = createClient()
      const [categoriesResult, subcategoriesResult] = await Promise.all([
        supabase
          .from("categories")
          .select("id,name,slug,icon,description,image_url,image_public_id")
          .eq("catalog_visible", true)
          .order("name"),
        supabase
          .from("subcategories")
          .select("id,parent_category_id,name,slug,icon,description,image_url,image_public_id")
          .order("name"),
      ])

      if (categoriesResult.error || subcategoriesResult.error) {
        console.error("[category bar] Failed to load catalog", categoriesResult.error || subcategoriesResult.error)
        setCategories([])
        setLoading(false)
        return
      }

      const catalog = buildCategoryCatalog(
        (categoriesResult.data ?? []).map((category) => ({
          ...category,
          icon: category.icon ?? "✨",
          description: category.description ?? "",
        })),
        (subcategoriesResult.data ?? []).map((subcategory) => ({
          ...subcategory,
          icon: subcategory.icon ?? undefined,
          description: subcategory.description ?? undefined,
          image_url: subcategory.image_url ?? undefined,
          image_public_id: subcategory.image_public_id ?? undefined,
        })),
      )

      setCategories(catalog.map((category) => ({
        ...category,
        icon: category.icon ?? "✨",
        description: category.description ?? "",
        image_url: category.image_url ?? undefined,
        image_public_id: category.image_public_id ?? undefined,
        subcategories: category.subcategories.map((subcategory) => ({
          ...subcategory,
          icon: subcategory.icon ?? undefined,
          description: subcategory.description ?? undefined,
          image_url: subcategory.image_url ?? undefined,
          image_public_id: subcategory.image_public_id ?? undefined,
        })),
      })))
      setLoading(false)
    }

    void loadCatalog()
  }, [])

  const activeSlugs = (selectedCategory ?? searchParams.get("categories") ?? "").split(",").filter(Boolean)
  const activeGroup = categories.find((category) =>
    activeSlugs.includes(category.slug)
    || category.subcategories?.some((subcategory) => activeSlugs.includes(subcategory.slug)),
  )
  const localSelectedGroup = categories.find((category) => category.slug === localSelectedCategory)
  const selectedCategoryData = localSelectedGroup ?? activeGroup

  useEffect(() => {
    if (!useNavigation || !localSelectedCategory) return
    if (activeGroup?.slug === localSelectedCategory) {
      setLocalSelectedCategory(null)
    }
  }, [activeGroup?.slug, localSelectedCategory, useNavigation])

  function navigate(slug: string | null) {
    onCategorySelect?.(slug)
    if (!useNavigation) return

    const params = new URLSearchParams(urlSearchString)
    if (slug) params.set("categories", slug)
    else params.delete("categories")
    params.delete("page")
    params.delete("attrs")
    router.push(`/attractions${params.size ? `?${params}` : ""}`)
  }

  const handleCategorySelect = (slug: string | null) => {
    const hadLocalSelection = Boolean(localSelectedCategory)
    setSelectedSubcategory(null)

    if (!slug) {
      setLocalSelectedCategory(null)
      if (!useNavigation || (!hadLocalSelection && activeGroup)) navigate(null)
      return
    }

    setLocalSelectedCategory(slug)
    if (!useNavigation) navigate(slug)
  }

  const handleSubcategorySelect = (slug: string | null) => {
    setSelectedSubcategory(slug)
    navigate(slug || selectedCategoryData?.slug || null)
  }

  return (
    <>
      <ScrollableCategoryNav
        categories={categories}
        selectedCategory={selectedCategoryData?.slug ?? null}
        onCategorySelect={handleCategorySelect}
        useNavigation={false}
        compact={compact}
        mobileCollapsed={!compact && Boolean(selectedCategoryData)}
      />

      {selectedCategoryData?.subcategories && selectedCategoryData.subcategories.length > 0 && (
        <ScrollableSubcategoryNav
          subcategories={selectedCategoryData.subcategories}
          selectedSubcategory={
            localSelectedCategory
              ? selectedSubcategory
              : activeSlugs.length === 1 && activeSlugs[0] !== selectedCategoryData.slug
                ? activeSlugs[0]
                : selectedSubcategory
          }
          onSubcategorySelect={handleSubcategorySelect}
          onClose={() => handleCategorySelect(null)}
          parentCategoryName={selectedCategoryData.name}
          compact={compact}
        />
      )}

      {loading && <span className="sr-only">Ładowanie kategorii</span>}
    </>
  )
}
