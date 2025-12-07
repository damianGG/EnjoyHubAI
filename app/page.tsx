"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useUrlState } from "@/lib/search/url-state"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Map, List, X } from "lucide-react"
import { TopNav } from "@/components/top-nav"
import { BottomNav } from "@/components/bottom-nav"
import { SearchDialog } from "@/components/search-dialog"
import { CategoryBar } from "@/components/category-bar"
import { AuthSheet } from "@/components/auth-sheet"
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
  const leafletRef = useRef<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInitializedRef = useRef(false)
  const isFirstRenderRef = useRef(true)
  const [popupAttraction, setPopupAttraction] = useState<SearchResult | null>(null)
  
  // Mobile view state: 'list' or 'map'
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  
  // Track if we're on desktop - start as null to indicate not yet determined
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  
  // Search dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  
  // Auth sheet state for protected route redirects
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [returnToPath, setReturnToPath] = useState<string | null>(null)
  
  // Track header height for mobile map positioning
  const [headerHeight, setHeaderHeight] = useState(140)
  const headerRef = useRef<HTMLDivElement>(null)
  
  // Track if we're on mobile and should disable bbox updates
  const shouldUpdateBboxRef = useRef(true)
  
  // Track scroll state for compact category bar
  const [isScrolled, setIsScrolled] = useState(false)
  const resultsContainerRef = useRef<HTMLDivElement>(null)
  
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
  
  // Check for login requirement from protected route redirect
  useEffect(() => {
    const loginRequired = searchParams.get("login")
    const returnTo = searchParams.get("returnTo")
    
    if (loginRequired === "required") {
      setAuthSheetOpen(true)
      setReturnToPath(returnTo)
      
      // Clean up URL parameters
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete("login")
      newSearchParams.delete("returnTo")
      router.replace(`${pathname}?${newSearchParams.toString()}`, { scroll: false })
    }
  }, [searchParams, pathname, router])
  
  // Get URL params - categories come from query params, defaults to empty string (all categories)
  const categories = urlState.get("categories") || ""
  const q = urlState.get("q") || ""
  const bbox = urlState.get("bbox") || ""
  const sort = urlState.get("sort") || "relevance"
  const page = parseInt(urlState.get("page") || "1", 10)
  const per = parseInt(urlState.get("per") || "20", 10)
  const ageMin = urlState.get("age_min") || ""
  const ageMax = urlState.get("age_max") || ""
  const date = urlState.get("date") || ""

  // Calculate active filters count (excluding bbox and page/per)
  const activeFiltersCount = [
    q ? 1 : 0,
    ageMin ? 1 : 0,
    ageMax ? 1 : 0,
    date ? 1 : 0,
  ].reduce((a, b) => a + b, 0)
  
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

  // Update header height when layout changes
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight
        setHeaderHeight(height)
      }
    }
    
    // Update on mount and when categories/subcategories change
    updateHeaderHeight()
    
    // Use ResizeObserver to detect height changes
    const observer = new ResizeObserver(updateHeaderHeight)
    if (headerRef.current) {
      observer.observe(headerRef.current)
    }
    
    return () => observer.disconnect()
  }, [categories])

  // Detect scroll on results container to enable compact mode
  useEffect(() => {
    const handleScroll = () => {
      if (resultsContainerRef.current) {
        const scrollTop = resultsContainerRef.current.scrollTop
        setIsScrolled(scrollTop > 50)
      }
    }
    
    const container = resultsContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [])

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
        if (date) searchParams.set("date", date)
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
  }, [q, bbox, categories, sort, page, per, date])

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
      // Cache Leaflet to avoid re-importing on every render
      if (!leafletRef.current) {
        leafletRef.current = (await import("leaflet")).default
      }
      const L = leafletRef.current

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

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
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

  // Update map markers when results change - optimized
  useEffect(() => {
    if (!mapInstance || !leafletRef.current) return

    const L = leafletRef.current

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

      // Determine marker content with priority: subcategory image > subcategory icon > category image > category icon
      const markerHtml = result.subcategory_image_url 
        ? `
          <div class="bg-white rounded-full p-1 shadow-lg border-2 border-primary flex items-center justify-center w-10 h-10 overflow-hidden">
            <img src="${result.subcategory_image_url}" alt="${result.subcategory_name || 'Subcategory'}" class="w-full h-full object-cover rounded-full" />
          </div>
        `
        : result.subcategory_icon
        ? `
          <div class="bg-white rounded-full p-2 shadow-lg border-2 border-primary flex items-center justify-center w-10 h-10">
            <span class="text-2xl">${result.subcategory_icon}</span>
          </div>
        `
        : result.category_image_url 
        ? `
          <div class="bg-white rounded-full p-1 shadow-lg border-2 border-primary flex items-center justify-center w-10 h-10 overflow-hidden">
            <img src="${result.category_image_url}" alt="${result.category_name || 'Category'}" class="w-full h-full object-cover rounded-full" />
          </div>
        `
        : `
          <div class="bg-white rounded-full p-2 shadow-lg border-2 border-primary flex items-center justify-center w-10 h-10">
            <span class="text-2xl">${result.category_icon || '📍'}</span>
          </div>
        `

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-leaflet-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })

      const marker = L.marker([result.latitude, result.longitude], { icon: customIcon }).addTo(mapInstance)

      // Set popup attraction on click
      marker.on("click", () => {
        setPopupAttraction(result)
      })

      newMarkers.push(marker)
    })

    setMarkers(newMarkers)
  }, [results, mapInstance])

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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header with TopNav and CategoryBar */}
      <div ref={headerRef} className="sticky top-0 z-50">
        {/* Top Navigation Bar with Large Search Button */}
        <TopNav onSearchClick={() => setSearchDialogOpen(true)} />

        {/* Category Bar */}
        <CategoryBar 
          selectedCategory={categories || undefined}
          onCategorySelect={handleCategorySelect}
          onFiltersClick={() => setSearchDialogOpen(true)}
          activeFiltersCount={activeFiltersCount}
          compact={isScrolled}
        />
      </div>

      {/* Search Dialog */}
      <SearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} />

      {/* Main content: Results + Map */}
      <div className="flex flex-col md:flex-row relative" style={{ height: `calc(100vh - ${headerHeight}px)` }}>
        {/* Results List */}
        <div 
          ref={resultsContainerRef}
          className={`w-full md:w-1/2 h-full overflow-y-auto ${isDesktop === false && mobileView === 'map' ? 'hidden' : ''}`}
        >
          <div>
            <div className="mb-4">
              <h1 className="text-xl md:text-2xl font-bold mb-2">
                {categories && categories !== "all" 
                  ? `Exploring: ${categories.split(",").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}` 
                  : "All Attractions"}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {loading ? "Loading..." : `${total} attractions found`}
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <AttractionCardSkeleton key={index} />
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                {results.map((result) => {
                  const slug = generateAttractionSlug({
                    city: result.city,
                    category: result.category_slug,
                    title: result.title,
                    id: result.id
                  })
                  
                  return (
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
                      href={`/attractions/${slug}`}
                      nextAvailableSlot={result.next_available_slot}
                      priceFrom={result.price_from}
                      coverImageUrl={result.cover_image_url}
                    />
                  )
                })}

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
                <p className="text-sm md:text-base text-muted-foreground">No attractions found. Try adjusting your filters or search area.</p>
              </div>
            )}
          </div>
        </div>

        {/* Map - Desktop: always visible on right side, Mobile: overlay when map view active */}
        {isDesktop !== null && (
          <div 
            className={`${
              isDesktop 
                ? 'w-1/2 h-full relative' 
                : `fixed inset-x-0 bottom-0 z-40 ${mobileView === 'list' ? 'hidden' : ''}`
            }`}
            style={!isDesktop ? { top: `${headerHeight}px` } : undefined}
          >
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Popup Card Overlay */}
            {popupAttraction && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-[400px]">
                <div className="relative bg-white rounded-lg shadow-2xl">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-[1001] h-8 w-8 rounded-full bg-white/90 hover:bg-white shadow-md"
                    onClick={() => setPopupAttraction(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <AttractionCard
                    id={popupAttraction.id}
                    images={popupAttraction.images || []}
                    title={popupAttraction.title}
                    city={popupAttraction.city}
                    region={popupAttraction.region || popupAttraction.category_name || ''}
                    country={popupAttraction.country}
                    rating={popupAttraction.avg_rating || 0}
                    reviewsCount={popupAttraction.review_count || 0}
                    price={popupAttraction.price_per_night}
                    priceUnit="noc"
                    href={`/attractions/${generateAttractionSlug({
                      city: popupAttraction.city,
                      category: popupAttraction.category_slug,
                      title: popupAttraction.title,
                      id: popupAttraction.id
                    })}`}
                    nextAvailableSlot={popupAttraction.next_available_slot}
                    priceFrom={popupAttraction.price_from}
                    coverImageUrl={popupAttraction.cover_image_url}
                  />
                </div>
              </div>
            )}
            
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
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
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

      {/* Auth Sheet for protected route redirects */}
      <AuthSheet
        open={authSheetOpen}
        onOpenChange={(open) => {
          setAuthSheetOpen(open)
          if (!open) {
            setReturnToPath(null)
          }
        }}
        mode="login"
        onModeChange={() => {}}
        returnToPath={returnToPath}
      />

      {/* Bottom Navigation Bar */}
      <BottomNav onSearchClick={() => setSearchDialogOpen(true)} />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <div className="sticky top-0 z-50">
          <div className="bg-card">
            <div className="container mx-auto px-4 h-16"></div>
          </div>
          <div className="bg-card">
            <div className="container mx-auto px-4 h-14"></div>
          </div>
        </div>
        <div>
          <div className="mb-4">
            <div className="h-8 w-48 bg-muted/20 animate-pulse rounded-md mb-2"></div>
            <div className="h-5 w-32 bg-muted/20 animate-pulse rounded-md"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <AttractionCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  )
}
