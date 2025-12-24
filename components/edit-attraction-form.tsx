"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import LocationPicker from "./location-picker"
import DynamicFormFields from "./dynamic-form-fields"
import { ImageUploadSection } from "./forms/ImageUploadSection"
import { AmenitiesSelector } from "./forms/AmenitiesSelector"
import type { Category, CategoryField, Subcategory } from "@/lib/types/dynamic-fields"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface EditAttractionFormProps {
  propertyId: string
  userId: string
}

export default function EditAttractionForm({ propertyId, userId }: EditAttractionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  const [images, setImages] = useState<Array<{ url: string; publicId: string }>>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("")
  const [location, setLocation] = useState<{ lat: number; lng: number }>({ lat: 52.2297, lng: 21.0122 })
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([])
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, any>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [propertyData, setPropertyData] = useState<any>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  // Load property data
  useEffect(() => {
    const loadPropertyData = async () => {
      try {
        const { data, error } = await supabase
          .from("properties")
          .select("*")
          .eq("id", propertyId)
          .eq("host_id", userId)
          .single()

        if (error) {
          console.error("[v0] Error loading property:", error)
          toast.error("Failed to load property data")
          router.push("/host/properties")
          return
        }

        if (!data) {
          toast.error("Property not found")
          router.push("/host/properties")
          return
        }

        setPropertyData(data)
        setSelectedCategory(data.category_id || "")
        // Convert null/empty subcategory to "none" for the Select component
        setSelectedSubcategory(data.subcategory_id || "none")
        setSelectedAmenities(data.amenities || [])
        setLocation({ lat: data.latitude || 52.2297, lng: data.longitude || 21.0122 })
        
        // Convert images array to the format expected by the component
        const imageObjects = (data.images || []).map((url: string) => ({
          url,
          publicId: "", // We don't have publicId for existing images
        }))
        setImages(imageObjects)
      } catch (error) {
        console.error("[v0] Unexpected error loading property:", error)
        toast.error("An unexpected error occurred")
        router.push("/host/properties")
      } finally {
        setInitialLoading(false)
      }
    }

    loadPropertyData()
  }, [propertyId, userId, router])

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name")

      if (error) {
        console.error("[v0] Error loading categories:", error)
        toast.error("Failed to load categories")
      } else {
        setCategories(data || [])
      }
    }

    loadCategories()
  }, [])

  // Load subcategories when category changes
  useEffect(() => {
    const loadSubcategories = async () => {
      if (!selectedCategory) {
        setSubcategories([])
        return
      }

      console.log("[Edit] Loading subcategories for category:", selectedCategory)

      try {
        const response = await fetch(`/api/admin/subcategories?categoryId=${selectedCategory}`)
        if (response.ok) {
          const data = await response.json()
          console.log("[Edit] Loaded subcategories:", data)
          setSubcategories(data || [])
        } else {
          console.error("[Edit] Failed to load subcategories:", response.status)
          setSubcategories([])
        }
      } catch (error) {
        console.error("[Edit] Error loading subcategories:", error)
        setSubcategories([])
      }
    }

    loadSubcategories()
  }, [selectedCategory])

  // Load fields when category changes or property data is loaded
  useEffect(() => {
    const loadCategoryFields = async () => {
      if (!selectedCategory) {
        setCategoryFields([])
        setDynamicFieldValues({})
        return
      }

      try {
        const response = await fetch(`/api/admin/fields?category_id=${selectedCategory}`)
        if (response.ok) {
          const data = await response.json()
          setCategoryFields(data)
          
          // Load existing field values if we have propertyId
          if (propertyId) {
            const valuesResponse = await fetch(`/api/properties/field-values?property_id=${propertyId}`)
            if (valuesResponse.ok) {
              const valuesData = await valuesResponse.json()
              const values: Record<string, any> = {}
              
              valuesData.forEach((fv: any) => {
                values[fv.field_id] = fv.value
                if (fv.file_url) {
                  values[`${fv.field_id}_url`] = fv.file_url
                }
              })
              
              setDynamicFieldValues(values)
            }
          } else {
            setDynamicFieldValues({})
          }
          setFieldErrors({})
        } else {
          toast.error("Failed to load category fields")
        }
      } catch (error) {
        console.error("Error loading category fields:", error)
        toast.error("Error loading category fields")
      }
    }

    loadCategoryFields()
  }, [selectedCategory, propertyId])

  const handleLocationSelect = (lat: number, lng: number) => {
    setLocation({ lat, lng })
  }

  const handleDynamicFieldChange = (fieldId: string, value: any, fileUrl?: string) => {
    setDynamicFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
      ...(fileUrl && { [`${fieldId}_url`]: fileUrl }),
    }))
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  const validateDynamicFields = (): boolean => {
    const errors: Record<string, string> = {}

    categoryFields.forEach((field) => {
      const value = dynamicFieldValues[field.id]

      if (field.is_required && (!value || value === "")) {
        errors[field.id] = `${field.field_label} is required`
      }
    })

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateDynamicFields()) {
      toast.error("Please fill in all required fields")
      return
    }

    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      // Update property
      const { error: propertyError } = await supabase
        .from("properties")
        .update({
          title: formData.get("title") as string,
          description: formData.get("description") as string,
          category_id: selectedCategory,
          // Convert "none" back to null when saving
          subcategory_id: selectedSubcategory === "none" ? null : selectedSubcategory || null,
          address: formData.get("address") as string,
          city: formData.get("city") as string,
          country: formData.get("country") as string,
          latitude: location.lat,
          longitude: location.lng,
          price_per_night: Number.parseFloat(formData.get("price_per_night") as string),
          max_guests: Number.parseInt(formData.get("max_guests") as string),
          amenities: selectedAmenities,
          images: images.map((img) => img.url),
          updated_at: new Date().toISOString(),
        })
        .eq("id", propertyId)
        .eq("host_id", userId)

      if (propertyError) {
        console.error("[v0] Error updating property:", propertyError)
        toast.error(`Error updating property: ${propertyError.message}`)
        return
      }

      // Update dynamic field values
      if (categoryFields.length > 0) {
        const fieldValues = categoryFields.map((field) => ({
          field_id: field.id,
          value: dynamicFieldValues[field.id] || "",
          file_url: dynamicFieldValues[`${field.id}_url`] || "",
        }))

        const response = await fetch("/api/properties/field-values", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: propertyId,
            field_values: fieldValues,
          }),
        })

        if (!response.ok) {
          console.error("[v0] Error updating field values")
          toast.error("Property updated but some field values failed to save")
        }
      }

      toast.success("Property updated successfully!")
      router.push("/host/properties")
    } catch (error) {
      console.error("[v0] Unexpected error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)

    try {
      // Delete all images from Cloudinary
      for (const image of images) {
        if (image.publicId) {
          await fetch("/api/delete-image", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicId: image.publicId }),
          })
        }
      }

      // Delete property
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId)
        .eq("host_id", userId)

      if (error) {
        console.error("[v0] Error deleting property:", error)
        toast.error(`Error deleting property: ${error.message}`)
        return
      }

      toast.success("Property deleted successfully!")
      router.push("/host/properties")
    } catch (error) {
      console.error("[v0] Unexpected error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!propertyData) {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Podstawowe informacje</CardTitle>
          <CardDescription>Opowiedz nam o swoim obiekcie rozrywkowym</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Nazwa obiektu</Label>
            <Input
              id="title"
              name="title"
              placeholder="Centrum paintballowe Adventure Park"
              defaultValue={propertyData.title}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Opisz swój obiekt rozrywkowy, jego atrakcje i co czyni go wyjątkowym..."
              rows={4}
              defaultValue={propertyData.description}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Kategoria</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kategorię obiektu" />
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

          {selectedCategory && (
            <div>
              <Label htmlFor="subcategory">Podkategoria (opcjonalna)</Label>
              {subcategories.length > 0 ? (
                <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz podkategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak podkategorii</SelectItem>
                    {subcategories.map((subcategory) => (
                      <SelectItem key={subcategory.id} value={subcategory.id}>
                        {subcategory.icon} {subcategory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Ta kategoria nie ma podkategorii
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Lokalizacja</CardTitle>
          <CardDescription>Gdzie znajduje się Twój obiekt?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Adres</Label>
            <Input
              id="address"
              name="address"
              placeholder="ul. Główna 123"
              defaultValue={propertyData.address}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Miasto</Label>
              <Input id="city" name="city" placeholder="Warszawa" defaultValue={propertyData.city} required />
            </div>

            <div>
              <Label htmlFor="country">Kraj</Label>
              <Input
                id="country"
                name="country"
                placeholder="Polska"
                defaultValue={propertyData.country}
                required
              />
            </div>
          </div>

          <div>
            <Label>Dokładna lokalizacja</Label>
            <LocationPicker
              onLocationSelect={handleLocationSelect}
              initialLat={location.lat}
              initialLng={location.lng}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Współrzędne: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>Szczegóły obiektu</CardTitle>
          <CardDescription>Określ pojemność i cennik</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max_guests">Maksymalna liczba osób</Label>
              <Input
                id="max_guests"
                name="max_guests"
                type="number"
                min="1"
                defaultValue={propertyData.max_guests}
                required
              />
            </div>

            <div>
              <Label htmlFor="price_per_night">Cena za dzień (zł)</Label>
              <Input
                id="price_per_night"
                name="price_per_night"
                type="number"
                min="1"
                step="0.01"
                placeholder="200.00"
                defaultValue={propertyData.price_per_night}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <AmenitiesSelector
        selectedAmenities={selectedAmenities}
        onAmenitiesChange={setSelectedAmenities}
      />

      {/* Dynamic Fields */}
      {categoryFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dodatkowe informacje</CardTitle>
            <CardDescription>Szczegóły specyficzne dla kategorii</CardDescription>
          </CardHeader>
          <CardContent>
            <DynamicFormFields
              fields={categoryFields}
              values={dynamicFieldValues}
              onChange={handleDynamicFieldChange}
              errors={fieldErrors}
            />
          </CardContent>
        </Card>
      )}

      {/* Images */}
      <ImageUploadSection
        images={images}
        onImagesChange={setImages}
        userId={userId}
      />

      {/* Submit and Delete */}
      <div className="flex justify-between items-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń obiekt
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Czy na pewno chcesz usunąć ten obiekt?</AlertDialogTitle>
              <AlertDialogDescription>
                Ta operacja jest nieodwracalna. Wszystkie dane obiektu, w tym rezerwacje i opinie, zostaną trwale
                usunięte.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Usuwanie...
                  </>
                ) : (
                  "Usuń"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex space-x-4">
          <Button type="button" variant="outline" onClick={() => router.push("/host/properties")}>
            Anuluj
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              "Zapisz zmiany"
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
