"use client"

import { useState, useEffect } from "react"
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
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [localSelectedCategory, setLocalSelectedCategory] = useState<string | null>(selectedCategory ?? null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)

  useEffect(() => {
    setLocalSelectedCategory(selectedCategory ?? null)
  }, [selectedCategory])

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

      const { data: subcategoriesData, error: subcategoriesError } = await s
        .from("subcategories")
        .select("id,parent_category_id,name,slug,icon,description,image_url,image_public_id")
        .order("name")

      if (!subcategoriesError && subcategoriesData) {
        setCategories(categoriesData.map((cat) => ({
          ...cat,
          subcategories: subcategoriesData.filter((sub) => sub.parent_category_id === cat.id),
        })))
      } else {
        setCategories(categoriesData)
      }

      setLoading(false)
    }

    loadCategoriesWithSubcategories()
  }, [])

  const handleCategorySelect = (categorySlug: string | null) => {
    setLocalSelectedCategory(categorySlug)
    setSelectedSubcategory(null)
    onCategorySelect?.(categorySlug)
  }

  const handleSubcategorySelect = (subcategorySlug: string | null) => {
    setSelectedSubcategory(subcategorySlug)
    onCategorySelect?.(subcategorySlug)
  }

  const handleCloseSubcategories = () => {
    setLocalSelectedCategory(null)
    setSelectedSubcategory(null)
    onCategorySelect?.(null)
  }

  const selectedCategoryData = categories.find((cat) => cat.slug === localSelectedCategory)

  return (
    <>
      <ScrollableCategoryNav
        categories={categories}
        selectedCategory={localSelectedCategory}
        onCategorySelect={handleCategorySelect}
        useNavigation={useNavigation}
        compact={compact}
      />

      {localSelectedCategory && selectedCategoryData?.subcategories && selectedCategoryData.subcategories.length > 0 && (
        <ScrollableSubcategoryNav
          subcategories={selectedCategoryData.subcategories}
          selectedSubcategory={selectedSubcategory}
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
