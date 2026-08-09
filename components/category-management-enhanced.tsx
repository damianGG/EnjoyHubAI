"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Loader2, Upload, X, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import type { Category, Subcategory } from "@/lib/types/dynamic-fields"
import Image from "next/image"

interface CategoryWithSubcategories extends Category {
  subcategories?: Subcategory[]
}

export default function CategoryManagementEnhanced() {
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([])
  const [loading, setLoading] = useState(true)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [selectedParentCategory, setSelectedParentCategory] = useState<string | null>(null)
  
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    slug: "",
    icon: "",
    description: "",
    image_url: "",
    image_public_id: "",
  })
  
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    parent_category_id: "",
    name: "",
    slug: "",
    icon: "",
    description: "",
    image_url: "",
    image_public_id: "",
  })
  
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const categoryImageInputRef = useRef<HTMLInputElement>(null)
  const subcategoryImageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCategoriesWithSubcategories()
  }, [])

  const loadCategoriesWithSubcategories = async () => {
    try {
      const [categoriesResponse, subcategoriesResponse] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch("/api/admin/subcategories"),
      ])

      if (categoriesResponse.ok && subcategoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        const subcategoriesData = await subcategoriesResponse.json()

        // Group subcategories by parent category
        const categoriesWithSubs = categoriesData.map((cat: Category) => ({
          ...cat,
          subcategories: subcategoriesData.filter(
            (sub: Subcategory) => sub.parent_category_id === cat.id
          ),
        }))

        setCategories(categoriesWithSubs)
      } else {
        toast.error("Nie udało się załadować kategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas ładowania kategorii")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setCategoryFormData({
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description || "",
        image_url: category.image_url || "",
        image_public_id: category.image_public_id || "",
      })
    } else {
      setEditingCategory(null)
      setCategoryFormData({
        name: "",
        slug: "",
        icon: "",
        description: "",
        image_url: "",
        image_public_id: "",
      })
    }
    setIsCategoryDialogOpen(true)
  }

  const handleOpenSubcategoryDialog = (parentCategoryId: string, subcategory?: Subcategory) => {
    setSelectedParentCategory(parentCategoryId)
    
    if (subcategory) {
      setEditingSubcategory(subcategory)
      setSubcategoryFormData({
        parent_category_id: subcategory.parent_category_id,
        name: subcategory.name,
        slug: subcategory.slug,
        icon: subcategory.icon || "",
        description: subcategory.description || "",
        image_url: subcategory.image_url || "",
        image_public_id: subcategory.image_public_id || "",
      })
    } else {
      setEditingSubcategory(null)
      setSubcategoryFormData({
        parent_category_id: parentCategoryId,
        name: "",
        slug: "",
        icon: "",
        description: "",
        image_url: "",
        image_public_id: "",
      })
    }
    setIsSubcategoryDialogOpen(true)
  }

  const handleCloseCategoryDialog = () => {
    setIsCategoryDialogOpen(false)
    setEditingCategory(null)
    setCategoryFormData({
      name: "",
      slug: "",
      icon: "",
      description: "",
      image_url: "",
      image_public_id: "",
    })
  }

  const handleCloseSubcategoryDialog = () => {
    setIsSubcategoryDialogOpen(false)
    setEditingSubcategory(null)
    setSelectedParentCategory(null)
    setSubcategoryFormData({
      parent_category_id: "",
      name: "",
      slug: "",
      icon: "",
      description: "",
      image_url: "",
      image_public_id: "",
    })
  }

  const handleImageUpload = async (file: File, categoryType: "category" | "subcategory") => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("image", file)
      formData.append("categoryType", categoryType)

      const response = await fetch("/api/upload-category-image", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        return {
          image_url: data.secure_url,
          image_public_id: data.public_id,
        }
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się przesłać obrazu")
        return null
      }
    } catch (error) {
      toast.error("Błąd podczas przesyłania obrazu")
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleCategoryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const result = await handleImageUpload(file, "category")
      if (result) {
        setCategoryFormData({
          ...categoryFormData,
          image_url: result.image_url,
          image_public_id: result.image_public_id,
        })
        toast.success("Obraz przesłany pomyślnie")
      }
    }
  }

  const handleSubcategoryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const result = await handleImageUpload(file, "subcategory")
      if (result) {
        setSubcategoryFormData({
          ...subcategoryFormData,
          image_url: result.image_url,
          image_public_id: result.image_public_id,
        })
        toast.success("Obraz przesłany pomyślnie")
      }
    }
  }

  const handleRemoveCategoryImage = () => {
    setCategoryFormData({
      ...categoryFormData,
      image_url: "",
      image_public_id: "",
    })
  }

  const handleRemoveSubcategoryImage = () => {
    setSubcategoryFormData({
      ...subcategoryFormData,
      image_url: "",
      image_public_id: "",
    })
  }

  const handleSaveCategory = async () => {
    if (!categoryFormData.name || !categoryFormData.slug || !categoryFormData.icon) {
      toast.error("Nazwa, slug i ikona są wymagane")
      return
    }

    setSaving(true)

    try {
      const url = "/api/admin/categories"
      const method = editingCategory ? "PATCH" : "POST"
      const body = editingCategory ? { id: editingCategory.id, ...categoryFormData } : categoryFormData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast.success(editingCategory ? "Kategoria zaktualizowana" : "Kategoria utworzona")
        handleCloseCategoryDialog()
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się zapisać kategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas zapisywania kategorii")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSubcategory = async () => {
    if (!subcategoryFormData.parent_category_id || !subcategoryFormData.name || !subcategoryFormData.slug) {
      toast.error("Kategoria nadrzędna, nazwa i slug są wymagane")
      return
    }

    setSaving(true)

    try {
      const url = "/api/admin/subcategories"
      const method = editingSubcategory ? "PATCH" : "POST"
      const body = editingSubcategory ? { id: editingSubcategory.id, ...subcategoryFormData } : subcategoryFormData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast.success(editingSubcategory ? "Podkategoria zaktualizowana" : "Podkategoria utworzona")
        handleCloseSubcategoryDialog()
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się zapisać podkategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas zapisywania podkategorii")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię? Spowoduje to również usunięcie wszystkich podkategorii i powiązanych pól.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/categories?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Kategoria usunięta")
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się usunąć kategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas usuwania kategorii")
    }
  }

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę podkategorię?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/subcategories?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Podkategoria usunięta")
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się usunąć podkategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas usuwania podkategorii")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Kategorie i podkategorie</h2>
          <p className="text-muted-foreground">Zarządzaj kategoriami rozrywki i ich podkategoriami</p>
        </div>
        <Button onClick={() => handleOpenCategoryDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj kategorię
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-4">
        {categories.map((category) => (
          <AccordionItem key={category.id} value={category.id} className="border rounded-lg">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <AccordionTrigger className="flex-1 hover:no-underline">
                    <div className="flex items-center space-x-3">
                      {category.image_url ? (
                        <div className="relative w-12 h-12 rounded-md overflow-hidden">
                          <Image
                            src={category.image_url}
                            alt={category.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <span className="text-3xl">{category.icon}</span>
                      )}
                      <div className="text-left">
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <CardDescription className="text-sm">{category.slug}</CardDescription>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <div className="flex space-x-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenCategoryDialog(category)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {category.description && (
                  <CardDescription className="mt-2">{category.description}</CardDescription>
                )}
              </CardHeader>
              <AccordionContent>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-semibold">Podkategorie</h3>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleOpenSubcategoryDialog(category.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Dodaj podkategorię
                      </Button>
                    </div>
                    
                    {category.subcategories && category.subcategories.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {category.subcategories.map((subcategory) => (
                          <Card key={subcategory.id} className="bg-muted/50">
                            <CardHeader className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 flex-1">
                                  {subcategory.image_url ? (
                                    <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                                      <Image
                                        src={subcategory.image_url}
                                        alt={subcategory.name}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  ) : subcategory.icon ? (
                                    <span className="text-xl flex-shrink-0">{subcategory.icon}</span>
                                  ) : null}
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{subcategory.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{subcategory.slug}</p>
                                  </div>
                                </div>
                                <div className="flex space-x-1 ml-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleOpenSubcategoryDialog(category.id, subcategory)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleDeleteSubcategory(subcategory.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {subcategory.description && (
                                <p className="text-xs text-muted-foreground mt-2">{subcategory.description}</p>
                              )}
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Brak podkategorii. Kliknij „Dodaj podkategorię", aby utworzyć.
                      </p>
                    )}
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={handleCloseCategoryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edytuj kategorię" : "Utwórz kategorię"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Zaktualizuj dane kategorii" : "Dodaj nową kategorię rozrywki"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Nazwa</Label>
              <Input
                id="category-name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                placeholder="np. Gokarty"
              />
            </div>

            <div>
              <Label htmlFor="category-slug">Slug</Label>
              <Input
                id="category-slug"
                value={categoryFormData.slug}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, slug: e.target.value })}
                placeholder="e.g., go-karts"
              />
            </div>

            <div>
              <Label htmlFor="category-icon">Ikona (emoji)</Label>
              <Input
                id="category-icon"
                value={categoryFormData.icon}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                placeholder="🏎️"
              />
            </div>

            <div>
              <Label htmlFor="category-description">Opis</Label>
              <Textarea
                id="category-description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                placeholder="Wpisz opis kategorii"
              />
            </div>

            <div>
              <Label>Obraz kategorii</Label>
              <div className="mt-2">
                {categoryFormData.image_url ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                    <Image
                      src={categoryFormData.image_url}
                      alt="Podgląd kategorii"
                      fill
                      className="object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveCategoryImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary/50 transition-colors">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => categoryImageInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Przesyłanie...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Prześlij obraz
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF, WebP (maks. 5MB)</p>
                    <input
                      ref={categoryImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCategoryImageChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCategoryDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSaveCategory} disabled={saving || uploading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCategory ? "Zaktualizuj" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubcategoryDialogOpen} onOpenChange={handleCloseSubcategoryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? "Edytuj podkategorię" : "Utwórz podkategorię"}</DialogTitle>
            <DialogDescription>
              {editingSubcategory ? "Zaktualizuj dane podkategorii" : "Dodaj nową podkategorię"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="subcategory-name">Nazwa</Label>
              <Input
                id="subcategory-name"
                value={subcategoryFormData.name}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, name: e.target.value })}
                placeholder="np. Karting kryty"
              />
            </div>

            <div>
              <Label htmlFor="subcategory-slug">Slug</Label>
              <Input
                id="subcategory-slug"
                value={subcategoryFormData.slug}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, slug: e.target.value })}
                placeholder="e.g., indoor-karting"
              />
            </div>

            <div>
              <Label htmlFor="subcategory-icon">Ikona (emoji) - opcjonalnie</Label>
              <Input
                id="subcategory-icon"
                value={subcategoryFormData.icon}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, icon: e.target.value })}
                placeholder="🏁"
              />
            </div>

            <div>
              <Label htmlFor="subcategory-description">Opis</Label>
              <Textarea
                id="subcategory-description"
                value={subcategoryFormData.description}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, description: e.target.value })}
                placeholder="Wpisz opis podkategorii"
              />
            </div>

            <div>
              <Label>Obraz podkategorii</Label>
              <div className="mt-2">
                {subcategoryFormData.image_url ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                    <Image
                      src={subcategoryFormData.image_url}
                      alt="Podgląd podkategorii"
                      fill
                      className="object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveSubcategoryImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary/50 transition-colors">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => subcategoryImageInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Przesyłanie...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Prześlij obraz
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF, WebP (maks. 5MB)</p>
                    <input
                      ref={subcategoryImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleSubcategoryImageChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseSubcategoryDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSaveSubcategory} disabled={saving || uploading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSubcategory ? "Zaktualizuj" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
