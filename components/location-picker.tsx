"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, MapPin } from "lucide-react"

import { applyEnjoyHubMapTheme, getMapTilerKey, getMapTilerStyleUrl, loadMapLibre } from "@/lib/maps/maplibre"

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void
  draggable?: boolean
  initialLat?: number
  initialLng?: number
  selectedLat?: number | null
  selectedLng?: number | null
}

export default function LocationPicker({
  onLocationSelect,
  draggable = false,
  initialLat = 51.9194,
  initialLng = 19.1451,
  selectedLat = null,
  selectedLng = null,
}: LocationPickerProps) {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onLocationSelect)
  const [hasSelection, setHasSelection] = useState(
    selectedLat !== null && selectedLng !== null,
  )
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    callbackRef.current = onLocationSelect
  }, [onLocationSelect])

  useEffect(() => {
    if (!mapElementRef.current) return

    const apiKey = getMapTilerKey()
    if (!apiKey) {
      setMapError("Brak klucza MapTiler. Dodaj NEXT_PUBLIC_MAPTILER_KEY.")
      return
    }

    let disposed = false
    let cleanup: (() => void) | undefined

    async function initializeMap() {
      try {
        const maplibregl = await loadMapLibre()
        if (disposed || !mapElementRef.current) return

        const startsWithSelection = selectedLat !== null && selectedLng !== null
        const startLat = selectedLat ?? initialLat
        const startLng = selectedLng ?? initialLng

        const map = new maplibregl.Map({
          container: mapElementRef.current,
          style: getMapTilerStyleUrl(apiKey),
          center: [startLng, startLat],
          zoom: startsWithSelection ? 15 : 6,
          attributionControl: true,
        })

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left")
        map.on("style.load", () => applyEnjoyHubMapTheme(map, "simple"))

        let marker = startsWithSelection
          ? new maplibregl.Marker({ draggable }).setLngLat([startLng, startLat]).addTo(map)
          : null

        const handleDrag = () => {
          if (!marker) return
          const { lat, lng } = marker.getLngLat()
          callbackRef.current(lat, lng)
        }

        marker?.on("dragend", handleDrag)

        const handleClick = (event: any) => {
          const { lat, lng } = event.lngLat

          if (marker) {
            marker.setLngLat([lng, lat])
          } else {
            marker = new maplibregl.Marker({ draggable })
              .setLngLat([lng, lat])
              .addTo(map)
              .on("dragend", handleDrag)
          }

          setHasSelection(true)
          callbackRef.current(lat, lng)
        }

        map.on("click", handleClick)

        map.on("error", (event: any) => {
          if (event?.error?.message) console.error("MapTiler map error:", event.error.message)
        })

        cleanup = () => {
          map.off("click", handleClick)
          marker?.remove()
          map.remove()
        }
      } catch (error) {
        if (!disposed) {
          console.error("Unable to initialize MapLibre:", error)
          setMapError("Nie udało się uruchomić mapy. Sprawdź klucz MapTiler.")
        }
      }
    }

    void initializeMap()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [initialLat, initialLng, draggable])

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

      <div className="relative h-72 w-full overflow-hidden rounded-xl border bg-muted">
        <div
          ref={mapElementRef}
          className="h-full w-full"
          aria-label="Mapa do zaznaczenia lokalizacji obiektu"
        />
        {mapError && (
          <div className="absolute inset-0 grid place-items-center bg-muted px-6 text-center">
            <div>
              <MapPin className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-sm font-semibold text-foreground">Mapa jest gotowa do konfiguracji</p>
              <p className="mt-1 text-xs text-muted-foreground">{mapError}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
