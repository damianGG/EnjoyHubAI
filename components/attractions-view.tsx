"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { List, Map, MapPin, Sparkles, Star, Users } from "lucide-react"

import AttractionFilters, { type FilterState } from "@/components/attraction-filters"
import AttractionMap from "@/components/attraction-map"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { generateAttractionSlug } from "@/lib/utils"

interface Attraction {
  id: string
  title: string
  city: string
  country: string
  region?: string
  latitude?: number
  longitude?: number
  price_per_night: number
  property_type: string
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
  max_guests: number
  bedrooms: number
  bathrooms: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
  amenities?: string[]
}

interface AttractionsViewProps {
  attractions: Attraction[]
  mobileImmersive?: boolean
}

function attractionHref(attraction: Attraction) {
  return `/attractions/${generateAttractionSlug({
    city: attraction.city,
    category: attraction.property_type,
    title: attraction.title,
    id: attraction.id,
  })}`
}

function AttractionListItem({ attraction, selected, onSelect }: { attraction: Attraction; selected: boolean; onSelect: () => void }) {
  const image = attraction.images?.find(Boolean) || "/placeholder.jpg"

  return (
    <article
      onMouseEnter={onSelect}
      onClick={onSelect}
      className={`group overflow-hidden rounded-[22px] border bg-white transition-all duration-200 ${
        selected
          ? "border-primary shadow-[0_12px_30px_rgba(244,117,33,0.14)] ring-1 ring-primary/15"
          : "border-black/[0.065] shadow-[0_6px_22px_rgba(55,37,19,0.055)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(55,37,19,0.10)]"
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
              <span className="truncate">{attraction.city}{attraction.region ? `, ${attraction.region}` : ""}</span>
            </p>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize">{attraction.property_type.replaceAll("_", " ")}</Badge>
              {attraction.max_guests > 0 && (
                <Badge variant="outline" className="rounded-full border-black/[0.07] px-2 py-0.5 text-[10px] font-medium"><Users className="mr-1 h-3 w-3" />do {attraction.max_guests} osób</Badge>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-2 border-t border-black/[0.05] pt-3">
            <div><span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">od </span><span className="text-lg font-extrabold tracking-[-0.03em]">{Math.round(attraction.price_per_night)} zł</span><span className="text-[11px] text-muted-foreground"> / os.</span></div>
            {attraction.reviewCount ? <span className="text-[11px] text-muted-foreground">{attraction.reviewCount} opinii</span> : null}
          </div>
        </div>
      </Link>
    </article>
  )
}

function EmptyList() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[26px] border border-dashed border-primary/20 bg-gradient-to-br from-secondary/70 to-white px-7 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-white text-primary shadow-[0_10px_25px_rgba(64,41,18,0.08)]"><Sparkles className="h-6 w-6" /></span>
      <h2 className="text-lg font-bold tracking-[-0.025em]">Mapa jest gotowa do odkrywania</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">W tym podglądzie nie ma jeszcze danych atrakcji. Interfejs, filtry i mapa działają niezależnie od zasilenia listy.</p>
    </div>
  )
}

export default function AttractionsView({ attractions, mobileImmersive = false }: AttractionsViewProps) {
  const [mobileMode, setMobileMode] = useState<"map" | "list">("map")
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
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

  const filteredAttractions = useMemo(() => {
    if (!Array.isArray(attractions)) return []

    const result = attractions.filter((attraction) => {
      if (!attraction?.title || !attraction.city || !attraction.country) return false

      if (filters.location?.trim()) {
        const query = filters.location.trim().toLowerCase()
        const haystack = `${attraction.title} ${attraction.city} ${attraction.region ?? ""} ${attraction.country}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }

      if (Number.parseInt(filters.guests, 10) > attraction.max_guests) return false
      if (attraction.price_per_night < filters.priceRange[0] || attraction.price_per_night > filters.priceRange[1]) return false
      if (filters.attractionTypes.length > 0 && !filters.attractionTypes.includes(attraction.property_type)) return false

      if (filters.amenities.length > 0) {
        const amenities = attraction.amenities ?? []
        if (!filters.amenities.every((amenity) => amenities.includes(amenity))) return false
      }

      return true
    })

    return result.sort((a, b) => {
      switch (filters.sortBy) {
        case "price_low": return a.price_per_night - b.price_per_night
        case "price_high": return b.price_per_night - a.price_per_night
        case "rating": return (b.avgRating ?? 0) - (a.avgRating ?? 0)
        case "reviews": return (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
        default: return 0
      }
    })
  }, [attractions, filters])

  const list = filteredAttractions.length > 0 ? (
    <div className="space-y-3 px-3 pb-6 md:px-0 md:pb-0">
      {filteredAttractions.map((attraction) => (
        <AttractionListItem key={attraction.id} attraction={attraction} selected={selectedAttraction === attraction.id} onSelect={() => setSelectedAttraction(attraction.id)} />
      ))}
    </div>
  ) : <div className="px-3 md:px-0"><EmptyList /></div>

  return (
    <div className={mobileImmersive ? "md:space-y-4" : "space-y-4"}>
      <div className={mobileImmersive ? "hidden lg:block" : "hidden md:block"}>
        <AttractionFilters filters={filters} onFiltersChange={setFilters} onSearch={() => undefined} totalResults={filteredAttractions.length} />
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(390px,43%)_1fr]">
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">{list}</div>
        <div className="sticky top-4 h-[calc(100vh-12rem)] min-h-[620px] overflow-hidden rounded-[28px] border border-black/[0.06] bg-muted shadow-[0_14px_38px_rgba(55,37,19,0.08)]">
          <AttractionMap attractions={filteredAttractions} selectedAttraction={selectedAttraction} onAttractionSelect={setSelectedAttraction} className="h-full border-0 shadow-none" />
        </div>
      </div>

      <div className="lg:hidden">
        {mobileMode === "map" ? (
          <div className={mobileImmersive ? "relative h-[calc(100dvh-188px)] min-h-[430px] overflow-hidden bg-muted" : "relative h-[calc(100dvh-16.5rem)] min-h-[500px] overflow-hidden rounded-[26px] border border-black/[0.06] bg-muted shadow-[0_12px_30px_rgba(55,37,19,0.07)]"}>
            <AttractionMap attractions={filteredAttractions} selectedAttraction={selectedAttraction} onAttractionSelect={setSelectedAttraction} className="h-full border-0 shadow-none" immersiveMobile={mobileImmersive} />
          </div>
        ) : (
          <div className={mobileImmersive ? "max-h-[calc(100dvh-188px)] overflow-y-auto bg-[#fbfaf8] pt-3" : "pb-24"}>{list}</div>
        )}

        <div className={`fixed left-1/2 z-[700] -translate-x-1/2 ${mobileImmersive ? "bottom-[max(18px,env(safe-area-inset-bottom))]" : "bottom-24"}`}>
          <Button
            onClick={() => setMobileMode((mode) => (mode === "map" ? "list" : "map"))}
            className="h-12 rounded-full bg-[#28231f] px-5 font-bold text-white shadow-[0_12px_28px_rgba(37,29,22,0.24)] hover:bg-[#171411]"
          >
            {mobileMode === "map" ? <List className="mr-2 h-4 w-4" /> : <Map className="mr-2 h-4 w-4" />}
            {mobileMode === "map" ? `Pokaż listę${filteredAttractions.length ? ` (${filteredAttractions.length})` : ""}` : "Pokaż mapę"}
          </Button>
        </div>
      </div>
    </div>
  )
}
