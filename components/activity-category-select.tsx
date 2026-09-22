"use client"

import { useMemo, useState } from "react"

type Category = { id: string; name: string; slug: string }
type Subcategory = { id: string; parentCategoryId: string; name: string; slug?: string }

interface Props {
  categories: Category[]
  subcategories: Subcategory[]
  categoryValue?: string
  subcategoryValue?: string
  onCategoryChange?: (id: string) => void
  onSubcategoryChange?: (id: string) => void
  categoryName?: string
  subcategoryName?: string
  required?: boolean
}

export function ActivityCategorySelect({
  categories,
  subcategories,
  categoryValue,
  subcategoryValue,
  onCategoryChange,
  onSubcategoryChange,
  categoryName = "categoryId",
  subcategoryName = "subcategoryId",
  required = false,
}: Props) {
  const [localCategory, setLocalCategory] = useState("")
  const [localSubcategory, setLocalSubcategory] = useState("")
  const selectedCategory = categoryValue ?? localCategory
  const selectedSubcategory = subcategoryValue ?? localSubcategory

  const availableSubcategories = useMemo(
    () => subcategories.filter((subcategory) => subcategory.parentCategoryId === selectedCategory),
    [selectedCategory, subcategories],
  )

  const chooseCategory = (id: string) => {
    setLocalCategory(id)
    setLocalSubcategory("")
    onCategoryChange?.(id)
    onSubcategoryChange?.("")
  }

  const chooseSubcategory = (id: string) => {
    setLocalSubcategory(id)
    onSubcategoryChange?.(id)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm">
        <span className="font-medium">Kategoria główna</span>
        <select
          className="h-11 w-full rounded-md border bg-background px-3"
          name={categoryName}
          value={selectedCategory}
          required={required}
          onChange={(event) => chooseCategory(event.target.value)}
        >
          <option value="">Wybierz kategorię</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <span className="block text-xs text-muted-foreground">Grupa, np. Adrenalina lub Dzieci i rodzina.</span>
      </label>

      <label className="space-y-2 text-sm">
        <span className="font-medium">Rodzaj atrakcji</span>
        <select
          className="h-11 w-full rounded-md border bg-background px-3"
          name={subcategoryName}
          value={selectedSubcategory}
          required={required}
          disabled={!selectedCategory || availableSubcategories.length === 0}
          onChange={(event) => chooseSubcategory(event.target.value)}
        >
          <option value="">Wybierz rodzaj atrakcji</option>
          {availableSubcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
          ))}
        </select>
        <span className="block text-xs text-muted-foreground">Konkretna aktywność, np. Paintball albo Gokarty.</span>
      </label>
    </div>
  )
}
