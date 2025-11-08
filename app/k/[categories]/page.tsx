"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { useUrlState } from "@/lib/search/url-state"
import PropertyMap from "@/components/property-map"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MapPin, Star } from "lucide-react"
import Link from "next/link"

interface SearchResult {
  id: string
  title: string
  city: string
  country: string
  latitude: number
  longitude: number
  price_per_night: number
  category_slug: string | null
  category_name: string | null
  avg_rating: number
}

interface SearchResponse {
  items: SearchResult[]
  total: number
  page: number
  per: number
}

export default function CategorySearchPage() {
  const params = useParams()
  const categoriesParam = params?.categories as string | undefined
  const { get, setMany } = useUrlState()
  
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const mapMoveEndTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Get current URL params
  const q = get("q") || ""
  const bbox = get("bbox") || ""
  const categories = get("categories") || ""
  const sort = get("sort") || "relevance"
  const page = parseInt(get("page") || "1", 10)
  const per = parseInt(get("per") || "20", 10)
  
  // Sync route param to query param on mount
  useEffect(() => {
    if (categoriesParam && categoriesParam !== categories) {
      setMany({ categories: categoriesParam })
    }
  }, [categoriesParam])
  
  // Fetch search results
  const fetchResults = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      if (bbox) params.set("bbox", bbox)
      if (categories) params.set("categories", categories)
      if (sort) params.set("sort", sort)
      params.set("page", String(page))
      params.set("per", String(per))
      
      const response = await fetch(`/api/search?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch results")
      }
      
      const data: SearchResponse = await response.json()
      setResults(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [q, bbox, categories, sort, page, per])
  
  useEffect(() => {
    fetchResults()
  }, [fetchResults])
  
  // Handle map initialization and moveend
  useEffect(() => {
    if (typeof window === "undefined") return
    
    const initMap = async () => {
      const L = (await import("leaflet")).default
      
      // Wait for map element to be available
      const mapElement = document.getElementById("search-map")
      if (!mapElement || mapInstance) return
      
      const map = L.map(mapElement, {
        center: [52.0, 19.0], // Center on Poland
        zoom: 6,
        zoomControl: true,
      })
      
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)
      
      // If bbox exists initially, fitBounds
      if (bbox) {
        const [west, south, east, north] = bbox.split(",").map(parseFloat)
        if (!isNaN(west) && !isNaN(south) && !isNaN(east) && !isNaN(north)) {
          map.fitBounds([
            [south, west],
            [north, east],
          ])
        }
      }
      
      // Handle map moveend with debounce
      map.on("moveend", () => {
        if (mapMoveEndTimerRef.current) {
          clearTimeout(mapMoveEndTimerRef.current)
        }
        
        mapMoveEndTimerRef.current = setTimeout(() => {
          const bounds = map.getBounds()
          const newBbox = [
            bounds.getWest().toFixed(6),
            bounds.getSouth().toFixed(6),
            bounds.getEast().toFixed(6),
            bounds.getNorth().toFixed(6),
          ].join(",")
          
          setMany({ bbox: newBbox, page: "1" }, { debounce: 300 })
        }, 300)
      })
      
      setMapInstance(map)
    }
    
    initMap()
    
    return () => {
      if (mapInstance) {
        mapInstance.remove()
      }
    }
  }, [])
  
  // Handle search input
  const handleSearchChange = (value: string) => {
    setMany({ q: value, page: "1" }, { debounce: 300 })
  }
  
  // Handle sort change
  const handleSortChange = (value: string) => {
    setMany({ sort: value, page: "1" })
  }
  
  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setMany({ page: String(newPage) })
  }
  
  // Transform results for PropertyMap component
  const mapProperties = results.map((item) => ({
    id: item.id,
    title: item.title,
    city: item.city,
    country: item.country,
    latitude: item.latitude,
    longitude: item.longitude,
    price_per_night: item.price_per_night,
    property_type: item.category_name || "Property",
    category_slug: item.category_slug,
    max_guests: 0,
    bedrooms: 0,
    bathrooms: 0,
    images: [],
    avgRating: item.avg_rating,
    reviewCount: 0,
  }))
  
  const totalPages = Math.ceil(total / per)
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">E</span>
            </div>
            <span className="text-xl font-bold">EnjoyHub</span>
          </Link>
        </div>
      </header>
      
      {/* Search & Filter Bar */}
      <div className="border-b bg-muted/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              type="text"
              placeholder="Search properties..."
              defaultValue={q}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1"
            />
            
            <Select value={sort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Main Content: List + Map */}
      <div className="flex h-[calc(100vh-180px)]">
        {/* Properties List - Left Half */}
        <div className="w-full md:w-1/2 overflow-y-auto p-4 md:p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-bold mb-2">
              {categories ? `Properties in ${categories.split(",").join(", ")}` : "Search Results"}
            </h1>
            <p className="text-muted-foreground">
              {loading ? "Loading..." : `${total} properties found`}
            </p>
          </div>
          
          {error && (
            <Card className="mb-4 border-destructive">
              <CardContent className="p-4 text-destructive">
                {error}
              </CardContent>
            </Card>
          )}
          
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {!loading && results.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No properties found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </CardContent>
            </Card>
          )}
          
          <div className="space-y-4">
            {results.map((property) => (
              <Link key={property.id} href={`/properties/${property.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{property.title}</h3>
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      {property.city}, {property.country}
                    </div>
                    {property.avg_rating > 0 && (
                      <div className="flex items-center text-sm mb-2">
                        <Star className="h-4 w-4 text-yellow-400 mr-1 fill-current" />
                        <span className="font-medium">{property.avg_rating.toFixed(1)}</span>
                      </div>
                    )}
                    {property.category_name && (
                      <div className="text-sm text-muted-foreground mb-2">
                        Category: {property.category_name}
                      </div>
                    )}
                    <div className="flex items-baseline">
                      <span className="text-xl font-bold">${property.price_per_night}</span>
                      <span className="text-sm text-muted-foreground ml-1">/night</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                Previous
              </Button>
              
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
        
        {/* Map - Right Half */}
        <div className="hidden md:block w-1/2 h-full border-l">
          <div id="search-map" className="w-full h-full" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        </div>
      </div>
    </div>
  )
}
