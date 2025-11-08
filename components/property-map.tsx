"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Maximize2, Minimize2 } from "lucide-react"

interface Property {
  id: string
  title: string
  city: string
  country: string
  latitude?: number
  longitude?: number
  price_per_night: number
  property_type: string
  category_slug?: string | null
  max_guests: number
  bedrooms: number
  bathrooms: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
}

interface PropertyMapProps {
  properties: Property[]
  selectedProperty?: string | null
  onPropertySelect?: (propertyId: string | null) => void
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

// Helper function to get SVG path for category icons
const getIconSVG = (category: string | null | undefined) => {
  const iconPaths: Record<string, string> = {
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
  return iconPaths[category || "gaming"] || iconPaths.gaming
}

export default function PropertyMap({ properties, selectedProperty, onPropertySelect, className }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [leaflet, setLeaflet] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hoveredProperty, setHoveredProperty] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return

    const initMap = async () => {
      const L = (await import("leaflet")).default
      setLeaflet(L)

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
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

  useEffect(() => {
    if (!map || !leaflet || !properties.length) return

    markers.forEach((marker) => map.removeLayer(marker))

    const newMarkers: any[] = []
    const bounds = leaflet.latLngBounds([])

    properties.forEach((property) => {
      const [lat, lng] =
        property.latitude && property.longitude
          ? [property.latitude, property.longitude]
          : getMockCoordinates(property.city, property.country)

      bounds.extend([lat, lng])

      const isSelected = selectedProperty === property.id
      const isHovered = hoveredProperty === property.id

      const markerHtml = `
        <div class="bg-white rounded-full p-2 shadow-lg border-2 ${
          isSelected ? "border-blue-500" : isHovered ? "border-gray-400" : "border-gray-200"
        } ${isSelected || isHovered ? "scale-110" : ""} transition-all duration-200 flex items-center justify-center w-10 h-10">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${getIconSVG(property.category_slug)}
          </svg>
        </div>
      `

      const customIcon = leaflet.divIcon({
        html: markerHtml,
        className: "custom-leaflet-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })

      const marker = leaflet.marker([lat, lng], { icon: customIcon }).addTo(map)

      marker.on("click", () => {
        onPropertySelect?.(property.id)
      })

      const popupContent = `
        <div class="p-3 min-w-[280px] max-w-[320px]">
          <div class="aspect-video mb-3 rounded-lg overflow-hidden">
            <img src="${property.images?.[0] || "/placeholder.svg?height=150&width=280"}" 
                 alt="${property.title}" 
                 class="w-full h-full object-cover" />
          </div>
          <h3 class="font-semibold text-base mb-2 line-clamp-2">${property.title}</h3>
          <p class="text-sm text-gray-600 mb-3 flex items-center">
            <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
            </svg>
            ${property.city}, ${property.country}
          </p>
          <div class="flex items-center justify-between text-sm mb-3">
            <div class="flex items-center space-x-3 text-gray-600">
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8A6 6 0 006 8c0 7-3 9-3 9s3-2 3-9a6 6 0 0112 0c0 7 3 9 3 9s-3-2-3-9z"></path>
                </svg>
                ${property.max_guests} guests
              </span>
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.84L7.25 9.035 14.394 6.92a1 1 0 00.788-1.84l-7-3z"></path>
                </svg>
                ${property.bedrooms} bed
              </span>
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"></path>
                </svg>
                ${property.bathrooms} bath
              </span>
            </div>
            ${
              property.avgRating
                ? `
              <div class="flex items-center">
                <svg class="w-4 h-4 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <span class="text-sm font-medium">${property.avgRating}</span>
                <span class="text-xs text-gray-500 ml-1">(${property.reviewCount})</span>
              </div>
            `
                : ""
            }
          </div>
          <div class="flex items-center justify-between pt-3 border-t">
            <div>
              <span class="font-bold text-lg">$${property.price_per_night}</span>
              <span class="text-gray-600 text-sm">/night</span>
            </div>
            <a href="/properties/${property.id}" 
               class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              View Details
            </a>
          </div>
        </div>
      `

      marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: "custom-popup",
      })

      newMarkers.push(marker)
    })

    setMarkers(newMarkers)

    if (properties.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
      })
    }
  }, [map, leaflet, properties, selectedProperty, hoveredProperty])

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (!properties.length) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No properties to display on map</p>
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
              {properties.length} properties
            </Badge>
          </div>
        </CardContent>
      </Card>

      {isFullscreen && <div className="fixed inset-0 bg-black/50 z-40" onClick={toggleFullscreen} />}

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    </>
  )
}
