"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CalendarDays, List, Loader2, Map, MapPin, SearchX, Sparkles, Star, Users } from "lucide-react"

import AttractionFilters, {
  createDefaultFilterState,
  type DynamicFilterCondition,
  type DynamicFilterDefinition,
  type FilterState,
} from "@/components/attraction-filters"
import AttractionMap from "@/components/attraction-map"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  MARKETPLACE_SEARCH_PARAM_KEYS,
  marketplaceSearchResetUpdates,
  useUrlState,
} from "@/lib/search/url-state"
import { publicAttractionPath } from "@/lib/marketplace/attraction-path"

type AvailableSlot = {
  date: string
  startTime: string
  availableCapacity?: number
}

interface Attraction {
  id: string
  title: string
  city: string
  country: string
  region?: string
  latitude?: number
  longitude?: number
  property_type: string
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
  max_guests: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
  amenities?: string[]
  nextAvailableSlot?: AvailableSlot | null
  priceFrom?: number | null
  hasOnlineSales?: boolean
}

interface SearchApiItem {
  id: string
  title: string
  city: string
  country: string
  region?: string
  latitude?: number
  longitude?: number
  property_type: string
  max_guests: number
  amenities?: string[]
  images?: string[]
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
  avg_rating?: number
  review_count?: number
  next_available_slot?: AvailableSlot | null
  price_from?: number | null
  has_online_sales?: boolean
}

interface DynamicFilterDefinitionsPayload {
  category?: {
    slug: string
    name: string
    kind: "category" | "subcategory"
    parentSlug: string | null
  } | null
  definitions?: DynamicFilterDefinition[]
}

interface AttractionsViewProps {
  attractions: Attraction[]
  mobileImmersive?: boolean
}

function attractionHref(attraction: Attraction) {
  return publicAttractionPath(attraction)
}

function localIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatSlot(slot: AvailableSlot) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (slot.date === localIsoDate(today)) return `Dzisiaj · ${slot.startTime}`
  if (slot.date === localIsoDate(tomorrow)) return `Jutro · ${slot.startTime}`

  const [, month, day] = slot.date.split("-")
  return `${day}.${month} · ${slot.startTime}`
}

function capacityLabel(capacity?: number) {
  if (!capacity || capacity < 1) return null
  if (capacity === 1) return "zostało 1 miejsce"
  if (capacity >= 2 && capacity <= 4) return `zostały ${capacity} miejsca`
  return `${capacity} miejsc dostępnych`
}

function parseBoundedNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function csvParam(value: string | null) {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean)
}

function normalizeSlug(value?: string | null) {
  return (value || "").trim().toLowerCase().replaceAll("_", "-")
}

function selectedDynamicCategory(value: string | null) {
  const selected = csvParam(value).map(normalizeSlug).filter(Boolean)
  return selected.length === 1 ? selected[0] : null
}

function isDynamicCondition(value: unknown): value is DynamicFilterCondition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const condition = value as Record<string, unknown>
  return (
    typeof condition.eq === "string"
    || typeof condition.eq === "number"
    || typeof condition.eq === "boolean"
    || typeof condition.min === "number"
    || typeof condition.max === "number"
  )
}

function parseDynamicFilterState(value: string | null, categorySlug: string | null) {
  if (!value || !categorySlug) return {} as Record<string, DynamicFilterCondition>

  try {
    const parsed = JSON.parse(value) as {
      category?: unknown
      supply?: unknown
      product?: unknown
    }
    if (normalizeSlug(typeof parsed.category === "string" ? parsed.category : null) !== categorySlug) return {}

    const flattened: Record<string, DynamicFilterCondition> = {}
    for (const scope of ["supply", "product"] as const) {
      const source = parsed[scope]
      if (!source || typeof source !== "object" || Array.isArray(source)) continue
      for (const [key, condition] of Object.entries(source)) {
        if (!/^[a-z0-9_]{2,80}$/.test(key) || !isDynamicCondition(condition)) continue
        flattened[`${scope}:${key}`] = condition
      }
    }
    return flattened
  } catch {
    return {}
  }
}

function serializeDynamicFilters(
  categorySlug: string | null,
  values: Record<string, DynamicFilterCondition>,
) {
  if (!categorySlug) return null

  const supply: Record<string, DynamicFilterCondition> = {}
  const product: Record<string, DynamicFilterCondition> = {}

  for (const [id, condition] of Object.entries(values)) {
    const separator = id.indexOf(":")
    if (separator <= 0) continue
    const scope = id.slice(0, separator)
    const key = id.slice(separator + 1)
    if (!/^[a-z0-9_]{2,80}$/.test(key)) continue
    if (scope === "supply") supply[key] = condition
    if (scope === "product") product[key] = condition
  }

  if (Object.keys(supply).length === 0 && Object.keys(product).length === 0) return null
  return JSON.stringify({ category: categorySlug, supply, product })
}

function uiSortFromApi(value: string | null) {
  switch (value) {
    case "price_asc": return "price_low"
    case "price_desc": return "price_high"
    case "rating": return "rating"
    case "reviews": return "reviews"
    default: return "newest"
  }
}

function apiSortFromUi(value: string) {
  switch (value) {
    case "price_low": return "price_asc"
    case "price_high": return "price_desc"
    case "rating": return "rating"
    case "reviews": return "reviews"
    default: return "relevance"
  }
}

function mapSearchItem(item: SearchApiItem): Attraction {
  return {
    id: item.id,
    title: item.title,
    city: item.city,
    country: item.country,
    region: item.region,
    latitude: item.latitude,
    longitude: item.longitude,
    property_type: item.property_type || item.category_slug || "attraction",
    category_slug: item.category_slug ?? null,
    category_icon: item.category_icon ?? null,
    category_image_url: item.category_image_url ?? null,
    subcategory_slug: item.subcategory_slug ?? null,
    subcategory_icon: item.subcategory_icon ?? null,
    subcategory_image_url: item.subcategory_image_url ?? null,
    max_guests: item.max_guests ?? 1,
    images: item.images ?? [],
    avgRating: item.avg_rating ?? 0,
    reviewCount: item.review_count ?? 0,
    amenities: item.amenities ?? [],
    nextAvailableSlot: item.next_available_slot ?? null,
    priceFrom: item.price_from ?? null,
    hasOnlineSales: Boolean(item.has_online_sales),
  }
}

function PriceSummary({ attraction }: { attraction: Attraction }) {
  if (typeof attraction.priceFrom === "number" && Number.isFinite(attraction.priceFrom)) {
    return (
      <div>
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">od </span>
        <span className="text-lg font-extrabold tracking-[-0.03em]">{Math.round(attraction.priceFrom)} zł</span>
        <span className="text-[11px] text-muted-foreground"> / os.</span>
      </div>
    )
  }

  return <span className="text-xs font-bold text-primary">Sprawdź ofertę</span>
}

function AttractionListItem({ attraction, selected, onSelect }: { attraction: Attraction; selected: boolean; onSelect: () => void }) {
  const image = attraction.images?.find(Boolean) || "/placeholder.jpg"
  const capacity = capacityLabel(attraction.nextAvailableSlot?.availableCapacity)

  return (
    <article
      onMouseEnter={onSelect}
      onClick={onSelect}
      className={`group overflow-hidden rounded-[22px] border bg-white transition-all duration-200 ${
        selected
          ? "border-primary shadow-[0_12px_30px_rgba(255,90,31,0.14)] ring-1 ring-primary/15"
          : "border-[#0b1220]/[0.065] shadow-[0_6px_22px_rgba(11,18,32,0.055)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(11,18,32,0.10)]"
      }`}
    >
      <Link href={attractionHref(attraction)} className="grid grid-cols-[40%_1fr] gap-0 sm:grid-cols-[42%_1fr]">
        <div className="relative min-h-36 overflow-hidden bg-muted">
          <Image src={image} alt={attraction.title} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" sizes="(max-width: 768px) 40vw, 260px" />
        </div>

        <div className="flex min-w-0 flex-col justify-between p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-[-0.02em]">{attraction.title}</h3>
              {Boolean(attraction.avgRating) && (
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-bold">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  {attraction.avgRating?.toFixed(1)}
                </div>
              )}
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{attraction.city}{attraction.region && attraction.region !== attraction.city ? `, ${attraction.region}` : ""}</span>
            </p>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize">{attraction.property_type.replaceAll("_", " ")}</Badge>
              {attraction.max_guests > 0 && (
                <Badge variant="outline" className="rounded-full border-[#0b1220]/[0.07] px-2 py-0.5 text-[10px] font-medium"><Users className="mr-1 h-3 w-3" />do {attraction.max_guests} osób</Badge>
              )}
            </div>

            {attraction.nextAvailableSlot && (
              <div className="rounded-xl border border-primary/15 bg-[#fff7f2] px-2.5 py-2 text-[11px]">
                <p className="flex items-center gap-1.5 font-bold text-[#b63b12]"><CalendarDays className="h-3.5 w-3.5" />{formatSlot(attraction.nextAvailableSlot)}</p>
                {capacity && <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{capacity}</p>}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between gap-2 border-t border-[#0b1220]/[0.05] pt-3">
            <PriceSummary attraction={attraction} />
            {attraction.reviewCount ? <span className="text-[11px] text-muted-foreground">{attraction.reviewCount} opinii</span> : null}
          </div>
        </div>
      </Link>
    </article>
  )
}

function EmptyList({ searched }: { searched: boolean }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[26px] border border-dashed border-primary/20 bg-gradient-to-br from-secondary/70 to-white px-7 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-white text-primary shadow-[0_10px_25px_rgba(11,18,32,0.08)]">
        {searched ? <SearchX className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </span>
      <h2 className="text-lg font-bold tracking-[-0.025em]">{searched ? "Nie znaleźliśmy takich atrakcji" : "Nie ma jeszcze atrakcji do wyświetlenia"}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {searched
          ? "Zmień termin, kategorię, lokalizację albo liczbę osób i spróbuj ponownie."
          : "Spróbuj zmienić lokalizację lub wróć później — nowe atrakcje będą pojawiać się tutaj automatycznie."}
      </p>
    </div>
  )
}

export default function AttractionsView({ attractions, mobileImmersive = false }: AttractionsViewProps) {
  const searchParams = useSearchParams()
  const urlSearchString = searchParams.toString()
  const urlState = useUrlState()
  const dynamicCategorySlug = useMemo(
    () => selectedDynamicCategory(searchParams.get("categories")),
    [urlSearchString, searchParams],
  )
  const [mobileMode, setMobileMode] = useState<"map" | "list">("map")
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(null)
  const [remoteAttractions, setRemoteAttractions] = useState<Attraction[] | null>(null)
  const [remoteTotal, setRemoteTotal] = useState<number | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [dynamicDefinitions, setDynamicDefinitions] = useState<DynamicFilterDefinition[]>([])
  const [dynamicCategoryName, setDynamicCategoryName] = useState<string | null>(null)
  const [dynamicDefinitionsLoading, setDynamicDefinitionsLoading] = useState(false)
  const [filters, setFilters] = useState<FilterState>(() => {
    const initialDynamicCategory = selectedDynamicCategory(searchParams.get("categories"))
    return {
      location: searchParams.get("q") || "",
      checkIn: "",
      checkOut: "",
      guests: searchParams.get("guests") || "1",
      priceRange: [
        parseBoundedNumber(searchParams.get("min_price"), 0, 0, 500),
        parseBoundedNumber(searchParams.get("max_price"), 500, 0, 500),
      ],
      ageRange: [
        parseBoundedNumber(searchParams.get("age_min"), 0, 0, 18),
        parseBoundedNumber(searchParams.get("age_max"), 18, 0, 18),
      ],
      attractionTypes: csvParam(searchParams.get("types")),
      amenities: csvParam(searchParams.get("amenities")),
      sortBy: uiSortFromApi(searchParams.get("sort")),
      dynamicFilters: parseDynamicFilterState(searchParams.get("attrs"), initialDynamicCategory),
    }
  })

  const hasSearchCriteria = useMemo(
    () => MARKETPLACE_SEARCH_PARAM_KEYS.some((key) => Boolean(searchParams.get(key))),
    [urlSearchString, searchParams],
  )

  useEffect(() => {
    setFilters({
      location: searchParams.get("q") || "",
      checkIn: "",
      checkOut: "",
      guests: searchParams.get("guests") || "1",
      priceRange: [
        parseBoundedNumber(searchParams.get("min_price"), 0, 0, 500),
        parseBoundedNumber(searchParams.get("max_price"), 500, 0, 500),
      ],
      ageRange: [
        parseBoundedNumber(searchParams.get("age_min"), 0, 0, 18),
        parseBoundedNumber(searchParams.get("age_max"), 18, 0, 18),
      ],
      attractionTypes: csvParam(searchParams.get("types")),
      amenities: csvParam(searchParams.get("amenities")),
      sortBy: uiSortFromApi(searchParams.get("sort")),
      dynamicFilters: parseDynamicFilterState(searchParams.get("attrs"), dynamicCategorySlug),
    })
  }, [dynamicCategorySlug, urlSearchString, searchParams])

  useEffect(() => {
    if (!dynamicCategorySlug) {
      setDynamicDefinitions([])
      setDynamicCategoryName(null)
      setDynamicDefinitionsLoading(false)
      return
    }

    const controller = new AbortController()
    setDynamicDefinitionsLoading(true)
    setDynamicDefinitions([])

    void fetch(`/api/search/filter-definitions?category=${encodeURIComponent(dynamicCategorySlug)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Filter definitions failed: ${response.status}`)
        return response.json() as Promise<DynamicFilterDefinitionsPayload>
      })
      .then((payload) => {
        setDynamicCategoryName(payload.category?.name || dynamicCategorySlug)
        setDynamicDefinitions(Array.isArray(payload.definitions) ? payload.definitions : [])
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("[search] Failed to load category filters", error)
        setDynamicDefinitions([])
        setDynamicCategoryName(dynamicCategorySlug)
      })
      .finally(() => {
        if (!controller.signal.aborted) setDynamicDefinitionsLoading(false)
      })

    return () => controller.abort()
  }, [dynamicCategorySlug])

  useEffect(() => {
    if (!hasSearchCriteria) {
      setRemoteAttractions(null)
      setRemoteTotal(null)
      setSearchLoading(false)
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams()
    MARKETPLACE_SEARCH_PARAM_KEYS.forEach((key) => {
      const value = searchParams.get(key)
      if (value) params.set(key, value)
    })
    params.set("page", "1")
    params.set("per", "50")

    setSearchLoading(true)

    void fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Search failed: ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        const items = Array.isArray(payload?.items) ? payload.items as SearchApiItem[] : []
        setRemoteAttractions(items.map(mapSearchItem))
        setRemoteTotal(Number.isFinite(Number(payload?.total)) ? Number(payload.total) : items.length)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("[search] Failed to refresh marketplace results", error)
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false)
      })

    return () => controller.abort()
  }, [hasSearchCriteria, urlSearchString, searchParams])

  const applyFilters = (next: FilterState) => {
    const ageRange = next.ageRange ?? [0, 18]
    const apiSort = apiSortFromUi(next.sortBy)

    urlState.setMany({
      page: 1,
      q: next.location?.trim() || null,
      guests: next.guests !== "1" ? next.guests : null,
      min_price: next.priceRange[0] > 0 ? next.priceRange[0] : null,
      max_price: next.priceRange[1] < 500 ? next.priceRange[1] : null,
      age_min: ageRange[0] > 0 ? ageRange[0] : null,
      age_max: ageRange[1] < 18 ? ageRange[1] : null,
      types: next.attractionTypes.length ? next.attractionTypes.join(",") : null,
      amenities: next.amenities.length ? next.amenities.join(",") : null,
      attrs: serializeDynamicFilters(dynamicCategorySlug, next.dynamicFilters),
      sort: apiSort !== "relevance" ? apiSort : null,
    })
  }

  const handleFiltersChange = (next: FilterState) => {
    const sortChanged = next.sortBy !== filters.sortBy
    setFilters(next)
    if (sortChanged) applyFilters(next)
  }

  const clearFilters = (next: FilterState) => {
    setFilters(next)
    urlState.setMany(
      {
        ...marketplaceSearchResetUpdates(["categories"]),
        page: null,
      },
      { navigateToResults: false },
    )
  }

  const filteredAttractions = (remoteAttractions ?? attractions).filter(
    (attraction) => Boolean(attraction?.title && attraction?.city && attraction?.country),
  )
  const totalResults = remoteTotal ?? filteredAttractions.length

  useEffect(() => {
    if (selectedAttraction && !filteredAttractions.some((attraction) => attraction.id === selectedAttraction)) {
      setSelectedAttraction(null)
    }
  }, [filteredAttractions, selectedAttraction])

  const list = filteredAttractions.length > 0 ? (
    <div className="space-y-3 px-3 pb-6 md:px-0 md:pb-0">
      {searchLoading && (
        <div className="flex items-center gap-2 rounded-2xl bg-secondary/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Aktualizuję wyniki…
        </div>
      )}
      {filteredAttractions.map((attraction) => (
        <AttractionListItem key={attraction.id} attraction={attraction} selected={selectedAttraction === attraction.id} onSelect={() => setSelectedAttraction(attraction.id)} />
      ))}
      {totalResults > filteredAttractions.length && (
        <p className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
          Pokazujemy pierwsze {filteredAttractions.length} z {totalResults} najlepiej dopasowanych atrakcji.
        </p>
      )}
    </div>
  ) : <div className="px-3 md:px-0"><EmptyList searched={hasSearchCriteria} /></div>

  return (
    <div className={mobileImmersive ? "h-full min-h-0 md:h-auto md:space-y-4" : "space-y-4"}>
      <div className={mobileImmersive ? "hidden lg:block" : "hidden md:block"}>
        <AttractionFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onSearch={() => applyFilters(filters)}
          onClearFilters={clearFilters}
          totalResults={totalResults}
          dynamicCategoryName={dynamicCategoryName}
          dynamicDefinitions={dynamicDefinitions}
          dynamicDefinitionsLoading={dynamicDefinitionsLoading}
        />
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(390px,43%)_1fr]">
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">{list}</div>
        <div className="sticky top-4 h-[calc(100vh-12rem)] min-h-[620px] overflow-hidden rounded-[28px] border border-[#0b1220]/[0.06] bg-muted shadow-[0_14px_38px_rgba(11,18,32,0.08)]">
          <AttractionMap attractions={filteredAttractions} selectedAttraction={selectedAttraction} onAttractionSelect={setSelectedAttraction} className="h-full border-0 shadow-none" />
        </div>
      </div>

      <div className={mobileImmersive ? "h-full min-h-0 lg:hidden" : "lg:hidden"}>
        {mobileMode === "map" ? (
          <div className={mobileImmersive ? "relative h-full min-h-0 overflow-hidden bg-muted" : "relative h-[calc(100dvh-16.5rem)] min-h-[500px] overflow-hidden rounded-[26px] border border-[#0b1220]/[0.06] bg-muted shadow-[0_12px_30px_rgba(11,18,32,0.07)]"}>
            {searchLoading && (
              <div className="absolute left-1/2 top-3 z-[760] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Aktualizuję wyniki…
              </div>
            )}
            <AttractionMap attractions={filteredAttractions} selectedAttraction={selectedAttraction} onAttractionSelect={setSelectedAttraction} className="h-full border-0 shadow-none" immersiveMobile={mobileImmersive} />
          </div>
        ) : (
          <div className={mobileImmersive ? "h-full min-h-0 overflow-y-auto bg-background pt-3" : "pb-24"}>{list}</div>
        )}

        <div className={`fixed left-1/2 z-[700] -translate-x-1/2 ${mobileImmersive ? "bottom-[max(18px,env(safe-area-inset-bottom))]" : "bottom-24"}`}>
          <Button
            onClick={() => setMobileMode((mode) => (mode === "map" ? "list" : "map"))}
            className="h-12 rounded-full bg-[#0b1220] px-5 font-bold text-white shadow-[0_12px_28px_rgba(11,18,32,0.24)] hover:bg-[#111827]"
          >
            {mobileMode === "map" ? <List className="mr-2 h-4 w-4" /> : <Map className="mr-2 h-4 w-4" />}
            {mobileMode === "map" ? `Pokaż listę${totalResults ? ` (${totalResults})` : ""}` : "Pokaż mapę"}
          </Button>
        </div>
      </div>
    </div>
  )
}
