import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Category, Subcategory, CategoryField } from "@/lib/types/dynamic-fields"

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("")
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      loadSubcategories(selectedCategory)
      loadCategoryFields(selectedCategory)
    } else {
      setSubcategories([])
      setCategoryFields([])
    }
  }, [selectedCategory])

  const loadCategories = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name")

    if (error) {
      console.error("Error loading categories:", error)
      toast.error("Nie udało się załadować kategorii")
    } else {
      setCategories(data || [])
    }
    setLoading(false)
  }

  const loadSubcategories = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/admin/subcategories?categoryId=${categoryId}`)
      if (response.ok) {
        const data = await response.json()
        setSubcategories(data)
      } else {
        toast.error("Nie udało się załadować podkategorii")
      }
    } catch (error) {
      console.error("Error loading subcategories:", error)
      toast.error("Błąd podczas ładowania podkategorii")
    }
  }

  const loadCategoryFields = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/admin/fields?categoryId=${categoryId}`)
      if (response.ok) {
        const data = await response.json()
        setCategoryFields(data)
      } else {
        toast.error("Nie udało się załadować pól kategorii")
      }
    } catch (error) {
      console.error("Error loading category fields:", error)
      toast.error("Błąd podczas ładowania pól kategorii")
    }
  }

  return {
    categories,
    subcategories,
    selectedCategory,
    selectedSubcategory,
    categoryFields,
    loading,
    setSelectedCategory,
    setSelectedSubcategory,
    loadSubcategories,
    setCategories,
    setSubcategories,
    setCategoryFields,
  }
}
