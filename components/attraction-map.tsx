"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Maximize2, Minimize2, X } from "lucide-react"
import { generateAttractionSlug } from "@/lib/utils"
import AttractionCard from "@/components/AttractionCard"

interface Attraction {
  id: string
  title: string
  city: string
  country: string
  latitude?: number
  longitude?: number
  price_per_night: number
  property_type: string
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  max_guests: number
  bedrooms: number
  bathrooms: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
}

interface AttractionMapProps {
  attractions: Attraction[]
  selectedAttraction?: string | null
  onAttractionSelect?: (attractionId: string | null) => void
  className?: string
}

// Mock coordinates for demo purposes - in real app these would come from geocoding
const getMockCoordinates = (city: string, country: string) => {
  const locations: Record<string, [number, number]> = {
    "New York, United States": [40.7128, -74.006],
    "London, United Kingdom": [51.5074, -0.1278],
    "Paris, France": [48.8566, 2.3522],
    "Tokyo, Japan": [35.6762, 139.6503],
    "Sydney, Australia": [-33.8688, 151.2093],
    "Berlin, Germany": [52.52, 13.405],
    "Barcelona, Spain": [41.3851, 2.1734],
    "Amsterdam, Netherlands": [52.3676, 4.9041],
  }

  const key = `${city}, ${country}`
  return locations[key] || [40.7128 + (Math.random() - 0.5) * 0.1, -74.006 + (Math.random() - 0.5) * 0.1]
}

export default function AttractionMap({ attractions, selectedAttraction, onAttractionSelect, className }: AttractionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const leafletRef = useRef<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hoveredAttraction, setHoveredAttraction] = useState<string | null>(null)
  const [popupAttraction, setPopupAttraction] = useState<Attraction | null>(null)

  // Initialize map once - optimized to load Leaflet only once
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || map) return

    const initMap = async () => {
      // Cache Leaflet instance to avoid re-importing
      if (!leafletRef.current) {
        leafletRef.current = (await import("leaflet")).default
      }
      const L = leafletRef.current

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })

      const mapInstance = L.map(mapRef.current!, {
        center: [40.7128, -74.006],
        zoom: 10,
        zoomControl: true,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(mapInstance)

      setMap(mapInstance)
    }

    initMap()

    return () => {
      if (map) {
        map.remove()
      }
    }
  }, [])

  // Update markers - optimized to use cached Leaflet instance
  useEffect(() => {
    if (!map || !leafletRef.current || !attractions.length) return

    const L = leafletRef.current
    markers.forEach((marker) => map.removeLayer(marker))

    const newMarkers: any[] = []
    const bounds = L.latLngBounds([])

    attractions.forEach((attraction) => {
      const [lat, lng] =
        attraction.latitude && attraction.longitude
          ? [attraction.latitude, attraction.longitude]
          : getMockCoordinates(attraction.city, attraction.country)

      bounds.extend([lat, lng])

      const isSelected = selectedAttraction === attraction.id
      const isHovered = hoveredAttraction === attraction.id
      
      // Generate slug for the attraction
      const slug = generateAttractionSlug({
        city: attraction.city,
        category: attraction.property_type,
        title: attraction.title,
        id: attraction.id
      })

      const markerHtml = attraction.category_image_url
        ? `
          <div class="bg-white rounded-full p-1 shadow-lg border-2 ${
            isSelected ? "border-blue-500" : isHovered ? "border-gray-400" : "border-gray-200"
          } ${isSelected || isHovered ? "scale-110" : ""} transition-all duration-200 flex items-center justify-center w-10 h-10 overflow-hidden">
            <img src="${attraction.category_image_url}" alt="${attraction.category_slug || 'Category'}" class="w-full h-full object-cover rounded-full" />
          </div>
        `
        : `
          <div class="bg-white rounded-full p-2 shadow-lg border-2 ${
            isSelected ? "border-blue-500" : isHovered ? "border-gray-400" : "border-gray-200"
          } ${isSelected || isHovered ? "scale-110" : ""} transition-all duration-200 flex items-center justify-center w-10 h-10">
            <span class="text-2xl">${attraction.category_icon || '📍'}</span>
          </div>
        `

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-leaflet-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map)

      marker.on("click", () => {
        onAttractionSelect?.(attraction.id)
        setPopupAttraction(attraction)
      })

      newMarkers.push(marker)
    })

    setMarkers(newMarkers)

    if (attractions.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
      })
    }
  }, [map, attractions, selectedAttraction, hoveredAttraction])

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (!attractions.length) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No attractions to display on map</p>
        </CardContent>
      </Card>
    )
  }

  // Determine if parent wants full height based on className
  const useFullHeight = className?.split(/\s+/).includes("h-full")
  
  // Determine map height class and style
  const shouldFillHeight = isFullscreen || useFullHeight
  const mapHeightClass = shouldFillHeight ? "h-full" : "h-96"
  const mapMinHeight = isFullscreen ? "calc(100vh - 2rem)" : useFullHeight ? "100%" : "384px"

  return (
    <>
      <Card className={`${className} ${isFullscreen ? "fixed inset-4 z-50" : ""} transition-all duration-300`}>
        <CardContent className="p-0 relative h-full">
          <div className="absolute top-4 right-4 z-10 space-x-2">
            <Button variant="secondary" size="sm" onClick={toggleFullscreen} className="bg-white/90 backdrop-blur-sm">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          <div
            ref={mapRef}
            className={`w-full ${mapHeightClass} rounded-lg`}
            style={{ minHeight: mapMinHeight }}
          />

          <div className="absolute bottom-4 left-4 z-10">
            <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm">
              {attractions.length} attractions
            </Badge>
          </div>

          {/* Popup Card Overlay */}
          {popupAttraction && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-[400px]">
              <div className="relative bg-white rounded-lg shadow-2xl">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-30 h-8 w-8 rounded-full bg-white/90 hover:bg-white shadow-md"
                  onClick={() => setPopupAttraction(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <AttractionCard
                  id={popupAttraction.id}
                  images={popupAttraction.images || []}
                  title={popupAttraction.title}
                  city={popupAttraction.city}
                  region={popupAttraction.country}
                  country={popupAttraction.country}
                  rating={popupAttraction.avgRating || 0}
                  reviewsCount={popupAttraction.reviewCount || 0}
                  price={popupAttraction.price_per_night}
                  priceUnit="noc"
                  href={`/attractions/${generateAttractionSlug({
                    city: popupAttraction.city,
                    category: popupAttraction.property_type,
                    title: popupAttraction.title,
                    id: popupAttraction.id
                  })}`}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isFullscreen && <div className="fixed inset-0 bg-black/50 z-40" onClick={toggleFullscreen} />}

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    </>
  )
}
