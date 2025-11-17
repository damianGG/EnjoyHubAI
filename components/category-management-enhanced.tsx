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
        toast.error("Failed to load categories")
      }
    } catch (error) {
      toast.error("Error loading categories")
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
        toast.error(error.error || "Failed to upload image")
        return null
      }
    } catch (error) {
      toast.error("Error uploading image")
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
        toast.success("Image uploaded successfully")
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
        toast.success("Image uploaded successfully")
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
      toast.error("Name, slug, and icon are required")
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
        toast.success(editingCategory ? "Category updated" : "Category created")
        handleCloseCategoryDialog()
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to save category")
      }
    } catch (error) {
      toast.error("Error saving category")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSubcategory = async () => {
    if (!subcategoryFormData.parent_category_id || !subcategoryFormData.name || !subcategoryFormData.slug) {
      toast.error("Parent category, name, and slug are required")
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
        toast.success(editingSubcategory ? "Subcategory updated" : "Subcategory created")
        handleCloseSubcategoryDialog()
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to save subcategory")
      }
    } catch (error) {
      toast.error("Error saving subcategory")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category? This will also delete all subcategories and associated fields.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/categories?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Category deleted")
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to delete category")
      }
    } catch (error) {
      toast.error("Error deleting category")
    }
  }

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subcategory?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/subcategories?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Subcategory deleted")
        loadCategoriesWithSubcategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to delete subcategory")
      }
    } catch (error) {
      toast.error("Error deleting subcategory")
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
          <h2 className="text-2xl font-bold">Categories & Subcategories</h2>
          <p className="text-muted-foreground">Manage entertainment categories and their subcategories</p>
        </div>
        <Button onClick={() => handleOpenCategoryDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
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
                      <h3 className="text-sm font-semibold">Subcategories</h3>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleOpenSubcategoryDialog(category.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Subcategory
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
                        No subcategories yet. Click "Add Subcategory" to create one.
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
            <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update category details" : "Add a new entertainment category"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                placeholder="e.g., Go-Karts"
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
              <Label htmlFor="category-icon">Icon (Emoji)</Label>
              <Input
                id="category-icon"
                value={categoryFormData.icon}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                placeholder="🏎️"
              />
            </div>

            <div>
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                placeholder="Enter category description"
              />
            </div>

            <div>
              <Label>Category Image</Label>
              <div className="mt-2">
                {categoryFormData.image_url ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                    <Image
                      src={categoryFormData.image_url}
                      alt="Category preview"
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
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Image
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF, WebP (max 5MB)</p>
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
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={saving || uploading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubcategoryDialogOpen} onOpenChange={handleCloseSubcategoryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? "Edit Subcategory" : "Create Subcategory"}</DialogTitle>
            <DialogDescription>
              {editingSubcategory ? "Update subcategory details" : "Add a new subcategory"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="subcategory-name">Name</Label>
              <Input
                id="subcategory-name"
                value={subcategoryFormData.name}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, name: e.target.value })}
                placeholder="e.g., Indoor Karting"
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
              <Label htmlFor="subcategory-icon">Icon (Emoji) - Optional</Label>
              <Input
                id="subcategory-icon"
                value={subcategoryFormData.icon}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, icon: e.target.value })}
                placeholder="🏁"
              />
            </div>

            <div>
              <Label htmlFor="subcategory-description">Description</Label>
              <Textarea
                id="subcategory-description"
                value={subcategoryFormData.description}
                onChange={(e) => setSubcategoryFormData({ ...subcategoryFormData, description: e.target.value })}
                placeholder="Enter subcategory description"
              />
            </div>

            <div>
              <Label>Subcategory Image</Label>
              <div className="mt-2">
                {subcategoryFormData.image_url ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                    <Image
                      src={subcategoryFormData.image_url}
                      alt="Subcategory preview"
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
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Image
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF, WebP (max 5MB)</p>
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
              Cancel
            </Button>
            <Button onClick={handleSaveSubcategory} disabled={saving || uploading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSubcategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
