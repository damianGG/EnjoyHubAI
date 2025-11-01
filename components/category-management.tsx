"use client"

import { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Category } from "@/lib/types/dynamic-fields"

export default function CategoryManagementClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    icon: "",
    description: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/admin/categories")
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      } else {
        toast.error("Failed to load categories")
      }
    } catch (error) {
      toast.error("Error loading categories")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description || "",
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: "",
        slug: "",
        icon: "",
        description: "",
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingCategory(null)
    setFormData({
      name: "",
      slug: "",
      icon: "",
      description: "",
    })
  }

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.icon) {
      toast.error("Name, slug, and icon are required")
      return
    }

    setSaving(true)

    try {
      const url = "/api/admin/categories"
      const method = editingCategory ? "PATCH" : "POST"
      const body = editingCategory ? { id: editingCategory.id, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast.success(editingCategory ? "Category updated" : "Category created")
        handleCloseDialog()
        loadCategories()
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category? This will also delete all associated fields.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/categories?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Category deleted")
        loadCategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to delete category")
      }
    } catch (error) {
      toast.error("Error deleting category")
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
          <h2 className="text-2xl font-bold">Categories</h2>
          <p className="text-muted-foreground">Manage entertainment categories</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{category.icon}</span>
                  <CardTitle>{category.name}</CardTitle>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(category)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{category.description || "No description"}</CardDescription>
              <p className="text-xs text-muted-foreground mt-2">Slug: {category.slug}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update category details" : "Add a new entertainment category"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Go-Karts"
              />
            </div>

            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g., go-karts"
              />
            </div>

            <div>
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🏎️"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter category description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
