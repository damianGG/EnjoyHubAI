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

export function CategoryBar({ 
  selectedCategory, 
  onCategorySelect, 
  onFiltersClick, 
  activeFiltersCount, 
  useNavigation = false,
  compact = false
}: CategoryBarProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [localSelectedCategory, setLocalSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)

  useEffect(() => {
    const loadCategoriesWithSubcategories = async () => {
      const s = createClient()
      
      // Load categories
      const { data: categoriesData, error: categoriesError } = await s
        .from("categories")
        .select("id,name,slug,icon,description,image_url,image_public_id")
        .order("name")
      
      if (categoriesError || !categoriesData) {
        setLoading(false)
        return
      }
      
      // Load all subcategories
      const { data: subcategoriesData, error: subcategoriesError } = await s
        .from("subcategories")
        .select("id,parent_category_id,name,slug,icon,description,image_url,image_public_id")
        .order("name")
      
      if (!subcategoriesError && subcategoriesData) {
        // Group subcategories by parent category
        const categoriesWithSubs = categoriesData.map((cat) => ({
          ...cat,
          subcategories: subcategoriesData.filter(
            (sub) => sub.parent_category_id === cat.id
          ),
        }))
        setCategories(categoriesWithSubs)
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
    // Pass subcategory to parent but keep the category bar open
    onCategorySelect?.(subcategorySlug)
  }

  const handleCloseSubcategories = () => {
    setLocalSelectedCategory(null)
    setSelectedSubcategory(null)
    onCategorySelect?.(null)
  }

  if (loading) {
    return (
      <div className="flex space-x-3 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center space-y-1">
            <div className="w-12 h-12 bg-muted rounded-lg animate-pulse" />
            <div className="w-16 h-3 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
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
    </>
  )
}
