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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Edit, Trash2, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import type { Category, CategoryField, FieldType } from "@/lib/types/dynamic-fields"
import { isRequiredCategoryField } from "@/lib/validation/category-fields"

export default function FieldManagementClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
  const [fields, setFields] = useState<CategoryField[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<CategoryField | null>(null)
  const [formData, setFormData] = useState({
    field_name: "",
    field_label: "",
    field_type: "text" as FieldType,
    field_order: 0,
    is_required: false,
    placeholder: "",
    help_text: "",
    options: [] as string[],
    validation_rules: {
      min: undefined as number | undefined,
      max: undefined as number | undefined,
      minLength: undefined as number | undefined,
      maxLength: undefined as number | undefined,
    },
  })
  const [saving, setSaving] = useState(false)
  const [optionsInput, setOptionsInput] = useState("")

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      loadFields()
    }
  }, [selectedCategoryId])

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/admin/categories")
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
        if (data.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(data[0].id)
        }
      } else {
        toast.error("Nie udało się załadować kategorii")
      }
    } catch (error) {
      toast.error("Błąd podczas ładowania kategorii")
    } finally {
      setLoading(false)
    }
  }

  const loadFields = async () => {
    try {
      const response = await fetch(`/api/admin/fields?category_id=${selectedCategoryId}`)
      if (response.ok) {
        const data = await response.json()
        setFields(data)
      } else {
        toast.error("Nie udało się załadować pól")
      }
    } catch (error) {
      toast.error("Błąd podczas ładowania pól")
    }
  }

  const handleOpenDialog = (field?: CategoryField) => {
    if (field) {
      setEditingField(field)
      setFormData({
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type,
        field_order: field.field_order,
        is_required: field.is_required,
        placeholder: field.placeholder || "",
        help_text: field.help_text || "",
        options: field.options || [],
        validation_rules: field.validation_rules || {},
      })
      setOptionsInput((field.options || []).join("\n"))
    } else {
      setEditingField(null)
      setFormData({
        field_name: "",
        field_label: "",
        field_type: "text",
        field_order: fields.length,
        is_required: false,
        placeholder: "",
        help_text: "",
        options: [],
        validation_rules: {},
      })
      setOptionsInput("")
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingField(null)
    setOptionsInput("")
  }

  const handleSave = async () => {
    if (!formData.field_name || !formData.field_label) {
      toast.error("Nazwa pola i etykieta są wymagane")
      return
    }

    if (!selectedCategoryId) {
      toast.error("Wybierz kategorię")
      return
    }

    setSaving(true)

    try {
      const url = "/api/admin/fields"
      const method = editingField ? "PATCH" : "POST"

      // Parse options from textarea
      const options = formData.field_type === "select" ? optionsInput.split("\n").filter((o) => o.trim()) : []

      const body = editingField
        ? { id: editingField.id, ...formData, options }
        : { ...formData, category_id: selectedCategoryId, options }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast.success(editingField ? "Pole zaktualizowane" : "Pole utworzone")
        handleCloseDialog()
        loadFields()
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się zapisać pola")
      }
    } catch (error) {
      toast.error("Błąd podczas zapisywania pola")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to pole?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/fields?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Pole usunięte")
        loadFields()
      } else {
        const error = await response.json()
        toast.error(error.error || "Nie udało się usunąć pola")
      }
    } catch (error) {
      toast.error("Błąd podczas usuwania pola")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nie znaleziono kategorii. Najpierw utwórz kategorię.</p>
      </div>
    )
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Zarządzanie polami</h2>
          <p className="text-muted-foreground">Konfiguruj dynamiczne pola dla kategorii</p>
        </div>
      </div>

      {/* Category Selector */}
      <div className="mb-6">
        <Label>Wybierz kategorię</Label>
        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.icon} {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fields List */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Pola dla {selectedCategory?.icon} {selectedCategory?.name}
          </h3>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj pole
          </Button>
        </div>

        {fields.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Nie skonfigurowano jeszcze pól dla tej kategorii.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => {
              const isRequired = isRequiredCategoryField(field.field_name)
              return (
                <Card key={field.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{field.field_label}</p>
                        {field.is_required && <span className="text-xs text-red-500">*Wymagane</span>}
                        {isRequired && (
                          <span className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            <Lock className="h-3 w-3 mr-1" />
                            Wymagane przez system
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>Typ: {field.field_type}</span>
                        <span>•</span>
                        <span>Nazwa: {field.field_name}</span>
                        <span>•</span>
                        <span>Kolejność: {field.field_order}</span>
                      </div>
                      {field.help_text && <p className="text-xs text-muted-foreground mt-1">{field.help_text}</p>}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(field)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(field.id)}
                        disabled={isRequired}
                        title={isRequired ? "Nie można usunąć wymaganego pola systemowego" : "Usuń pole"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? "Edytuj pole" : "Utwórz pole"}</DialogTitle>
            <DialogDescription>
              {editingField ? "Zaktualizuj konfigurację pola" : "Dodaj nowe pole dynamiczne"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="field_name">Nazwa pola (wewnętrzna)</Label>
                <Input
                  id="field_name"
                  value={formData.field_name}
                  onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                  placeholder="np. minimum_age"
                />
              </div>

              <div>
                <Label htmlFor="field_label">Etykieta pola (wyświetlana)</Label>
                <Input
                  id="field_label"
                  value={formData.field_label}
                  onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                  placeholder="np. Minimalny wiek"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="field_type">Typ pola</Label>
                <Select
                  value={formData.field_type}
                  onValueChange={(value: FieldType) => setFormData({ ...formData, field_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Tekst</SelectItem>
                    <SelectItem value="textarea">Pole tekstowe</SelectItem>
                    <SelectItem value="number">Liczba</SelectItem>
                    <SelectItem value="select">Lista wyboru</SelectItem>
                    <SelectItem value="checkbox">Pole wyboru</SelectItem>
                    <SelectItem value="file">Plik</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="field_order">Kolejność wyświetlania</Label>
                <Input
                  id="field_order"
                  type="number"
                  value={formData.field_order}
                  onChange={(e) => setFormData({ ...formData, field_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_required"
                checked={formData.is_required}
                onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked as boolean })}
              />
              <Label htmlFor="is_required">Pole wymagane</Label>
            </div>

            <div>
              <Label htmlFor="placeholder">Tekst zastępczy</Label>
              <Input
                id="placeholder"
                value={formData.placeholder}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                placeholder="Wpisz tekst zastępczy"
              />
            </div>

            <div>
              <Label htmlFor="help_text">Tekst pomocy</Label>
              <Textarea
                id="help_text"
                value={formData.help_text}
                onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
                placeholder="Dodatkowe informacje dla użytkownika"
              />
            </div>

            {formData.field_type === "select" && (
              <div>
                <Label htmlFor="options">Opcje (jedna na linię)</Label>
                <Textarea
                  id="options"
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  placeholder="Opcja 1&#10;Opcja 2&#10;Opcja 3"
                  rows={5}
                />
              </div>
            )}

            {(formData.field_type === "number" || formData.field_type === "text") && (
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Reguły walidacji</h4>

                {formData.field_type === "number" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min">Wartość minimalna</Label>
                      <Input
                        id="min"
                        type="number"
                        value={formData.validation_rules.min || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validation_rules: {
                              ...formData.validation_rules,
                              min: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="max">Wartość maksymalna</Label>
                      <Input
                        id="max"
                        type="number"
                        value={formData.validation_rules.max || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validation_rules: {
                              ...formData.validation_rules,
                              max: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {formData.field_type === "text" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minLength">Minimalna długość</Label>
                      <Input
                        id="minLength"
                        type="number"
                        value={formData.validation_rules.minLength || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validation_rules: {
                              ...formData.validation_rules,
                              minLength: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxLength">Maksymalna długość</Label>
                      <Input
                        id="maxLength"
                        type="number"
                        value={formData.validation_rules.maxLength || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validation_rules: {
                              ...formData.validation_rules,
                              maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingField ? "Zaktualizuj" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
