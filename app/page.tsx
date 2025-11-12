"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useUrlState } from "@/lib/search/url-state"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Map, List } from "lucide-react"
import { TopNav } from "@/components/top-nav"
import { CategoryBar } from "@/components/category-bar"
import AttractionCard from "@/components/AttractionCard"

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
  avg_rating: number
  images?: string[]
  region?: string
  review_count?: number
}

interface SearchResponse {
  items: SearchResult[]
  total: number
  page: number
  per: number
}

function HomePageContent() {
  const urlState = useUrlState()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [leaflet, setLeaflet] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInitializedRef = useRef(false)
  const isFirstRenderRef = useRef(true)
  
  // Mobile view state: 'list' or 'map'
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  
  // Track if we're on desktop - start as null to indicate not yet determined
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  
  // Search dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  
  // Track if we're on mobile and should disable bbox updates
  const shouldUpdateBboxRef = useRef(true)
  
  // Refs to hold latest router, searchParams, pathname for use in event handlers
  const routerRef = useRef(router)
  const searchParamsRef = useRef(searchParams)
  const pathnameRef = useRef(pathname)
  
  // Keep refs updated
  useEffect(() => {
    routerRef.current = router
    searchParamsRef.current = searchParams
    pathnameRef.current = pathname
  }, [router, searchParams, pathname])
  
  // Detect if we're on desktop/mobile
  useEffect(() => {
    const checkScreenSize = () => {
      const isDesktopSize = window.innerWidth >= 768
      setIsDesktop(isDesktopSize)
      // On desktop: always update bbox
      // On mobile: only update if in map view
      shouldUpdateBboxRef.current = isDesktopSize || mobileView === 'map'
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [mobileView])

  // Get URL params - categories come from query params, defaults to empty string (all categories)
  const categories = urlState.get("categories") || ""
  const q = urlState.get("q") || ""
  const bbox = urlState.get("bbox") || ""
  const sort = urlState.get("sort") || "relevance"
  const page = parseInt(urlState.get("page") || "1", 10)
  const per = parseInt(urlState.get("per") || "20", 10)
  const ageMin = urlState.get("age_min") || ""
  const ageMax = urlState.get("age_max") || ""

  // Calculate active filters count (excluding bbox and page/per)
  const activeFiltersCount = [
    q ? 1 : 0,
    ageMin ? 1 : 0,
    ageMax ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

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

  // Initialize Leaflet map - only when needed (desktop or mobile map view)
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInitializedRef.current) return
    
    // Wait until we know if we're desktop or mobile
    if (isDesktop === null) return
    
    // Only initialize map if:
    // 1. We're on desktop, OR
    // 2. We're on mobile AND user has switched to map view
    const shouldInitMap = isDesktop || mobileView === 'map'
    if (!shouldInitMap) return

    const initMap = async () => {
      const L = (await import("leaflet")).default
      setLeaflet(L)

      // Fix default marker icon - Leaflet requires this workaround to properly load marker icons
      // when using a bundler. See: https://github.com/Leaflet/Leaflet/issues/4968
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
          // Check if we should update bbox (ref updated by useEffect above)
          if (!shouldUpdateBboxRef.current) return
          
          const bounds = mapInstance.getBounds()
          const sw = bounds.getSouthWest()
          const ne = bounds.getNorthEast()
          
          // Format with 6 decimal places
          const newBbox = `${sw.lng.toFixed(6)},${sw.lat.toFixed(6)},${ne.lng.toFixed(6)},${ne.lat.toFixed(6)}`
          
          // Only update if bbox has changed significantly
          const currentBbox = searchParamsRef.current.get("bbox")
          if (newBbox !== currentBbox) {
            // Get current search params and preserve all parameters
            const currentParams = new URLSearchParams(searchParamsRef.current.toString())
            
            // Update bbox
            currentParams.set("bbox", newBbox)
            
            // Update URL with all preserved parameters (including categories if present)
            routerRef.current.replace(`${pathnameRef.current}?${currentParams.toString()}`, { scroll: false })
          }
        }, 600) // Increased debounce to 600ms
      })

      setMapInstance(mapInstance)
      mapInitializedRef.current = true

      // Only trigger initial moveend on desktop or if bbox already exists
      // Don't auto-trigger on mobile when first opening map view
      if (isDesktop && !bbox && isFirstRenderRef.current) {
        isFirstRenderRef.current = false
        setTimeout(() => {
          mapInstance.fire("moveend")
        }, 500)
      } else {
        isFirstRenderRef.current = false
      }
    }

    initMap()

    return () => {
      if (mapInstance) {
        mapInstance.remove()
      }
    }
  }, [isDesktop, mobileView])

  // Update map markers when results change
  useEffect(() => {
    if (!mapInstance || !leaflet) return

    // Clear existing markers
    markers.forEach((marker) => mapInstance.removeLayer(marker))

    // If no results, just clear markers and return
    if (!results.length) {
      setMarkers([])
      return
    }

    const newMarkers: any[] = []

    results.forEach((result) => {
      if (!result.latitude || !result.longitude) return

      const markerHtml = `
        <div class="bg-white rounded-full p-2 shadow-lg border-2 border-primary flex items-center justify-center w-10 h-10">
          <span class="text-2xl">${result.category_icon || '📍'}</span>
        </div>
      `

      const customIcon = leaflet.divIcon({
        html: markerHtml,
        className: "custom-leaflet-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })

      const marker = leaflet.marker([result.latitude, result.longitude], { icon: customIcon }).addTo(mapInstance)

      // Enhanced card-like popup with image
      const imageUrl = result.images && result.images.length > 0 ? result.images[0] : '/placeholder.svg?height=200&width=300'
      const popupContent = `
        <div class="min-w-[250px] max-w-[280px]">
          <div class="relative h-40 mb-2 rounded-lg overflow-hidden">
            <img src="${imageUrl}" alt="${result.title}" class="w-full h-full object-cover" />
          </div>
          <div class="space-y-1">
            <h3 class="font-semibold text-sm line-clamp-2">${result.title}</h3>
            <p class="text-xs text-gray-600">${result.city}, ${result.country}</p>
            <div class="flex items-center justify-between pt-1">
              ${result.avg_rating > 0 ? `
                <div class="flex items-center text-xs">
                  <span class="mr-1">⭐</span>
                  <span class="font-medium">${result.avg_rating.toFixed(1)}</span>
                  ${result.review_count ? `<span class="text-gray-500 ml-1">(${result.review_count})</span>` : ''}
                </div>
              ` : '<div></div>'}
              <div class="text-sm">
                <span class="font-bold">${result.price_per_night} zł</span>
                <span class="text-xs text-gray-500"> / noc</span>
              </div>
            </div>
          </div>
        </div>
      `

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      })
      newMarkers.push(marker)
    })

    setMarkers(newMarkers)
  }, [results, mapInstance, leaflet])

  // Invalidate map size when switching to map view
  useEffect(() => {
    if (mapInstance && mobileView === 'map') {
      // Small delay to ensure the container is visible and has dimensions
      setTimeout(() => {
        mapInstance.invalidateSize()
      }, 100)
    }
  }, [mobileView, mapInstance])

  // Handler for category selection
  const handleCategorySelect = (categorySlug: string | null) => {
    urlState.setMany({ categories: categorySlug || "", page: 1 })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <TopNav 
        searchDialogOpen={searchDialogOpen}
        onSearchDialogChange={setSearchDialogOpen}
      />

      {/* Category Bar */}
      <CategoryBar 
        selectedCategory={categories || undefined}
        onCategorySelect={handleCategorySelect}
        onFiltersClick={() => setSearchDialogOpen(true)}
        activeFiltersCount={activeFiltersCount}
      />

      {/* Main content: Results + Map */}
      <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] relative">
        {/* Results List */}
        <div className={`w-full md:w-1/2 h-full overflow-y-auto ${isDesktop === false && mobileView === 'map' ? 'hidden' : ''}`}>
          <div className="p-4 md:p-6">
            <div className="mb-4">
              <h1 className="text-xl md:text-2xl font-bold mb-2">
                {categories && categories !== "all" 
                  ? `Exploring: ${categories.split(",").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}` 
                  : "All Properties"}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {loading ? "Loading..." : `${total} properties found`}
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                {results.map((result) => (
                  <AttractionCard
                    key={result.id}
                    id={result.id}
                    images={result.images || []}
                    title={result.title}
                    city={result.city}
                    region={result.region || result.category_name || ''}
                    country={result.country}
                    rating={result.avg_rating || 0}
                    reviewsCount={result.review_count || 0}
                    price={result.price_per_night}
                    priceUnit="noc"
                    href={`/properties/${result.id}`}
                  />
                ))}

                {/* Pagination */}
                {total > per && (
                  <div className="col-span-full flex items-center justify-center space-x-2 pt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => urlState.setMany({ page: page - 1 })}
                    >
                      Previous
                    </Button>
                    <span className="text-xs md:text-sm text-muted-foreground">
                      Page {page} of {Math.ceil(total / per)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Math.ceil(total / per)}
                      onClick={() => urlState.setMany({ page: page + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm md:text-base text-muted-foreground">No properties found. Try adjusting your filters or search area.</p>
              </div>
            )}
          </div>
        </div>

        {/* Map - Desktop: always visible on right side, Mobile: overlay when map view active */}
        {isDesktop !== null && (
          <div className={`${
            isDesktop 
              ? 'w-1/2 h-full relative' 
              : `fixed inset-0 top-[140px] z-40 ${mobileView === 'list' ? 'hidden' : ''}`
          }`}>
            <div ref={mapRef} className="w-full h-full" />
            <style jsx global>{`
              .leaflet-container {
                height: 100%;
                width: 100%;
                z-index: 0;
              }
              .custom-leaflet-marker {
                background: transparent;
                border: none;
              }
              .custom-popup .leaflet-popup-content-wrapper {
                border-radius: 12px;
                padding: 8px;
              }
              .custom-popup .leaflet-popup-content {
                margin: 0;
                line-height: 1.4;
              }
              .line-clamp-2 {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }
            `}</style>
          </div>
        )}
        
        {/* Floating toggle button - Only visible on mobile */}
        {isDesktop === false && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <Button
              onClick={() => setMobileView(mobileView === 'list' ? 'map' : 'list')}
              className="shadow-lg px-6 py-6 rounded-full flex items-center space-x-2"
              size="lg"
            >
              {mobileView === 'list' ? (
                <>
                  <Map className="h-5 w-5" />
                  <span className="font-medium">Mapa</span>
                </>
              ) : (
                <>
                  <List className="h-5 w-5" />
                  <span className="font-medium">Lista</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <HomePageContent />
    </Suspense>
  )
}
