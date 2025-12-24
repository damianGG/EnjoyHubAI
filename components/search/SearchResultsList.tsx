"use client"

import { Button } from "@/components/ui/button"
import AttractionCard from "@/components/AttractionCard"
import AttractionCardSkeleton from "@/components/AttractionCardSkeleton"
import { generateAttractionSlug } from "@/lib/utils"

interface SearchResult {
  id: string
  title: string
  city: string
  country: string
  latitude: number | null
  longitude: number | null
  price_per_night: number
  category_slug: string | null
  category_name: string | null
  category_icon: string | null
  category_image_url: string | null
  subcategory_slug: string | null
  subcategory_name: string | null
  subcategory_icon: string | null
  subcategory_image_url: string | null
  avg_rating: number
  images?: string[]
  region?: string
  review_count?: number
  cover_image_url?: string | null
  next_available_slot?: { date: string; startTime: string } | null
  price_from?: number | null
}

interface SearchResultsListProps {
  results: SearchResult[]
  loading: boolean
  total: number
  page: number
  per: number
  onPageChange: (newPage: number) => void
}

export function SearchResultsList({
  results,
  loading,
  total,
  page,
  per,
  onPageChange,
}: SearchResultsListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <AttractionCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm md:text-base text-muted-foreground">
          Nie znaleziono atrakcji. Spróbuj dostosować filtry lub obszar wyszukiwania.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {results.map((result) => (
          <AttractionCard
            key={result.id}
            id={result.id}
            images={result.images || []}
            title={result.title}
            city={result.city}
            region={result.region || result.category_name || ""}
            country={result.country}
            rating={result.avg_rating || 0}
            reviewsCount={result.review_count || 0}
            price={result.price_per_night}
            priceUnit="noc"
            href={`/attractions/${generateAttractionSlug({
              city: result.city,
              category: result.category_slug,
              title: result.title,
              id: result.id,
            })}`}
            nextAvailableSlot={result.next_available_slot}
            priceFrom={result.price_from}
            coverImageUrl={result.cover_image_url}
          />
        ))}
      </div>

      {/* Pagination */}
      {total > per && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Poprzednia
          </Button>
          <span className="text-sm text-muted-foreground">
            Strona {page} z {Math.ceil(total / per)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / per)}
            onClick={() => onPageChange(page + 1)}
          >
            Następna
          </Button>
        </div>
      )}
    </div>
  )
}
