"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, X } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import LocationPicker from "./location-picker"
import DynamicFormFields from "./dynamic-form-fields"
import type { Category, CategoryField } from "@/lib/types/dynamic-fields"
import { toast } from "sonner"

interface AddPropertyFormProps {
  userId: string
}

const AMENITIES = [
  "WiFi",
  "Parking",
  "Klimatyzacja",
  "Ogrzewanie",
  "Toalety",
  "Szatnia",
  "Catering",
  "Nagłośnienie",
  "Oświetlenie",
  "Bezpieczeństwo",
  "Dostęp dla niepełnosprawnych",
  "Miejsce na imprezy",
  "Strefa relaksu",
  "Bar/Restauracja",
  "Miejsce na piknik",
  "Prysznice",
]

export default function AddPropertyForm({ userId }: AddPropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [location, setLocation] = useState<{ lat: number; lng: number }>({ lat: 52.2297, lng: 21.0122 })
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([])
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, any>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadCategories = async () => {
      console.log("[v0] Starting to load categories...")
      const { data, error, status, statusText } = await supabase.from("categories").select("*").order("name")

      console.log("[v0] Supabase response status:", status, statusText)

      if (error) {
        console.error("[v0] Error loading categories:", error)
        console.error("[v0] Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        toast.error("Failed to load categories")
      } else {
        console.log("[v0] Categories loaded successfully:", data)
        console.log("[v0] Number of categories:", data?.length || 0)
        setCategories(data || [])
      }
    }

    loadCategories()
  }, [])

  // Load fields when category changes
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
          // Reset field values when category changes
          setDynamicFieldValues({})
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
  }, [selectedCategory])

  const handleAmenityChange = (amenity: string, checked: boolean) => {
    if (checked) {
      setSelectedAmenities([...selectedAmenities, amenity])
    } else {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity))
    }
  }

  const handleImageAdd = () => {
    const imageUrl = prompt("Enter image URL:")
    if (imageUrl && imageUrl.trim()) {
      setImages([...images, imageUrl.trim()])
    }
  }

  const handleImageRemove = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleLocationSelect = (lat: number, lng: number) => {
    setLocation({ lat, lng })
    console.log("[v0] Location selected:", { lat, lng })
  }

  const handleDynamicFieldChange = (fieldId: string, value: any, fileUrl?: string) => {
    setDynamicFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
      ...(fileUrl && { [`${fieldId}_url`]: fileUrl }),
    }))
    // Clear error for this field when value changes
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

    // Validate dynamic fields before submission
    if (!validateDynamicFields()) {
      toast.error("Please fill in all required fields")
      return
    }

    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      console.log("[v0] Attempting to create property with userId:", userId)

      const { data: userExists, error: userCheckError } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", userId)
        .single()

      if (userCheckError || !userExists) {
        console.log("[v0] User not found in users table, creating user record")
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          throw new Error("Authentication error")
        }

        const { error: insertUserError } = await supabase.from("users").insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          is_host: true, // Mark as host since they're adding a property
          role: "host", // Set role to host (won't override if user already has a role set)
        })

        if (insertUserError) {
          console.error("[v0] Error creating user record:", insertUserError)
          throw insertUserError
        }
      } else if (userExists && !userExists.role) {
        // Update existing user to host role if they don't have a role yet
        await supabase.from("users").update({ role: "host", is_host: true }).eq("id", userId)
      }

      // Insert property
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .insert({
          host_id: userId,
          title: formData.get("title") as string,
          description: formData.get("description") as string,
          property_type: "entertainment", // Added property_type with default value for entertainment objects
          category_id: selectedCategory,
          address: formData.get("address") as string,
          city: formData.get("city") as string,
          country: formData.get("country") as string,
          latitude: location.lat,
          longitude: location.lng,
          price_per_night: Number.parseFloat(formData.get("price_per_night") as string),
          max_guests: Number.parseInt(formData.get("max_guests") as string),
          amenities: selectedAmenities,
          images: images,
          is_active: true,
        })
        .select()
        .single()

      if (propertyError) {
        console.error("[v0] Error adding property:", propertyError)
        toast.error(`Error adding property: ${propertyError.message}`)
        return
      }

      console.log("[v0] Property added successfully:", propertyData)

      // Save dynamic field values
      if (categoryFields.length > 0 && propertyData) {
        const fieldValues = categoryFields.map((field) => ({
          field_id: field.id,
          value: dynamicFieldValues[field.id] || "",
          file_url: dynamicFieldValues[`${field.id}_url`] || "",
        }))

        const response = await fetch("/api/properties/field-values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: propertyData.id,
            field_values: fieldValues,
          }),
        })

        if (!response.ok) {
          console.error("[v0] Error saving field values")
          toast.error("Property created but some field values failed to save")
        }
      }

      toast.success("Property added successfully!")
      router.push("/host")
    } catch (error) {
      console.error("[v0] Unexpected error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
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
            <Input id="title" name="title" placeholder="Centrum paintballowe Adventure Park" required />
          </div>

          <div>
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Opisz swój obiekt rozrywkowy, jego atrakcje i co czyni go wyjątkowym..."
              rows={4}
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
            <Input id="address" name="address" placeholder="ul. Główna 123" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Miasto</Label>
              <Input id="city" name="city" placeholder="Warszawa" required />
            </div>

            <div>
              <Label htmlFor="country">Kraj</Label>
              <Input id="country" name="country" placeholder="Polska" required />
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
              <Input id="max_guests" name="max_guests" type="number" min="1" defaultValue="10" required />
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
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader>
          <CardTitle>Udogodnienia</CardTitle>
          <CardDescription>Co oferuje Twój obiekt?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {AMENITIES.map((amenity) => (
              <div key={amenity} className="flex items-center space-x-2">
                <Checkbox
                  id={amenity}
                  checked={selectedAmenities.includes(amenity)}
                  onCheckedChange={(checked) => handleAmenityChange(amenity, checked as boolean)}
                />
                <Label htmlFor={amenity} className="text-sm">
                  {amenity}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
      <Card>
        <CardHeader>
          <CardTitle>Zdjęcia</CardTitle>
          <CardDescription>Dodaj zdjęcia swojego obiektu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" onClick={handleImageAdd}>
            <Upload className="h-4 w-4 mr-2" />
            Dodaj URL zdjęcia
          </Button>

          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image || "/placeholder.svg"}
                    alt={`Zdjęcie obiektu ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleImageRemove(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Anuluj
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Dodawanie obiektu...
            </>
          ) : (
            "Dodaj obiekt"
          )}
        </Button>
      </div>
    </form>
  )
}
