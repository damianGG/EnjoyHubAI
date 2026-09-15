"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Loader2, MapPin, Search, SlidersHorizontal, Users, X } from "lucide-react"

export type DynamicFilterCondition = {
  eq?: string | boolean | number
  min?: number
  max?: number
}

export type DynamicFilterDefinition = {
  scope: "supply" | "product"
  key: string
  label: string
  valueType: "text" | "number" | "boolean" | "select" | "textarea"
  options: string[]
  unit: string | null
  sortOrder: number
}

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
  dynamicFilters: Record<string, DynamicFilterCondition>
}

interface AttractionFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onSearch: () => void
  totalResults: number
  dynamicCategoryName?: string | null
  dynamicDefinitions?: DynamicFilterDefinition[]
  dynamicDefinitionsLoading?: boolean
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

function dynamicFilterId(definition: Pick<DynamicFilterDefinition, "scope" | "key">) {
  return `${definition.scope}:${definition.key}`
}

function hasCondition(condition?: DynamicFilterCondition) {
  return condition?.eq !== undefined || condition?.min !== undefined || condition?.max !== undefined
}

function optionLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function AttractionFilters({
  filters,
  onFiltersChange,
  onSearch,
  totalResults,
  dynamicCategoryName = null,
  dynamicDefinitions = [],
  dynamicDefinitionsLoading = false,
}: AttractionFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)

  const supplyDefinitions = useMemo(
    () => dynamicDefinitions.filter((definition) => definition.scope === "supply"),
    [dynamicDefinitions],
  )
  const productDefinitions = useMemo(
    () => dynamicDefinitions.filter((definition) => definition.scope === "product"),
    [dynamicDefinitions],
  )

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const updateDynamicCondition = (definition: DynamicFilterDefinition, condition?: DynamicFilterCondition) => {
    const id = dynamicFilterId(definition)
    const next = { ...filters.dynamicFilters }
    if (!condition || !hasCondition(condition)) delete next[id]
    else next[id] = condition
    updateFilter("dynamicFilters", next)
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
      dynamicFilters: {},
    })
  }

  const activeFiltersCount = [
    filters.guests !== "1",
    filters.priceRange[0] > 0 || filters.priceRange[1] < 500,
    Boolean(filters.ageRange && (filters.ageRange[0] > 0 || filters.ageRange[1] < 18)),
    filters.amenities.length > 0,
    Object.values(filters.dynamicFilters).some(hasCondition),
  ].filter(Boolean).length

  const renderDynamicControl = (definition: DynamicFilterDefinition) => {
    const id = dynamicFilterId(definition)
    const condition = filters.dynamicFilters[id]

    if (definition.valueType === "boolean") {
      return (
        <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm hover:bg-muted/50">
          <Checkbox
            checked={condition?.eq === true}
            onCheckedChange={(checked) => updateDynamicCondition(definition, checked === true ? { eq: true } : undefined)}
          />
          <span className="font-medium">{definition.label}</span>
        </label>
      )
    }

    if (definition.valueType === "select") {
      const value = typeof condition?.eq === "string" ? condition.eq : "__any__"
      return (
        <div key={id} className="space-y-2 rounded-xl border p-3">
          <Label>{definition.label}</Label>
          <Select
            value={value}
            onValueChange={(nextValue) => updateDynamicCondition(
              definition,
              nextValue === "__any__" ? undefined : { eq: nextValue },
            )}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Dowolne</SelectItem>
              {definition.options.map((option) => (
                <SelectItem key={option} value={option}>{optionLabel(option)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    if (definition.valueType === "number") {
      return (
        <div key={id} className="space-y-2 rounded-xl border p-3">
          <Label>{definition.label}{definition.unit ? ` (${definition.unit})` : ""}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={condition?.min ?? ""}
              onChange={(event) => {
                const min = event.target.value === "" ? undefined : Number(event.target.value)
                updateDynamicCondition(definition, {
                  ...condition,
                  min: Number.isFinite(min) ? min : undefined,
                })
              }}
              placeholder="Od"
              className="h-10 rounded-xl"
            />
            <Input
              type="number"
              value={condition?.max ?? ""}
              onChange={(event) => {
                const max = event.target.value === "" ? undefined : Number(event.target.value)
                updateDynamicCondition(definition, {
                  ...condition,
                  max: Number.isFinite(max) ? max : undefined,
                })
              }}
              placeholder="Do"
              className="h-10 rounded-xl"
            />
          </div>
        </div>
      )
    }

    return (
      <div key={id} className="space-y-2 rounded-xl border p-3">
        <Label>{definition.label}</Label>
        <Input
          value={typeof condition?.eq === "string" ? condition.eq : ""}
          onChange={(event) => updateDynamicCondition(
            definition,
            event.target.value.trim() ? { eq: event.target.value } : undefined,
          )}
          className="h-10 rounded-xl"
        />
      </div>
    )
  }

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
          <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-2xl">
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

              {dynamicCategoryName && (
                <section className="space-y-4 rounded-2xl border border-primary/15 bg-secondary/35 p-4">
                  <div>
                    <Label className="text-base">Filtry dla: {dynamicCategoryName}</Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Te pola są pobierane z konfiguracji kategorii. Zmiana kategorii automatycznie zmienia dostępne filtry.
                    </p>
                  </div>

                  {dynamicDefinitionsLoading ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Ładuję filtry kategorii…
                    </div>
                  ) : dynamicDefinitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ta kategoria nie ma jeszcze dodatkowych filtrów.</p>
                  ) : (
                    <div className="space-y-5">
                      {supplyDefinitions.length > 0 && (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Obiekt</p>
                            <p className="text-xs text-muted-foreground">Cechy miejsca niezależne od konkretnego pakietu.</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">{supplyDefinitions.map(renderDynamicControl)}</div>
                        </div>
                      )}

                      {productDefinitions.length > 0 && (
                        <div className="space-y-3 border-t border-primary/10 pt-4">
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Pakiet / oferta</p>
                            <p className="text-xs text-muted-foreground">Parametry konkretnej oferty dostępnej do zakupu.</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">{productDefinitions.map(renderDynamicControl)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              <div className="space-y-3">
                <div>
                  <Label>Udogodnienia</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Rodzaj atrakcji wybierasz z głównych kategorii nad wynikami.</p>
                </div>
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
