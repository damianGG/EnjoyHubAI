"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, MapPin, Users, Bed, Bath, Map, Grid3X3 } from "lucide-react"
import Link from "next/link"
import AttractionMap from "@/components/attraction-map"
import AttractionFilters, { type FilterState } from "@/components/attraction-filters"
import { generateAttractionSlug } from "@/lib/utils"
import AttractionCard from "@/components/AttractionCard"

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
  max_guests: number
  bedrooms: number
  bathrooms: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
  amenities?: string[]
  users?: {
    full_name: string
  }
}

interface AttractionsViewProps {
  attractions: Attraction[]
}

export default function AttractionsView({ attractions }: AttractionsViewProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid")
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    location: "",
    checkIn: "",
    checkOut: "",
    guests: "1",
    priceRange: [0, 1000],
    ageRange: [0, 18],
    attractionTypes: [],
    amenities: [],
    sortBy: "newest",
  })

  // Ensure component is mounted to avoid hydration mismatches
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const filteredAndSortedAttractions = useMemo(() => {
    // Ensure attractions is an array
    if (!Array.isArray(attractions)) {
      return []
    }

    const filtered = attractions.filter((attraction) => {
      // Safety checks for required fields
      if (!attraction || !attraction.city || !attraction.country || !attraction.title) {
        return false
      }

      // Location filter
      if (filters.location) {
        const searchTerm = filters.location.toLowerCase()
        const matchesLocation =
          attraction.city.toLowerCase().includes(searchTerm) ||
          attraction.country.toLowerCase().includes(searchTerm) ||
          attraction.title.toLowerCase().includes(searchTerm)
        if (!matchesLocation) return false
      }

      // Guests filter
      if (Number.parseInt(filters.guests) > attraction.max_guests) return false

      // Price range filter
      if (attraction.price_per_night < filters.priceRange[0] || attraction.price_per_night > filters.priceRange[1])
        return false

      // Attraction type filter
      if (filters.attractionTypes.length > 0 && !filters.attractionTypes.includes(attraction.property_type)) return false

      // Amenities filter
      if (filters.amenities.length > 0) {
        const attractionAmenities = attraction.amenities || []
        const hasAllAmenities = filters.amenities.every((amenity) => attractionAmenities.includes(amenity))
        if (!hasAllAmenities) return false
      }

      return true
    })

    // Sort attractions
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "price_low":
          return a.price_per_night - b.price_per_night
        case "price_high":
          return b.price_per_night - a.price_per_night
        case "rating":
          return (b.avgRating || 0) - (a.avgRating || 0)
        case "reviews":
          return (b.reviewCount || 0) - (a.reviewCount || 0)
        case "newest":
        default:
          return 0 // Keep original order for newest
      }
    })

    return filtered
  }, [attractions, filters])

  const handleSearch = () => {
    // Search is handled by the filtering logic above
    // This could trigger additional actions like analytics
    console.log("Search triggered with filters:", filters)
  }

  // Prevent hydration issues by only rendering on client
  if (!isMounted) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <AttractionFilters
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={handleSearch}
            totalResults={filteredAndSortedAttractions.length}
          />
        </div>

        <div className="lg:col-span-3">
          {/* View Toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Grid View
              </Button>
              <Button variant={viewMode === "map" ? "default" : "outline"} size="sm" onClick={() => setViewMode("map")}>
                <Map className="h-4 w-4 mr-2" />
                Map View
              </Button>
            </div>
          </div>

          {viewMode === "map" ? (
            /* Map View */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredAndSortedAttractions.map((attraction) => (
                  <Card
                    key={attraction.id}
                    className={`cursor-pointer transition-all ${
                      selectedAttraction === attraction.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedAttraction(attraction.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex space-x-4">
                        <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                          {Array.isArray(attraction.images) && attraction.images.length > 0 ? (
                            <img
                              src={attraction.images[0] || "/placeholder.jpg"}
                              alt={attraction.title || 'Attraction'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <MapPin className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold line-clamp-1">{attraction.title}</h3>
                            {attraction.avgRating != null && attraction.avgRating > 0 && (
                              <div className="flex items-center space-x-1 text-sm">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span>{attraction.avgRating}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center text-sm text-muted-foreground mb-2">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span>
                              {attraction.city}, {attraction.country}
                            </span>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              <span>{attraction.max_guests}</span>
                            </div>
                            <div className="flex items-center">
                              <Bed className="h-4 w-4 mr-1" />
                              <span>{attraction.bedrooms}</span>
                            </div>
                            <div className="flex items-center">
                              <Bath className="h-4 w-4 mr-1" />
                              <span>{attraction.bathrooms}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold">${attraction.price_per_night}</span>
                              <span className="text-muted-foreground text-sm"> / night</span>
                            </div>
                            <Link href={`/attractions/${generateAttractionSlug({
                              city: attraction.city,
                              category: attraction.property_type,
                              title: attraction.title,
                              id: attraction.id
                            })}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="sticky top-8">
                <AttractionMap
                  attractions={filteredAndSortedAttractions}
                  selectedAttraction={selectedAttraction}
                  onAttractionSelect={setSelectedAttraction}
                  className="h-[600px]"
                />
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredAndSortedAttractions.map((attraction) => {
                const slug = generateAttractionSlug({
                  city: attraction.city,
                  category: attraction.property_type,
                  title: attraction.title,
                  id: attraction.id
                })
                
                return (
                  <AttractionCard
                    key={attraction.id}
                    id={attraction.id}
                    images={attraction.images || []}
                    title={attraction.title}
                    city={attraction.city}
                    region={attraction.region || attraction.city}
                    country={attraction.country}
                    rating={attraction.avgRating || 0}
                    reviewsCount={attraction.reviewCount || 0}
                    price={attraction.price_per_night}
                    priceUnit="noc"
                    href={`/attractions/${slug}`}
                  />
                )
              })}
            </div>
          )}

          {/* No Results */}
          {filteredAndSortedAttractions.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No attractions found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your search criteria or filters</p>
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      location: "",
                      checkIn: "",
                      checkOut: "",
                      guests: "1",
                      priceRange: [0, 1000],
                      ageRange: [0, 18],
                      attractionTypes: [],
                      amenities: [],
                      sortBy: "newest",
                    })
                  }
                >
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
