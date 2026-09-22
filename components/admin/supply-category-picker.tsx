"use client"

import { useMemo, useState } from "react"

type Category = { id: string; name: string; slug: string }
type Subcategory = { id: string; name: string; slug?: string; parent_category_id: string }

export function SupplyCategoryPicker({
  categories,
  subcategories,
  categoryId,
  subcategoryId,
}: {
  categories: Category[]
  subcategories: Subcategory[]
  categoryId?: string
  subcategoryId?: string
}) {
  const [category, setCategory] = useState(categoryId ?? "")
  const [activity, setActivity] = useState(subcategoryId ?? "")
  const choices = useMemo(
    () => subcategories.filter((item) => item.parent_category_id === category),
    [category, subcategories],
  )
  const style = "h-10 w-full rounded-md border bg-background px-3 text-sm"

  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-3">
      <label className="space-y-2 text-sm">
        <span className="font-medium">Kategoria główna</span>
        <select
          name="category_id"
          className={style}
          value={category}
          onChange={(event) => {
            setCategory(event.target.value)
            setActivity("")
          }}
        >
          <option value="">Wybierz kategorię</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      <label className="space-y-2 text-sm">
        <span className="font-medium">Rodzaj atrakcji</span>
        <select
          name="subcategory_id"
          className={style}
          value={activity}
          disabled={!category}
          onChange={(event) => setActivity(event.target.value)}
        >
          <option value="">Wybierz aktywność</option>
          {choices.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
