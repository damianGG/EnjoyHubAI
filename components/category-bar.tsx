"use client"

import { CATEGORY_GROUPS } from "@/lib/category-groups"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ScrollableCategoryNav, type Category } from "@/components/scrollable-category-nav"
import { ScrollableSubcategoryNav } from "@/components/scrollable-subcategory-nav"

interface CategoryBarProps {
  selectedCategory?: string
  onCategorySelect?: (categorySlug: string | null) => void
  onFiltersClick?: () => void
  activeFiltersCount?: number
  useNavigation?: boolean
  compact?: boolean
}

const FALLBACK_CATEGORIES: Category[] = [
  { id: "paintball", name: "Paintball", slug: "paintball", icon: "🎯", description: "Paintball i gry zespołowe" },
  { id: "gokarty", name: "Gokarty", slug: "gokarty", icon: "🏎️", description: "Tory kartingowe" },
  { id: "trampoliny", name: "Park trampolin", slug: "park-trampolin", icon: "🤸", description: "Parki trampolin" },
  { id: "place-zabaw", name: "Place zabaw", slug: "plac-zabaw", icon: "🛝", description: "Sale i place zabaw" },
  { id: "park-linowy", name: "Park linowy", slug: "park-linowy", icon: "🧗", description: "Parki linowe i przygoda" },
  { id: "escape-room", name: "Escape room", slug: "escape-room", icon: "🗝️", description: "Pokoje zagadek" },
]

export function CategoryBar({
  selectedCategory,
  onCategorySelect,
  useNavigation = false,
  compact = false,
}: CategoryBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearchString = searchParams.toString()
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [localSelectedCategory, setLocalSelectedCategory] = useState<string | null>(selectedCategory ?? null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)

  useEffect(() => {
    const loadCategoriesWithSubcategories = async () => {
      const s = createClient()

      const { data: categoriesData, error: categoriesError } = await s
        .from("categories")
        .select("id,name,slug,icon,description,image_url,image_public_id")
        .order("name")

      if (categoriesError || !categoriesData?.length) {
        setCategories(FALLBACK_CATEGORIES)
        setLoading(false)
        return
      }

      const typedCategories = categoriesData as Category[]
      const { data: subcategoriesData, error: subcategoriesError } = await s
        .from("subcategories")
        .select("id,parent_category_id,name,slug,icon,description,image_url,image_public_id")
        .order("name")

      if (!subcategoriesError && subcategoriesData) {
        const typedSubcategories = subcategoriesData as NonNullable<Category["subcategories"]>
        setCategories(typedCategories.map((cat) => ({
          ...cat,
          subcategories: typedSubcategories.filter((sub) => sub.parent_category_id === cat.id),
        })))
      } else {
        setCategories(typedCategories)
      }

      setLoading(false)
    }

    void loadCategoriesWithSubcategories()
  }, [])

  const groupedCategories: Category[] = CATEGORY_GROUPS.map(group => ({
    id: group.slug, slug: group.slug, name: group.name, icon: group.icon, description: "",
    subcategories: categories.filter(category => (group.activities as readonly string[]).includes(category.slug))
      .map(category => ({ ...category, parent_category_id: group.slug })),
  })).filter(group => group.subcategories.length > 0)
  const known = new Set<string>(CATEGORY_GROUPS.flatMap(group => [...group.activities]))
  const other = categories.filter(category => !known.has(category.slug))
  if (other.length) groupedCategories.push({ id: "inne", slug: "inne", name: "Inne atrakcje", icon: "✨", description: "", subcategories: other.map(category => ({ ...category, parent_category_id: "inne" })) })

  const activeSlugs = (selectedCategory ?? searchParams.get("categories") ?? "").split(",").filter(Boolean)
  const activeGroup = groupedCategories.find(group => group.subcategories?.some(item => activeSlugs.includes(item.slug)))
  const selectedCategoryData = activeGroup ?? (!useNavigation ? groupedCategories.find(group => group.slug === localSelectedCategory) : undefined)

  function navigate(slugs: string | null) {
    onCategorySelect?.(slugs)
    if (useNavigation) {
      const params = new URLSearchParams(urlSearchString)
      if (slugs) params.set("categories", slugs)
      else params.delete("categories")
      params.delete("page")
      params.delete("attrs")
      router.push(`/attractions${params.size ? `?${params}` : ""}`)
    }
  }
  const handleCategorySelect = (slug: string | null) => {
    setLocalSelectedCategory(slug)
    setSelectedSubcategory(null)
    const group = groupedCategories.find(item => item.slug === slug)
    navigate(group?.subcategories?.map(item => item.slug).join(",") || null)
  }
  const handleSubcategorySelect = (slug: string | null) => {
    setSelectedSubcategory(slug)
    navigate(slug || selectedCategoryData?.subcategories?.map(item => item.slug).join(",") || null)
  }
  const handleCloseSubcategories = () => handleCategorySelect(null)

  return (
    <>
      <ScrollableCategoryNav
        categories={groupedCategories}
        selectedCategory={selectedCategoryData?.slug ?? null}
        onCategorySelect={handleCategorySelect}
        useNavigation={false}
        compact={compact}
      />

      {selectedCategoryData?.subcategories && selectedCategoryData.subcategories.length > 0 && (
        <ScrollableSubcategoryNav
          subcategories={selectedCategoryData.subcategories}
          selectedSubcategory={activeSlugs.length === 1 ? activeSlugs[0] : selectedSubcategory}
          onSubcategorySelect={handleSubcategorySelect}
          onClose={handleCloseSubcategories}
          parentCategoryName={selectedCategoryData.name}
          compact={compact}
        />
      )}

      {loading && <span className="sr-only">Ładowanie kategorii</span>}
    </>
  )
}
