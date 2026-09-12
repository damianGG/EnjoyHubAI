"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from "leaflet"
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
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const callbackRef = useRef(onLocationSelect)
  const selectionRef = useRef({ lat: selectedLat, lng: selectedLng })
  const [hasSelection, setHasSelection] = useState(selectedLat !== null && selectedLng !== null)

  selectionRef.current = { lat: selectedLat, lng: selectedLng }

  useEffect(() => {
    callbackRef.current = onLocationSelect
  }, [onLocationSelect])

  const bindMarker = useCallback((marker: Marker) => {
    marker.on("dragend", () => {
      const point = marker.getLatLng()
      setHasSelection(true)
      callbackRef.current(point.lat, point.lng)
    })
    return marker
  }, [])

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

      const selection = selectionRef.current
      const startsWithSelection = selection.lat !== null && selection.lng !== null
      const startLat = selection.lat ?? initialLat
      const startLng = selection.lng ?? initialLng
      const map = L.map(mapElementRef.current).setView([startLat, startLng], startsWithSelection ? 15 : 6)
      mapRef.current = map

      if (startsWithSelection) {
        markerRef.current = bindMarker(L.marker([startLat, startLng], { draggable: true }).addTo(map))
      }

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map)

      const handleClick = (event: LeafletMouseEvent) => {
        const { lat, lng } = event.latlng
        if (markerRef.current) markerRef.current.setLatLng([lat, lng])
        else markerRef.current = bindMarker(L.marker([lat, lng], { draggable: true }).addTo(map))

        setHasSelection(true)
        callbackRef.current(lat, lng)
      }

      map.on("click", handleClick)
      cleanup = () => {
        map.off("click", handleClick)
        markerRef.current?.off("dragend")
        map.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }

    void initializeMap()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [bindMarker, initialLat, initialLng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (selectedLat === null || selectedLng === null) {
      if (markerRef.current) {
        markerRef.current.off("dragend")
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      setHasSelection(false)
      return
    }

    let cancelled = false
    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !mapRef.current) return

      if (markerRef.current) markerRef.current.setLatLng([selectedLat, selectedLng])
      else markerRef.current = bindMarker(L.marker([selectedLat, selectedLng], { draggable: true }).addTo(mapRef.current))

      mapRef.current.setView([selectedLat, selectedLng], Math.max(mapRef.current.getZoom(), 15))
      setHasSelection(true)
    })

    return () => {
      cancelled = true
    }
  }, [bindMarker, selectedLat, selectedLng])

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
            ? "Lokalizacja zaznaczona. Przeciągnij pinezkę albo kliknij inne miejsce, aby ustawić punkt dokładnie."
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
