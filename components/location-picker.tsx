"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void
  initialLat?: number
  initialLng?: number
}

export default function LocationPicker({
  onLocationSelect,
  initialLat = 52.2297,
  initialLng = 21.0122,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const initMap = async () => {
      const L = (await import("leaflet")).default

      // Fix for default markers
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })

      const mapInstance = L.map(mapRef.current!).setView([initialLat, initialLng], 13)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstance)

      // Add initial marker
      const initialMarker = L.marker([initialLat, initialLng]).addTo(mapInstance)

      // Handle map clicks
      mapInstance.on("click", (e: any) => {
        const { lat, lng } = e.latlng

        // Remove existing marker
        if (marker) {
          mapInstance.removeLayer(marker)
        }

        // Add new marker
        const newMarker = L.marker([lat, lng]).addTo(mapInstance)
        setMarker(newMarker)

        // Call callback
        onLocationSelect(lat, lng)
      })

      setMap(mapInstance)
      setMarker(initialMarker)

      // Set initial location
      onLocationSelect(initialLat, initialLng)
    }

    initMap()

    return () => {
      if (map) {
        map.remove()
      }
    }
  }, [])

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Kliknij na mapie, aby wybrać dokładną lokalizację obiektu</p>
      <div ref={mapRef} className="h-64 w-full rounded-lg border" />
    </div>
  )
}
