"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, MapPin, Users, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUrlState } from "@/lib/search/url-state"

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string
}

interface SearchSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchSheet({ open, onOpenChange }: SearchSheetProps) {
  const urlState = useUrlState()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  
  // Local state for form inputs
  const [location, setLocation] = useState("")
  const [guests, setGuests] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Load categories
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("categories")
      .select("id,name,slug,icon,description")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) setCategories(data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Initialize form from URL params when sheet opens
  useEffect(() => {
    if (open) {
      setLocation(urlState.get("q") || "")
      setGuests(urlState.get("guests") || "")
      setSelectedCategory(urlState.get("categories") || null)
    }
  }, [open, urlState])

  const handleSearch = () => {
    // Update URL params with search criteria
    const updates: Record<string, string | null> = {
      q: location || null,
      guests: guests || null,
      categories: selectedCategory || null,
      page: "1", // Reset to first page
    }
    
    urlState.setMany(updates)
    onOpenChange(false)
  }

  const handleClear = () => {
    setLocation("")
    setGuests("")
    setSelectedCategory(null)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Wyszukaj noclegi</DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-6 pb-4">
            {/* Categories Section */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Kategoria</Label>
              <div className="grid grid-cols-3 gap-2">
                {/* All Categories Button */}
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="flex flex-col items-center space-y-1 h-auto py-3 px-2"
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-current rounded" />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">Wszystkie</span>
                </Button>

                {/* Category Buttons */}
                {!loading && categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.slug ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.slug)}
                    className="flex flex-col items-center space-y-1 h-auto py-3 px-2"
                  >
                    <span className="text-2xl">{category.icon}</span>
                    <span className="text-xs font-medium text-center leading-tight">{category.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Location Field */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-semibold flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                Gdzie
              </Label>
              <Input
                id="location"
                placeholder="Wpisz miejscowość..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {/* Number of Guests Field */}
            <div className="space-y-2">
              <Label htmlFor="guests" className="text-base font-semibold flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Kto
              </Label>
              <Input
                id="guests"
                type="number"
                min="1"
                placeholder="Liczba osób"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          </div>
        </ScrollArea>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClear}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Wyczyść
          </Button>
          <Button
            onClick={handleSearch}
            className="flex-1"
          >
            <Search className="h-4 w-4 mr-2" />
            Wyszukaj
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
