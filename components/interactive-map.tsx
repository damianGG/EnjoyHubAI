"use client"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface Property {
  id: string
  title: string
  category_name: string
  category_slug: string
  category_icon: string
  price_per_night: number
  latitude: number
  longitude: number
  images: string[]
}

interface InteractiveMapProps {
  selectedCategory?: string | null
  onPropertySelect?: (property: Property) => void
}

export function InteractiveMap({ selectedCategory, onPropertySelect }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const leafletRef = useRef<any>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  // Load properties from Supabase with caching
  useEffect(() => {
    const loadProperties = async () => {
      try {
        console.log("[v0] Loading properties with category:", selectedCategory)
        const supabase = createClient()

        const query = supabase
          .from("properties")
          .select(`
            id,
            title,
            price_per_night,
            latitude,
            longitude,
            images,
            category_id,
            categories (
              name,
              slug,
              icon
            )
          `)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .eq("is_active", true)

        const { data: allData, error: allError } = await query

        if (allError) {
          console.error("[v0] Error loading properties:", allError)
          return
        }

        console.log("[v0] Raw data loaded:", allData?.length || 0)

        // Filter by category on the client side if needed
        let filteredData = allData || []
        if (selectedCategory) {
          filteredData = allData?.filter((item: any) => item.categories?.slug === selectedCategory) || []
        }

        console.log("[v0] Filtered properties:", filteredData.length)

        const transformedData = filteredData.map((item: any) => ({
          id: item.id,
          title: item.title,
          category_name: item.categories?.name || "Unknown",
          category_slug: item.categories?.slug || "gaming",
          category_icon: item.categories?.icon || "gamepad",
          price_per_night: item.price_per_night,
          latitude: item.latitude,
          longitude: item.longitude,
          images: item.images || [],
        }))

        setProperties(transformedData)
      } catch (error) {
        console.error("[v0] Error fetching properties:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProperties()
  }, [selectedCategory])

  // Initialize map once and cache Leaflet instance
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstanceRef.current) return

    const initMap = async () => {
      // Dynamically import Leaflet only once
      if (!leafletRef.current) {
        leafletRef.current = (await import("leaflet")).default
      }
      const L = leafletRef.current

      // Fix default markers
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })

      // Initialize map centered on Poland
      const map = L.map(mapRef.current).setView([52.0693, 19.4803], 6)

      // Using CartoDB Voyager for clean, minimal design
      // Note: Shows local/native place names from OpenStreetMap data where available
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map)

      mapInstanceRef.current = map
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update markers when properties change - optimized with memoization
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined" || !leafletRef.current) return

    const updateMarkers = async () => {
      const L = leafletRef.current

      // Clear existing markers
      markersRef.current.forEach((marker) => {
        mapInstanceRef.current.removeLayer(marker)
      })
      markersRef.current = []

      // Add new markers
      properties.forEach((property) => {
        if (property.latitude && property.longitude) {
          // Create custom HTML marker with emoji icon from database
          const customIcon = L.divIcon({
            html: `
              <div class="bg-white rounded-full p-2 shadow-lg border-2 border-primary flex items-center justify-center w-10 h-10">
                <span class="text-2xl">${property.category_icon}</span>
              </div>
            `,
            className: "custom-marker",
            iconSize: [40, 40],
            iconAnchor: [20, 40],
          })

          const marker = L.marker([property.latitude, property.longitude], {
            icon: customIcon,
          }).addTo(mapInstanceRef.current)

          marker.bindPopup(`
            <div class="p-2">
              <h3 class="font-semibold text-sm mb-1">${property.title}</h3>
              <p class="text-xs text-gray-600 mb-2">${property.category_name}</p>
              <p class="text-sm font-medium">${property.price_per_night} zł / noc</p>
            </div>
          `)

          marker.on("click", () => {
            onPropertySelect?.(property)
          })

          markersRef.current.push(marker)
        }
      })
    }

    updateMarkers()
  }, [properties, onPropertySelect])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Ładowanie mapy...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
        <p className="text-xs font-medium">
          {properties.length} {selectedCategory ? "obiektów w kategorii" : "obiektów"}
        </p>
      </div>
    </div>
  )
}
