"use client"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Gamepad2, Music, Camera, UtensilsCrossed, Dumbbell, Palette, Car, TreePine } from "lucide-react"


// Define category icons mapping
const categoryIcons = {
  gaming: Gamepad2,
  music: Music,
  photography: Camera,
  food: UtensilsCrossed,
  fitness: Dumbbell,
  art: Palette,
  automotive: Car,
  nature: TreePine,
}

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
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  // Load properties from Supabase
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

  // Initialize map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return

    const initMap = async () => {
      // Dynamically import Leaflet
      const L = (await import("leaflet")).default

      // Fix default markers
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }

      // Initialize map centered on Poland
      const map = L.map(mapRef.current).setView([52.0693, 19.4803], 6)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
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

  // Update markers when properties change
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined") return

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default

      // Clear existing markers
      markersRef.current.forEach((marker) => {
        mapInstanceRef.current.removeLayer(marker)
      })
      markersRef.current = []

      // Add new markers
      properties.forEach((property) => {
        if (property.latitude && property.longitude) {
          const IconComponent = categoryIcons[property.category_slug as keyof typeof categoryIcons] || Gamepad2

          // Create custom HTML marker
          const customIcon = L.divIcon({
            html: `
              <div class="bg-white rounded-full p-2 shadow-lg border-2 border-primary flex items-center justify-center w-10 h-10">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  ${getIconSVG(property.category_slug)}
                </svg>
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

  // Helper function to get SVG path for icons
  const getIconSVG = (category: string) => {
    const iconPaths = {
      gaming:
        '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>',
      music:
        '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3-2zM9 10l12-3"/>',
      photography:
        '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>',
      food: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16l3-1m-3 1l-3-1"/>',
      fitness:
        '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12"/>',
      art: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2a2 2 0 002-2V5a2 2 0 00-2-2z"/>',
      automotive:
        '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 6H4L2 4H1m4 8V9a1 1 0 011-1h1m0 0l1.68-2.55A2 2 0 0110.43 5h1.14a2 2 0 011.75 1.05L15 9m0 0h4a1 1 0 011 1v2M9 17h6"/>',
      nature:
        '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2z"/>',
    }
    return iconPaths[category as keyof typeof iconPaths] || iconPaths.gaming
  }

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
