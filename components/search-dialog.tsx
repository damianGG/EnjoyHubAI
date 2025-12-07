"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X, ChevronDown, ChevronUp, Calendar as CalendarIcon } from "lucide-react"
import { useUrlState } from "@/lib/search/url-state"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface Subcategory {
  id: string
  parent_category_id: string
  name: string
  slug: string
  icon?: string
  description?: string
  image_url?: string
  image_public_id?: string
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string
  image_url?: string
  image_public_id?: string
  subcategories?: Subcategory[]
}

interface SearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: SearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const urlState = useUrlState()
  
  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [location, setLocation] = useState("")
  const [ageMin, setAgeMin] = useState("")
  const [ageMax, setAgeMax] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : open
  const setIsOpen = isControlled ? controlledOnOpenChange || (() => {}) : setOpen

  useEffect(() => {
    const loadCategoriesWithSubcategories = async () => {
      const s = createClient()
      
      // Load categories
      const { data: categoriesData, error: categoriesError } = await s
        .from("categories")
        .select("id,name,slug,icon,description,image_url,image_public_id")
        .order("name")
      
      if (categoriesError || !categoriesData) {
        setLoading(false)
        return
      }
      
      // Load all subcategories
      const { data: subcategoriesData, error: subcategoriesError } = await s
        .from("subcategories")
        .select("id,parent_category_id,name,slug,icon,description,image_url,image_public_id")
        .order("name")
      
      if (!subcategoriesError && subcategoriesData) {
        // Group subcategories by parent category
        const categoriesWithSubs = categoriesData.map((cat) => ({
          ...cat,
          subcategories: subcategoriesData.filter(
            (sub) => sub.parent_category_id === cat.id
          ),
        }))
        setCategories(categoriesWithSubs)
      } else {
        setCategories(categoriesData)
      }
      
      setLoading(false)
    }

    loadCategoriesWithSubcategories()
  }, [])

  // Load current filters from URL when dialog opens
  useEffect(() => {
    if (isOpen) {
      const currentCategories = urlState.get("categories") || ""
      setSelectedCategories(currentCategories ? currentCategories.split(",") : [])
      
      const currentLocation = urlState.get("q") || ""
      setLocation(currentLocation)
      
      const currentAgeMin = urlState.get("age_min") || ""
      const currentAgeMax = urlState.get("age_max") || ""
      setAgeMin(currentAgeMin)
      setAgeMax(currentAgeMax)
      
      const currentDate = urlState.get("date") || ""
      if (currentDate) {
        const [year, month, day] = currentDate.split("-").map(Number)
        setSelectedDate(new Date(year, month - 1, day))
      } else {
        setSelectedDate(undefined)
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

  const toggleCategoryExpansion = (categorySlug: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(categorySlug)) {
        newSet.delete(categorySlug)
      } else {
        newSet.add(categorySlug)
      }
      return newSet
    })
  }

  const handleSearch = () => {
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

    if (ageMin) {
      updates.age_min = ageMin
    } else {
      updates.age_min = ""
    }

    if (ageMax) {
      updates.age_max = ageMax
    } else {
      updates.age_max = ""
    }

    if (selectedDate) {
      // Format date as YYYY-MM-DD
      const year = selectedDate.getFullYear()
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, "0")
      const day = selectedDate.getDate().toString().padStart(2, "0")
      updates.date = `${year}-${month}-${day}`
    } else {
      updates.date = ""
    }

    urlState.setMany(updates)
    setIsOpen(false)
  }

  const handleClearAll = () => {
    setSelectedCategories([])
    setLocation("")
    setAgeMin("")
    setAgeMax("")
    setSelectedDate(undefined)
    
    urlState.setMany({
      categories: "",
      q: "",
      age_min: "",
      age_max: "",
      date: "",
      page: 1,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0 h-full md:h-auto w-full max-h-screen md:max-h-[90vh] flex flex-col" showCloseButton={false}>
        {/* Close button in top right */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-gray-100 transition-colors z-10 bg-white shadow-sm"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable content area */}
        <ScrollArea className="flex-1 h-full">
          <div className="p-6 space-y-6 pb-24">
            {/* Categories Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Kategorie</h3>
              {loading ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.id} className="space-y-2">
                      {/* Main Category */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant={selectedCategories.includes(category.slug) ? "default" : "outline"}
                          onClick={() => toggleCategory(category.slug)}
                          className="flex-1 h-auto py-3 px-3 flex items-center justify-start space-x-3 text-sm"
                        >
                          {category.image_url ? (
                            <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                              <Image
                                src={category.image_url}
                                alt={category.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-2xl flex-shrink-0">{category.icon}</span>
                          )}
                          <span className="font-medium text-left flex-1">{category.name}</span>
                        </Button>
                        
                        {/* Expand/Collapse button for subcategories */}
                        {category.subcategories && category.subcategories.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleCategoryExpansion(category.slug)}
                            className="flex-shrink-0 h-12 w-12"
                          >
                            {expandedCategories.has(category.slug) ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Subcategories - shown when expanded */}
                      {category.subcategories && 
                       category.subcategories.length > 0 && 
                       expandedCategories.has(category.slug) && (
                        <div className="pl-4 space-y-1">
                          {category.subcategories.map((subcategory) => (
                            <Button
                              key={subcategory.id}
                              variant={selectedCategories.includes(subcategory.slug) ? "default" : "outline"}
                              onClick={() => toggleCategory(subcategory.slug)}
                              className="w-full h-auto py-2 px-3 flex items-center justify-start space-x-2 text-sm"
                            >
                              {subcategory.image_url ? (
                                <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                                  <Image
                                    src={subcategory.image_url}
                                    alt={subcategory.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : subcategory.icon ? (
                                <span className="text-lg flex-shrink-0">{subcategory.icon}</span>
                              ) : (
                                <span className="text-lg flex-shrink-0">•</span>
                              )}
                              <span className="font-normal text-left flex-1">{subcategory.name}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Where Section */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Gdzie?</h2>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Wyszukaj kierunki"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-12 h-14 text-base border-2 rounded-xl focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>
            </div>

            {/* When Section - Date Picker */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Kiedy?</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-14 justify-start text-left font-normal border-2 rounded-xl",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {selectedDate ? (
                      format(selectedDate, "PPP", { locale: pl })
                    ) : (
                      <span>Wybierz datę</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Age Section */}
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Wiek uczestników</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="Od"
                        value={ageMin}
                        onChange={(e) => setAgeMin(e.target.value)}
                        className="h-10 border-gray-300"
                        min="0"
                        max="99"
                      />
                    </div>
                    <span className="text-gray-400">-</span>
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="Do"
                        value={ageMax}
                        onChange={(e) => setAgeMax(e.target.value)}
                        className="h-10 border-gray-300"
                        min="0"
                        max="99"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Bottom Action Bar - Fixed at bottom */}
        <div className="border-t p-4 flex items-center justify-between bg-white flex-shrink-0">
          <Button 
            variant="ghost" 
            onClick={handleClearAll}
            className="text-sm underline hover:no-underline"
          >
            Wyczyść wszystko
          </Button>
          
          {/* Selection Counter */}
          {selectedCategories.length > 0 && (
            <div className="text-sm text-gray-600 font-medium">
              Wybrano: {selectedCategories.length}
            </div>
          )}
          
          <Button 
            onClick={handleSearch}
            className="bg-pink-600 hover:bg-pink-700 text-white px-8 rounded-lg"
            size="lg"
          >
            <Search className="h-4 w-4 mr-2" />
            Szukaj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
