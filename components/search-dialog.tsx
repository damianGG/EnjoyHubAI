"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Search, MapPin } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { useUrlState } from "@/lib/search/url-state"

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string
}

interface SearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: SearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const urlState = useUrlState()
  
  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [location, setLocation] = useState("")
  const [ageRange, setAgeRange] = useState<number[]>([18, 65])

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : open
  const setIsOpen = isControlled ? controlledOnOpenChange || (() => {}) : setOpen

  useEffect(() => {
    const s = createClient()
    s.from("categories")
      .select("id,name,slug,icon,description")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) setCategories(data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Load current filters from URL when dialog opens
  useEffect(() => {
    if (isOpen) {
      const currentCategories = urlState.get("categories") || ""
      setSelectedCategories(currentCategories ? currentCategories.split(",") : [])
      
      const currentLocation = urlState.get("q") || ""
      setLocation(currentLocation)
      
      const currentAgeMin = urlState.get("age_min")
      const currentAgeMax = urlState.get("age_max")
      if (currentAgeMin && currentAgeMax) {
        setAgeRange([parseInt(currentAgeMin), parseInt(currentAgeMax)])
      }
    }
  }, [isOpen])

  const toggleCategory = (categorySlug: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categorySlug)) {
        return prev.filter((s) => s !== categorySlug)
      } else {
        return [...prev, categorySlug]
      }
    })
  }

  const handleApplyFilters = () => {
    const updates: Record<string, any> = {
      page: 1,
    }

    if (selectedCategories.length > 0) {
      updates.categories = selectedCategories.join(",")
    } else {
      updates.categories = ""
    }

    if (location.trim()) {
      updates.q = location.trim()
    } else {
      updates.q = ""
    }

    updates.age_min = ageRange[0]
    updates.age_max = ageRange[1]

    urlState.setMany(updates)
    setIsOpen(false)
  }

  const handleClearFilters = () => {
    setSelectedCategories([])
    setLocation("")
    setAgeRange([18, 65])
    
    urlState.setMany({
      categories: "",
      q: "",
      age_min: "",
      age_max: "",
      page: 1,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-2">
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Wyszukaj</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Wyszukaj i filtruj</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Categories Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Kategorie</h3>
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategories.includes(category.slug) ? "default" : "outline"}
                      onClick={() => toggleCategory(category.slug)}
                      className="h-auto py-3 px-4 flex flex-col items-center space-y-2"
                    >
                      <span className="text-2xl">{category.icon}</span>
                      <span className="text-xs font-medium text-center leading-tight">
                        {category.name}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Location Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Miejscowość</h3>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Gdzie chcesz jechać?"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Age Range Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Wiek uczestników</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Od {ageRange[0]} lat</span>
                  <span>Do {ageRange[1]} lat</span>
                </div>
                <Slider
                  min={18}
                  max={99}
                  step={1}
                  value={ageRange}
                  onValueChange={setAgeRange}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={handleClearFilters}>
            Wyczyść filtry
          </Button>
          <Button onClick={handleApplyFilters}>
            Zastosuj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
