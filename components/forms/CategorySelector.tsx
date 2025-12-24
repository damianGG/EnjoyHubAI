"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { Category, Subcategory } from "@/lib/types/dynamic-fields"

interface CategorySelectorProps {
  selectedCategory: string
  selectedSubcategory: string
  onCategoryChange: (categoryId: string) => void
  onSubcategoryChange: (subcategoryId: string) => void
  categories: Category[]
  subcategories: Subcategory[]
  loadSubcategories: (categoryId: string) => Promise<void>
}

export function CategorySelector({
  selectedCategory,
  selectedSubcategory,
  onCategoryChange,
  onSubcategoryChange,
  categories,
  subcategories,
  loadSubcategories,
}: CategorySelectorProps) {
  const handleCategoryChange = async (value: string) => {
    onCategoryChange(value)
    onSubcategoryChange("")
    
    if (value) {
      await loadSubcategories(value)
    }
  }

  const handleSubcategoryChange = (value: string) => {
    // Handle "none" as empty string
    onSubcategoryChange(value === "none" ? "" : value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategoria</CardTitle>
        <CardDescription>
          Wybierz kategorię i podkategorię dla swojej atrakcji
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category">Kategoria *</Label>
          <Select value={selectedCategory} onValueChange={handleCategoryChange} required>
            <SelectTrigger id="category">
              <SelectValue placeholder="Wybierz kategorię" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon && <span className="mr-2">{category.icon}</span>}
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCategory && (
          <div className="space-y-2">
            <Label htmlFor="subcategory">Podkategoria</Label>
            <Select 
              value={selectedSubcategory || "none"} 
              onValueChange={handleSubcategoryChange}
            >
              <SelectTrigger id="subcategory">
                <SelectValue placeholder="Wybierz podkategorię (opcjonalne)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak podkategorii</SelectItem>
                {subcategories.map((subcategory) => (
                  <SelectItem key={subcategory.id} value={subcategory.id}>
                    {subcategory.icon && <span className="mr-2">{subcategory.icon}</span>}
                    {subcategory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
