"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Search, Users, Filter, X, SlidersHorizontal } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export interface FilterState {
  guests: string
  priceRange: [number, number]
  ageRange: [number, number]
  propertyTypes: string[]
  amenities: string[]
  sortBy: string
}

interface PropertyFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onSearch: () => void
  totalResults: number
}

const PROPERTY_TYPES = [
  "gaming_center",
  "escape_room",
  "bowling",
  "cinema",
  "restaurant",
  "playground",
  "sports_center",
  "art_studio",
  "music_venue",
  "adventure_park",
]

const AMENITIES = [
  "Parking",
  "WiFi",
  "Air conditioning",
  "Accessible",
  "Food & Drinks",
  "Birthday parties",
  "Group bookings",
  "Equipment rental",
  "Lockers",
  "Changing rooms",
  "Photo booth",
  "Party rooms",
  "Outdoor area",
  "Indoor area",
  "Safety equipment",
]

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
]

export default function PropertyFilters({ filters, onFiltersChange, onSearch, totalResults }: PropertyFiltersProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const togglePropertyType = (type: string) => {
    const newTypes = filters.propertyTypes.includes(type)
      ? filters.propertyTypes.filter((t) => t !== type)
      : [...filters.propertyTypes, type]
    updateFilter("propertyTypes", newTypes)
  }

  const toggleAmenity = (amenity: string) => {
    const newAmenities = filters.amenities.includes(amenity)
      ? filters.amenities.filter((a) => a !== amenity)
      : [...filters.amenities, amenity]
    updateFilter("amenities", newAmenities)
  }

  const clearFilters = () => {
    onFiltersChange({
      guests: "1",
      priceRange: [0, 500],
      ageRange: [0, 18],
      propertyTypes: [],
      amenities: [],
      sortBy: "newest",
    })
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.guests !== "1") count++
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 500) count++
    if (filters.ageRange[0] > 0 || filters.ageRange[1] < 18) count++
    if (filters.propertyTypes.length > 0) count++
    if (filters.amenities.length > 0) count++
    return count
  }

  const SearchBar = () => (
    <Card className="shadow-lg">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Guests */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">ILE OSÓB</Label>
            <Select value={filters.guests} onValueChange={(value) => updateFilter("guests", value)}>
              <SelectTrigger>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} osób{num === 1 ? "a" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range Quick Select */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">BUDŻET</Label>
            <Select
              value={`${filters.priceRange[0]}-${filters.priceRange[1]}`}
              onValueChange={(value) => {
                const [min, max] = value.split("-").map(Number)
                updateFilter("priceRange", [min, max])
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz budżet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-50">Do 50 zł</SelectItem>
                <SelectItem value="50-100">50-100 zł</SelectItem>
                <SelectItem value="100-200">100-200 zł</SelectItem>
                <SelectItem value="200-500">200-500 zł</SelectItem>
                <SelectItem value="0-500">Dowolny</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <Button onClick={onSearch} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              Szukaj
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const FilterPanel = ({ isMobile = false }) => (
    <div className="space-y-6">
      {/* Price Range */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Zakres cenowy (za osobę)</Label>
        <div className="px-2">
          <Slider
            value={filters.priceRange}
            onValueChange={(value) => updateFilter("priceRange", value as [number, number])}
            max={500}
            min={0}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>{filters.priceRange[0]} zł</span>
            <span>{filters.priceRange[1]} zł</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-sm font-medium">Wiek uczestników</Label>
        <div className="px-2">
          <Slider
            value={filters.ageRange}
            onValueChange={(value) => updateFilter("ageRange", value as [number, number])}
            max={18}
            min={0}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>{filters.ageRange[0]} lat</span>
            <span>{filters.ageRange[1] === 18 ? "18+" : `${filters.ageRange[1]} lat`}</span>
          </div>
        </div>
      </div>

      {/* Property Types */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Typ rozrywki</Label>
        <div className="grid grid-cols-1 gap-2">
          {PROPERTY_TYPES.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${type}`}
                checked={filters.propertyTypes.includes(type)}
                onCheckedChange={() => togglePropertyType(type)}
              />
              <Label htmlFor={`type-${type}`} className="text-sm capitalize">
                {type.replace("_", " ")}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Amenities */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Udogodnienia</Label>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
          {AMENITIES.map((amenity) => (
            <div key={amenity} className="flex items-center space-x-2">
              <Checkbox
                id={`amenity-${amenity}`}
                checked={filters.amenities.includes(amenity)}
                onCheckedChange={() => toggleAmenity(amenity)}
              />
              <Label htmlFor={`amenity-${amenity}`} className="text-sm">
                {amenity}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      <Button variant="outline" onClick={clearFilters} className="w-full bg-transparent">
        <X className="h-4 w-4 mr-2" />
        Wyczyść filtry
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <SearchBar />

      {/* Results and Sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">{totalResults} miejsc znaleziono</span>

          {/* Active Filters */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {getActiveFiltersCount()} filtr{getActiveFiltersCount() !== 1 ? "y" : ""} aktywne
              </Badge>
              {filters.propertyTypes.map((type) => (
                <Badge key={type} variant="outline" className="capitalize">
                  {type.replace("_", " ")}
                  <button onClick={() => togglePropertyType(type)} className="ml-1 hover:bg-muted rounded-full">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Sort */}
          <Select value={filters.sortBy} onValueChange={(value) => updateFilter("sortBy", value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mobile Filters Button */}
          <Dialog open={showMobileFilters} onOpenChange={setShowMobileFilters}>
            <DialogTrigger asChild>
              <Button variant="outline" className="md:hidden bg-transparent">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filtry
                {getActiveFiltersCount() > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {getActiveFiltersCount()}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Filtry</DialogTitle>
              </DialogHeader>
              <FilterPanel isMobile />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Desktop Filters Sidebar */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filtry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FilterPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
