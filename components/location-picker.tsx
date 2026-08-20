"use client"

import { useEffect, useRef, useState } from "react"
import type { LeafletMouseEvent } from "leaflet"
import { CheckCircle2, MapPin } from "lucide-react"

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void
  initialLat?: number
  initialLng?: number
  selectedLat?: number | null
  selectedLng?: number | null
}

export default function LocationPicker({
  onLocationSelect,
  initialLat = 51.9194,
  initialLng = 19.1451,
  selectedLat = null,
  selectedLng = null,
}: LocationPickerProps) {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onLocationSelect)
  const initialSelectionRef = useRef({ lat: selectedLat, lng: selectedLng })
  const [hasSelection, setHasSelection] = useState(
    selectedLat !== null && selectedLng !== null,
  )

  useEffect(() => {
    callbackRef.current = onLocationSelect
  }, [onLocationSelect])

  useEffect(() => {
    if (!mapElementRef.current) return

    let disposed = false
    let cleanup: (() => void) | undefined

    async function initializeMap() {
      const L = (await import("leaflet")).default
      if (disposed || !mapElementRef.current) return

      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })

      const initialSelection = initialSelectionRef.current
      const startsWithSelection = initialSelection.lat !== null && initialSelection.lng !== null
      const startLat = initialSelection.lat ?? initialLat
      const startLng = initialSelection.lng ?? initialLng
      const map = L.map(mapElementRef.current).setView(
        [startLat, startLng],
        startsWithSelection ? 15 : 6,
      )
      let marker = startsWithSelection ? L.marker([startLat, startLng]).addTo(map) : null

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map)

      const handleClick = (event: LeafletMouseEvent) => {
        const { lat, lng } = event.latlng
        if (marker) marker.setLatLng([lat, lng])
        else marker = L.marker([lat, lng]).addTo(map)

        setHasSelection(true)
        callbackRef.current(lat, lng)
      }

      map.on("click", handleClick)
      cleanup = () => {
        map.off("click", handleClick)
        map.remove()
      }
    }

    void initializeMap()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [initialLat, initialLng])

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-sm">
        {hasSelection ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}
        <p className={hasSelection ? "font-medium text-emerald-700" : "text-muted-foreground"}>
          {hasSelection
            ? "Lokalizacja zaznaczona. Kliknij w inne miejsce, jeśli chcesz ją poprawić."
            : "Kliknij na mapie dokładnie tam, gdzie znajduje się wejście do obiektu."}
        </p>
      </div>
      <div
        ref={mapElementRef}
        className="h-72 w-full overflow-hidden rounded-xl border bg-muted"
        aria-label="Mapa do zaznaczenia lokalizacji obiektu"
      />
    </div>
  )
}
