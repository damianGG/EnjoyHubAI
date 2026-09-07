"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, MapPin, Maximize2, Minimize2, Star, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { generateAttractionSlug } from "@/lib/utils"

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
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
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
  immersiveMobile?: boolean
}

const CITY_COORDINATES: Record<string, [number, number]> = {
  "Warszawa, Poland": [52.2297, 21.0122],
  "Kraków, Poland": [50.0647, 19.945],
  "Rzeszów, Poland": [50.0413, 21.999],
  "Wrocław, Poland": [51.1079, 17.0385],
  "Gdańsk, Poland": [54.352, 18.6466],
  "Poznań, Poland": [52.4064, 16.9252],
  "New York, United States": [40.7128, -74.006],
  "London, United Kingdom": [51.5074, -0.1278],
  "Paris, France": [48.8566, 2.3522],
}

function stableOffset(seed: string, axis: number) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index) + axis * 31
    hash = Math.imul(hash, 16777619)
  }
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.08
}

function getFallbackCoordinates(attraction: Attraction): [number, number] {
  const base = CITY_COORDINATES[`${attraction.city}, ${attraction.country}`] ?? [52.0693, 19.4803]
  return [base[0] + stableOffset(attraction.id, 1), base[1] + stableOffset(attraction.id, 2)]
}

function hrefFor(attraction: Attraction) {
  return `/attractions/${generateAttractionSlug({
    city: attraction.city,
    category: attraction.property_type,
    title: attraction.title,
    id: attraction.id,
  })}`
}

export default function AttractionMap({
  attractions,
  selectedAttraction,
  onAttractionSelect,
  className = "",
  immersiveMobile = false,
}: AttractionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const markerLayerRef = useRef<any>(null)
  const [map, setMap] = useState<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [popupAttraction, setPopupAttraction] = useState<Attraction | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstanceRef.current) return

    let disposed = false

    async function initMap() {
      const L = (await import("leaflet")).default
      if (disposed || !mapRef.current) return

      leafletRef.current = L
      const mapInstance = L.map(mapRef.current, {
        center: immersiveMobile ? [52.2297, 21.0122] : [52.0693, 19.4803],
        zoom: immersiveMobile ? 11 : 6,
        zoomControl: false,
        attributionControl: true,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(mapInstance)

      L.control.zoom({ position: "bottomright" }).addTo(mapInstance)
      markerLayerRef.current = L.layerGroup().addTo(mapInstance)
      mapInstanceRef.current = mapInstance
      setMap(mapInstance)
    }

    void initMap()

    return () => {
      disposed = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [immersiveMobile])

  useEffect(() => {
    if (!map || !leafletRef.current || !markerLayerRef.current) return

    const L = leafletRef.current
    markerLayerRef.current.clearLayers()

    if (attractions.length === 0) return

    const bounds = L.latLngBounds([])

    attractions.forEach((attraction) => {
      const coordinates: [number, number] =
        typeof attraction.latitude === "number" && typeof attraction.longitude === "number"
          ? [attraction.latitude, attraction.longitude]
          : getFallbackCoordinates(attraction)

      bounds.extend(coordinates)
      const isSelected = selectedAttraction === attraction.id
      const markerHtml = `<div class="eh-price-pin${isSelected ? " eh-price-pin--selected" : ""}">${Math.round(attraction.price_per_night)} zł</div>`
      const icon = L.divIcon({
        html: markerHtml,
        className: "eh-price-pin-wrapper",
        iconSize: [82, 38],
        iconAnchor: [41, 19],
      })

      const marker = L.marker(coordinates, { icon, riseOnHover: true })
      marker.on("click", () => {
        onAttractionSelect?.(attraction.id)
        setPopupAttraction(attraction)
      })
      marker.addTo(markerLayerRef.current)
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: immersiveMobile ? [38, 38] : [55, 55],
        maxZoom: attractions.length === 1 ? 14 : 13,
      })
    }
  }, [attractions, map, onAttractionSelect, selectedAttraction, immersiveMobile])

  useEffect(() => {
    if (!map) return
    const timeout = window.setTimeout(() => map.invalidateSize(), 160)
    return () => window.clearTimeout(timeout)
  }, [isFullscreen, map])

  const previewImage = popupAttraction?.images?.find(Boolean) || "/placeholder.jpg"

  return (
    <>
      <div
        className={`relative h-full min-h-80 overflow-hidden bg-muted ${
          isFullscreen ? "fixed inset-3 z-50 min-h-0 rounded-3xl shadow-2xl" : immersiveMobile ? "rounded-none" : "rounded-3xl"
        } ${className}`}
      >
        <div ref={mapRef} className="h-full min-h-80 w-full" />

        <div className={`absolute z-[500] ${immersiveMobile ? "right-3 top-3" : "right-3 top-3"}`}>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setIsFullscreen((value) => !value)}
            className="h-10 w-10 rounded-full border border-black/[0.08] bg-white/95 text-[#0b1220] shadow-lg backdrop-blur hover:bg-white"
            aria-label={isFullscreen ? "Zamknij pełny ekran mapy" : "Powiększ mapę"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {attractions.length > 0 && (
          <div className={`absolute left-3 top-3 z-[500] rounded-full border border-black/[0.07] bg-white/95 px-3 py-2 text-xs font-semibold text-[#0b1220] shadow-md backdrop-blur ${immersiveMobile ? "hidden sm:block" : ""}`}>
            {attractions.length} {attractions.length === 1 ? "atrakcja" : "atrakcji"}
          </div>
        )}

        {attractions.length === 0 && immersiveMobile && (
          <div className="absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full border border-black/[0.07] bg-white/95 px-4 py-2 text-[11px] font-semibold text-muted-foreground shadow-md backdrop-blur">
            Przesuń mapę, aby odkrywać
          </div>
        )}

        {popupAttraction && (
          <div className={`absolute left-1/2 z-[650] -translate-x-1/2 ${immersiveMobile ? "bottom-4 w-[calc(100%-1rem)]" : "bottom-4 w-[calc(100%-2rem)] max-w-sm"}`}>
            <div className={`relative overflow-hidden bg-white shadow-[0_18px_46px_rgba(28,20,14,0.24)] ring-1 ring-black/[0.06] ${immersiveMobile ? "rounded-[24px]" : "rounded-2xl"}`}>
              <button
                type="button"
                onClick={() => setPopupAttraction(null)}
                className="absolute right-2.5 top-2.5 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow-md"
                aria-label="Zamknij podgląd atrakcji"
              >
                <X className="h-4 w-4" />
              </button>

              <Link href={hrefFor(popupAttraction)} className="block">
                <div className={immersiveMobile ? "grid grid-cols-[116px_1fr]" : "grid grid-cols-[105px_1fr]"}>
                  <div className="relative min-h-[126px] overflow-hidden bg-muted">
                    <Image src={previewImage} alt={popupAttraction.title} fill className="object-cover" sizes="140px" />
                  </div>

                  <div className="min-w-0 p-3.5 pr-11">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-primary">Polecane</span>
                      {Boolean(popupAttraction.avgRating) && (
                        <span className="flex items-center gap-1 text-[11px] font-bold"><Star className="h-3 w-3 fill-primary text-primary" />{popupAttraction.avgRating?.toFixed(1)}</span>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-[14px] font-extrabold leading-tight tracking-[-0.025em] text-foreground">{popupAttraction.title}</h3>
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><MapPin className="h-3 w-3 shrink-0 text-primary" />{popupAttraction.city}</p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div><span className="text-[10px] text-muted-foreground">od </span><span className="text-base font-extrabold">{Math.round(popupAttraction.price_per_night)} zł</span><span className="text-[10px] text-muted-foreground"> / os.</span></div>
                      <span className="flex items-center text-[11px] font-bold text-primary">Szczegóły <ChevronRight className="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        <style>{`
          .eh-price-pin-wrapper { background: transparent !important; border: 0 !important; }
          .eh-price-pin {
            display: inline-flex;
            min-width: 64px;
            height: 36px;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(11, 18, 32, .12);
            border-radius: 999px;
            background: rgba(255, 255, 255, .98);
            color: #0b1220;
            padding: 0 12px;
            font: 700 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            box-shadow: 0 5px 16px rgba(11, 18, 32, .18);
            transform-origin: center;
            transition: transform .16s ease, background .16s ease, color .16s ease, box-shadow .16s ease;
            white-space: nowrap;
          }
          .eh-price-pin:hover { transform: scale(1.08); box-shadow: 0 8px 22px rgba(11, 18, 32, .24); }
          .eh-price-pin--selected { background: #f47521; color: white; border-color: #f47521; transform: scale(1.1); }
          .leaflet-control-zoom { border: 0 !important; box-shadow: 0 5px 18px rgba(11, 18, 32, .18) !important; margin-bottom: ${immersiveMobile ? "76px" : "10px"} !important; }
          .leaflet-control-zoom a { color: #0b1220 !important; border: 0 !important; }
          .leaflet-control-attribution { font-size: 8px !important; }
        `}</style>
      </div>

      {isFullscreen && <div className="fixed inset-0 z-40 bg-black/45" onClick={() => setIsFullscreen(false)} />}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    </>
  )
}
