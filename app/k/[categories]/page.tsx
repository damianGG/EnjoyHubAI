"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useParams } from "next/navigation"
import { useUrlState } from "@/lib/search/url-state"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, MapPin, Star, Loader2 } from "lucide-react"
import Link from "next/link"

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
  avg_rating: number
}

interface SearchResponse {
  items: SearchResult[]
  total: number
  page: number
  per: number
}

function SearchPageContent() {
  const params = useParams()
  const urlState = useUrlState()
  
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [leaflet, setLeaflet] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInitializedRef = useRef(false)
  const isFirstRenderRef = useRef(true)

  // Get URL params
  const categoriesParam = params.categories as string || ""
  // Handle "all" as empty categories
  const categories = categoriesParam === "all" ? "" : categoriesParam
  const q = urlState.get("q") || ""
  const bbox = urlState.get("bbox") || ""
  const sort = urlState.get("sort") || "relevance"
  const page = parseInt(urlState.get("page") || "1", 10)
  const per = parseInt(urlState.get("per") || "20", 10)

  // Sync categories to query param on mount
  useEffect(() => {
    if (categories && categories !== "all" && !urlState.get("categories")) {
      urlState.set("categories", categories)
    }
  }, [categories])

  // Fetch results when search params change
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      try {
        const searchParams = new URLSearchParams()
        if (q) searchParams.set("q", q)
        if (bbox) searchParams.set("bbox", bbox)
        if (categories) searchParams.set("categories", categories)
        if (sort) searchParams.set("sort", sort)
        searchParams.set("page", String(page))
        searchParams.set("per", String(per))

        const response = await fetch(`/api/search?${searchParams.toString()}`)
        if (response.ok) {
          const data: SearchResponse = await response.json()
          setResults(data.items)
          setTotal(data.total)
        } else {
          console.error("Failed to fetch results")
          setResults([])
          setTotal(0)
        }
      } catch (error) {
        console.error("Error fetching results:", error)
        setResults([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [q, bbox, categories, sort, page, per])

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInitializedRef.current) return

    const initMap = async () => {
      const L = (await import("leaflet")).default
      setLeaflet(L)

      // Fix default marker icon
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })

      // Default center on Poland
      const mapInstance = L.map(mapRef.current!, {
        center: [52.0, 19.0], // Poland center
        zoom: 6,
        zoomControl: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance)

      // If bbox exists in URL, fit to bbox
      if (bbox) {
        const parts = bbox.split(",").map((s) => parseFloat(s))
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
          const [west, south, east, north] = parts
          mapInstance.fitBounds([[south, west], [north, east]])
        }
      }

      // Listen to moveend event with debounce
      let moveTimeout: NodeJS.Timeout | null = null
      mapInstance.on("moveend", () => {
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
          const bounds = mapInstance.getBounds()
          const sw = bounds.getSouthWest()
          const ne = bounds.getNorthEast()
          
          // Format with 6 decimal places
          const newBbox = `${sw.lng.toFixed(6)},${sw.lat.toFixed(6)},${ne.lng.toFixed(6)},${ne.lat.toFixed(6)}`
          
          // Only update if bbox has changed significantly
          const currentBbox = urlState.get("bbox")
          if (newBbox !== currentBbox) {
            urlState.setMany({ bbox: newBbox, page: 1 }, { debounce: true, debounceMs: 300 })
          }
        }, 300)
      })

      setMapInstance(mapInstance)
      mapInitializedRef.current = true

      // Trigger initial moveend if no bbox in URL
      if (!bbox && isFirstRenderRef.current) {
        isFirstRenderRef.current = false
        setTimeout(() => {
          mapInstance.fire("moveend")
        }, 500)
      }
    }

    initMap()

    return () => {
      if (mapInstance) {
        mapInstance.remove()
      }
    }
  }, [])

  // Update map markers when results change
  useEffect(() => {
    if (!mapInstance || !leaflet || !results.length) return

    // Clear existing markers
    markers.forEach((marker) => mapInstance.removeLayer(marker))

    const newMarkers: any[] = []

    results.forEach((result) => {
      if (!result.latitude || !result.longitude) return

      const markerHtml = `
        <div class="relative cursor-pointer">
          <div class="bg-white rounded-full p-1 shadow-lg border-2 border-gray-200 transition-all duration-200">
            <div class="px-2 py-1 bg-primary rounded-full flex items-center justify-center min-w-[40px]">
              <span class="text-primary-foreground text-xs font-bold">$${result.price_per_night}</span>
            </div>
          </div>
        </div>
      `

      const customIcon = leaflet.divIcon({
        html: markerHtml,
        className: "custom-leaflet-marker",
        iconSize: [60, 40],
        iconAnchor: [30, 40],
      })

      const marker = leaflet.marker([result.latitude, result.longitude], { icon: customIcon }).addTo(mapInstance)

      const popupContent = `
        <div class="p-2">
          <h3 class="font-semibold text-sm mb-1">${result.title}</h3>
          <p class="text-xs text-gray-600">${result.city}, ${result.country}</p>
          <p class="text-xs font-bold mt-1">$${result.price_per_night}/night</p>
          ${result.avg_rating > 0 ? `<p class="text-xs mt-1">⭐ ${result.avg_rating}</p>` : ""}
        </div>
      `

      marker.bindPopup(popupContent)
      newMarkers.push(marker)
    })

    setMarkers(newMarkers)
  }, [results, mapInstance, leaflet])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">E</span>
              </div>
              <span className="text-xl font-bold">EnjoyHub</span>
            </Link>

            <div className="flex items-center space-x-4 flex-1 max-w-2xl mx-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search properties..."
                  value={q}
                  onChange={(e) => urlState.setMany({ q: e.target.value, page: 1 }, { debounce: true, debounceMs: 500 })}
                  className="pl-10"
                />
              </div>

              <Select value={sort} onValueChange={(value) => urlState.setMany({ sort: value, page: 1 })}>
                <SelectTrigger className="w-[180px]">
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
      </header>

      {/* Main content: Results + Map */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Results List - Left Half */}
        <div className="w-1/2 overflow-y-auto">
          <div className="p-6">
            <div className="mb-4">
              <h1 className="text-2xl font-bold mb-2">
                {categories && categories !== "all" 
                  ? `Exploring: ${categories.split(",").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}` 
                  : "All Properties"}
              </h1>
              <p className="text-muted-foreground">
                {loading ? "Loading..." : `${total} properties found`}
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                {results.map((result) => (
                  <Card key={result.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <Link href={`/properties/${result.id}`}>
                        <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors">
                          {result.title}
                        </h3>
                      </Link>
                      
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <MapPin className="h-4 w-4 mr-1" />
                        {result.city}, {result.country}
                      </div>

                      {result.category_name && (
                        <div className="text-sm text-muted-foreground mb-2">
                          Category: {result.category_name}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {result.avg_rating > 0 && (
                            <div className="flex items-center text-sm">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                              {result.avg_rating}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-lg font-bold">
                          ${result.price_per_night}
                          <span className="text-sm font-normal text-muted-foreground">/night</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                {total > per && (
                  <div className="flex items-center justify-center space-x-2 pt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => urlState.set("page", page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {Math.ceil(total / per)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Math.ceil(total / per)}
                      onClick={() => urlState.set("page", page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No properties found. Try adjusting your filters or search area.</p>
              </div>
            )}
          </div>
        </div>

        {/* Map - Right Half */}
        <div className="w-1/2 h-full border-l relative">
          <div ref={mapRef} className="w-full h-full" />
          <style jsx global>{`
            .leaflet-container {
              height: 100%;
              width: 100%;
            }
            .custom-leaflet-marker {
              background: transparent;
              border: none;
            }
          `}</style>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  )
}
