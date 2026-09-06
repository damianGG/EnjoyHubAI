"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { MapPin, Search, SlidersHorizontal, Users, X } from "lucide-react"

export interface FilterState {
  location?: string
  checkIn?: string
  checkOut?: string
  guests: string
  priceRange: [number, number]
  ageRange?: [number, number]
  attractionTypes: string[]
  amenities: string[]
  sortBy: string
}

interface AttractionFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onSearch: () => void
  totalResults: number
}

const ATTRACTION_TYPES = [
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

const TYPE_LABELS: Record<string, string> = {
  gaming_center: "Centrum rozrywki",
  escape_room: "Escape room",
  bowling: "Kręgle",
  cinema: "Kino",
  restaurant: "Gastronomia",
  playground: "Plac zabaw",
  sports_center: "Sport",
  art_studio: "Warsztaty",
  music_venue: "Muzyka",
  adventure_park: "Park przygody",
}

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
  "Outdoor area",
  "Indoor area",
  "Safety equipment",
]

const AMENITY_LABELS: Record<string, string> = {
  Parking: "Parking",
  WiFi: "Wi-Fi",
  "Air conditioning": "Klimatyzacja",
  Accessible: "Dostępność",
  "Food & Drinks": "Jedzenie i napoje",
  "Birthday parties": "Urodziny",
  "Group bookings": "Rezerwacje grupowe",
  "Equipment rental": "Wypożyczalnia sprzętu",
  Lockers: "Szafki",
  "Changing rooms": "Szatnie",
  "Outdoor area": "Na zewnątrz",
  "Indoor area": "W pomieszczeniu",
  "Safety equipment": "Sprzęt ochronny",
}

const SORT_OPTIONS = [
  { value: "newest", label: "Polecane" },
  { value: "price_low", label: "Najniższa cena" },
  { value: "price_high", label: "Najwyższa cena" },
  { value: "rating", label: "Najwyżej oceniane" },
  { value: "reviews", label: "Najwięcej opinii" },
]

export default function AttractionFilters({ filters, onFiltersChange, onSearch, totalResults }: AttractionFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleAttractionType = (type: string) => {
    updateFilter(
      "attractionTypes",
      filters.attractionTypes.includes(type)
        ? filters.attractionTypes.filter((item) => item !== type)
        : [...filters.attractionTypes, type],
    )
  }

  const toggleAmenity = (amenity: string) => {
    updateFilter(
      "amenities",
      filters.amenities.includes(amenity)
        ? filters.amenities.filter((item) => item !== amenity)
        : [...filters.amenities, amenity],
    )
  }

  const clearFilters = () => {
    onFiltersChange({
      location: "",
      checkIn: "",
      checkOut: "",
      guests: "1",
      priceRange: [0, 500],
      ageRange: [0, 18],
      attractionTypes: [],
      amenities: [],
      sortBy: "newest",
    })
  }

  const activeFiltersCount = [
    filters.guests !== "1",
    filters.priceRange[0] > 0 || filters.priceRange[1] < 500,
    Boolean(filters.ageRange && (filters.ageRange[0] > 0 || filters.ageRange[1] < 18)),
    filters.attractionTypes.length > 0,
    filters.amenities.length > 0,
  ].filter(Boolean).length

  return (
    <div className="space-y-3">
      <div className="surface-3d flex flex-col gap-2 rounded-2xl border bg-background p-2 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 focus-within:bg-muted/50">
          <MapPin className="h-4 w-4 shrink-0 text-[#ff5a1f]" />
          <Input
            value={filters.location ?? ""}
            onChange={(event) => updateFilter("location", event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onSearch()}
            placeholder="Miasto, okolica lub atrakcja"
            aria-label="Lokalizacja lub nazwa atrakcji"
            className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="hidden h-8 w-px bg-border md:block" />

        <Select value={filters.guests} onValueChange={(value) => updateFilter("guests", value)}>
          <SelectTrigger className="h-11 w-full rounded-xl border-0 bg-transparent shadow-none md:w-[150px]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 20 }, (_, index) => index + 1).map((number) => (
              <SelectItem key={number} value={number.toString()}>{number} {number === 1 ? "osoba" : "osoby"}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-11 rounded-xl bg-background px-4">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filtry
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-[#ff5a1f] text-white hover:bg-[#ff5a1f]">{activeFiltersCount}</Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>Dopasuj atrakcje</DialogTitle>
            </DialogHeader>

            <div className="space-y-7 py-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Budżet za osobę</Label>
                  <span className="text-sm font-medium">{filters.priceRange[0]}–{filters.priceRange[1]} zł</span>
                </div>
                <Slider
                  value={filters.priceRange}
                  onValueChange={(value) => updateFilter("priceRange", value as [number, number])}
                  max={500}
                  min={0}
                  step={10}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Wiek uczestników</Label>
                  <span className="text-sm font-medium">
                    {filters.ageRange?.[0] ?? 0}–{(filters.ageRange?.[1] ?? 18) === 18 ? "18+" : filters.ageRange?.[1]} lat
                  </span>
                </div>
                <Slider
                  value={filters.ageRange ?? [0, 18]}
                  onValueChange={(value) => updateFilter("ageRange", value as [number, number])}
                  max={18}
                  min={0}
                  step={1}
                />
              </div>

              <div className="space-y-3">
                <Label>Typ atrakcji</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ATTRACTION_TYPES.map((type) => (
                    <label key={type} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm hover:bg-muted/50">
                      <Checkbox checked={filters.attractionTypes.includes(type)} onCheckedChange={() => toggleAttractionType(type)} />
                      <span>{TYPE_LABELS[type] ?? type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Udogodnienia</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AMENITIES.map((amenity) => (
                    <label key={amenity} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm hover:bg-muted/50">
                      <Checkbox checked={filters.amenities.includes(amenity)} onCheckedChange={() => toggleAmenity(amenity)} />
                      <span>{AMENITY_LABELS[amenity] ?? amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 border-t pt-4">
                <Button type="button" variant="ghost" onClick={clearFilters} className="flex-1">
                  <X className="mr-2 h-4 w-4" />Wyczyść
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onSearch()
                    setShowFilters(false)
                  }}
                  className="flex-1 bg-[#ff5a1f] text-white hover:bg-[#e94f18]"
                >
                  Pokaż {totalResults}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button onClick={onSearch} className="h-11 rounded-xl bg-[#ff5a1f] px-5 text-white hover:bg-[#e94f18]">
          <Search className="mr-2 h-4 w-4" />Szukaj
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{totalResults}</span> atrakcji</p>
        <Select value={filters.sortBy} onValueChange={(value) => updateFilter("sortBy", value)}>
          <SelectTrigger className="h-9 w-[180px] rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
