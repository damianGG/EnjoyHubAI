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
        toast.error("Nie udało się załadować kategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas ładowania kategorii")
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
      toast.error("Nazwa, slug i ikona są wymagane")
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
        toast.success(editingCategory ? "Kategoria zaktualizowana" : "Kategoria utworzona")
        handleCloseDialog()
        loadCategories()
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

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię? Spowoduje to również usunięcie wszystkich powiązanych pól.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/categories?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Kategoria usunięta")
        loadCategories()
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się usunąć kategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas usuwania kategorii")
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
          <h2 className="text-2xl font-bold">Kategorie</h2>
          <p className="text-muted-foreground">Zarządzaj kategoriami rozrywki</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj kategorię
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
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(category)} aria-label={`Edytuj kategorię ${category.name}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)} aria-label={`Usuń kategorię ${category.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{category.description || "Brak opisu"}</CardDescription>
              <p className="text-xs text-muted-foreground mt-2">Slug: {category.slug}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edytuj kategorię" : "Utwórz kategorię"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Zaktualizuj dane kategorii" : "Dodaj nową kategorię rozrywki"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nazwa</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="np. Gokarty"
              />
            </div>

            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="np. gokarty"
              />
            </div>

            <div>
              <Label htmlFor="icon">Ikona (emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🏎️"
              />
            </div>

            <div>
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Wpisz opis kategorii"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCategory ? "Zaktualizuj" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
