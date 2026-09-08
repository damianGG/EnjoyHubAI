"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, MapPin, Maximize2, Minimize2, Star, Users, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getEnjoyHubCategoryIcon } from "@/lib/category-icon-assets"
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
}

const CATEGORY_ICON_FALLBACKS: Record<string, string> = {
  paintball: "🎯",
  gokarty: "🏎️",
  "go-karts": "🏎️",
  "park-trampolin": "🤸",
  trampoliny: "🤸",
  "plac-zabaw": "🛝",
  playground: "🛝",
  "park-linowy": "🧗",
  "adventure-park": "🧗",
  "escape-room": "🗝️",
  dmuchance: "🎈",
  bowling: "🎳",
  cinema: "🎬",
  restaurant: "🍽️",
}

function normalizeSlug(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replaceAll("_", "-")
}

function stableOffset(seed: string, axis: number) {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i) + axis * 31
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function safeRemoteImageUrl(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return escapeHtml(url.toString())
  } catch {
    return null
  }
}

function markerVisual(attraction: Attraction) {
  const localImage =
    getEnjoyHubCategoryIcon(attraction.subcategory_slug) ||
    getEnjoyHubCategoryIcon(attraction.category_slug) ||
    getEnjoyHubCategoryIcon(attraction.property_type)

  if (localImage) {
    return `<img class="eh-object-marker__image eh-object-marker__image--local" src="${escapeHtml(localImage)}" alt="" loading="lazy" />`
  }

  const remoteImage = safeRemoteImageUrl(attraction.subcategory_image_url || attraction.category_image_url)
  if (remoteImage) {
    return `<img class="eh-object-marker__image" src="${remoteImage}" alt="" loading="lazy" />`
  }

  const slug = normalizeSlug(attraction.subcategory_slug || attraction.category_slug || attraction.property_type)
  const icon = attraction.subcategory_icon || attraction.category_icon || CATEGORY_ICON_FALLBACKS[slug] || "✨"
  return `<span class="eh-object-marker__emoji" aria-hidden="true">${escapeHtml(icon)}</span>`
}

function markerHtml(attraction: Attraction, index: number) {
  const delay = Math.min(index * 24, 216)
  return `
    <div class="eh-object-marker" style="--eh-enter-delay:${delay}ms" aria-label="${escapeHtml(attraction.title)}">
      <span class="eh-object-marker__halo" aria-hidden="true"></span>
      <span class="eh-object-marker__bubble">${markerVisual(attraction)}</span>
      <span class="eh-object-marker__tip" aria-hidden="true"></span>
    </div>
  `
}

function focusMarkerAboveCard(map: any, marker: any, cardRef: { current: HTMLDivElement | null }) {
  if (typeof window === "undefined" || !map || !marker) return
  window.setTimeout(() => {
    if (!map.getSize || !marker.getLatLng) return
    const size = map.getSize()
    const point = map.latLngToContainerPoint(marker.getLatLng())
    const cardHeight = cardRef.current?.getBoundingClientRect().height ?? Math.min(340, size.y * 0.52)
    const openHeight = Math.max(140, size.y - cardHeight - 78)
    const targetX = size.x / 2
    const targetY = Math.max(80, Math.min(165, openHeight * 0.5))
    map.panBy([point.x - targetX, point.y - targetY], { animate: true, duration: 0.35 })
  }, 110)
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
  const markersByIdRef = useRef<Map<string, any>>(new Map())
  const popupCardRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  const [map, setMap] = useState<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [popupAttraction, setPopupAttraction] = useState<Attraction | null>(null)
  const [popupImageIndex, setPopupImageIndex] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstanceRef.current) return
    let disposed = false

    void (async () => {
      const L = (await import("leaflet")).default
      if (disposed || !mapRef.current) return
      leafletRef.current = L

      const instance = L.map(mapRef.current, {
        center: immersiveMobile ? [52.2297, 21.0122] : [52.0693, 19.4803],
        zoom: immersiveMobile ? 11 : 6,
        zoomControl: false,
        attributionControl: true,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(instance)

      L.control.zoom({ position: "topleft" }).addTo(instance)
      markerLayerRef.current = L.layerGroup().addTo(instance)
      mapInstanceRef.current = instance
      setMap(instance)
    })()

    return () => {
      disposed = true
      markersByIdRef.current.clear()
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [immersiveMobile])

  useEffect(() => {
    if (!map || !leafletRef.current || !markerLayerRef.current) return
    const L = leafletRef.current
    markerLayerRef.current.clearLayers()
    markersByIdRef.current.clear()
    if (!attractions.length) return

    const bounds = L.latLngBounds([])

    attractions.forEach((attraction, index) => {
      const coordinates: [number, number] =
        typeof attraction.latitude === "number" && typeof attraction.longitude === "number"
          ? [attraction.latitude, attraction.longitude]
          : getFallbackCoordinates(attraction)

      bounds.extend(coordinates)
      const icon = L.divIcon({
        html: markerHtml(attraction, index),
        className: "eh-object-marker-wrapper",
        iconSize: [60, 64],
        iconAnchor: [30, 61],
        tooltipAnchor: [0, -48],
      })

      const marker = L.marker(coordinates, { icon, riseOnHover: true })
      marker.bindTooltip(attraction.title, {
        direction: "top",
        offset: [0, -8],
        opacity: 0.96,
        className: "eh-object-marker-tooltip",
      })
      marker.on("click", () => {
        onAttractionSelect?.(attraction.id)
        setPopupAttraction(attraction)
        setPopupImageIndex(0)
        if (immersiveMobile) focusMarkerAboveCard(map, marker, popupCardRef)
      })
      marker.addTo(markerLayerRef.current)
      markersByIdRef.current.set(attraction.id, marker)
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: immersiveMobile ? [46, 46] : [60, 60],
        maxZoom: attractions.length === 1 ? 14 : 13,
      })
    }
  }, [attractions, map, onAttractionSelect, immersiveMobile])

  useEffect(() => {
    markersByIdRef.current.forEach((marker, id) => {
      const root = marker.getElement()?.querySelector(".eh-object-marker") as HTMLElement | null
      if (!root) return
      const selected = id === selectedAttraction
      root.classList.toggle("eh-object-marker--selected", selected)
      marker.setZIndexOffset(selected ? 1000 : 0)
    })
  }, [selectedAttraction, attractions])

  useEffect(() => {
    if (popupAttraction && !attractions.some((item) => item.id === popupAttraction.id)) setPopupAttraction(null)
  }, [attractions, popupAttraction])

  useEffect(() => {
    setPopupImageIndex(0)
    if (galleryRef.current) galleryRef.current.scrollLeft = 0
  }, [popupAttraction?.id])

  useEffect(() => {
    if (!map) return
    const timer = window.setTimeout(() => map.invalidateSize(), 160)
    return () => window.clearTimeout(timer)
  }, [isFullscreen, map])

  const galleryImages = popupAttraction?.images?.filter(Boolean).length
    ? popupAttraction.images!.filter(Boolean)
    : ["/placeholder.jpg"]

  const closePopup = () => {
    setPopupAttraction(null)
    setPopupImageIndex(0)
    onAttractionSelect?.(null)
  }

  const handleGalleryScroll = () => {
    const el = galleryRef.current
    if (!el || !el.clientWidth) return
    const next = Math.round(el.scrollLeft / el.clientWidth)
    setPopupImageIndex(Math.max(0, Math.min(next, galleryImages.length - 1)))
  }

  return (
    <>
      <div
        className={`relative isolate z-0 h-full overflow-hidden bg-muted ${immersiveMobile ? "min-h-0" : "min-h-80"} ${
          isFullscreen
            ? "fixed inset-0 z-[1400] min-h-0 rounded-none shadow-2xl md:inset-3 md:rounded-3xl"
            : immersiveMobile
              ? "rounded-none"
              : "rounded-3xl"
        } ${className}`}
      >
        <div ref={mapRef} className={`h-full w-full ${immersiveMobile ? "min-h-0" : "min-h-80"}`} />

        <div className="absolute right-3 top-3 z-[900]">
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

        {popupAttraction && immersiveMobile && (
          <div
            ref={popupCardRef}
            className="absolute left-1/2 z-[800] w-[calc(100%-1.25rem)] max-w-[520px] -translate-x-1/2"
            style={{ bottom: "calc(max(14px, env(safe-area-inset-bottom)) + 64px)" }}
          >
            <div className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_22px_60px_rgba(28,20,14,0.30)] ring-1 ring-black/[0.07]">
              <div className="relative h-[190px] bg-muted sm:h-[220px]">
                <div
                  ref={galleryRef}
                  onScroll={handleGalleryScroll}
                  className="eh-map-gallery flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
                >
                  {galleryImages.map((image, index) => (
                    <div key={`${image}-${index}`} className="relative h-full min-w-full snap-center">
                      <Image src={image} alt={popupAttraction.title} fill className="object-cover" sizes="(max-width: 640px) 96vw, 520px" />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={closePopup}
                  className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/95 shadow-md"
                  aria-label="Zamknij podgląd atrakcji"
                >
                  <X className="h-4 w-4" />
                </button>

                {galleryImages.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur-sm">
                    {galleryImages.slice(0, 7).map((_, index) => (
                      <span
                        key={index}
                        className={`h-1.5 w-1.5 rounded-full transition-all ${index === popupImageIndex ? "w-3 bg-white" : "bg-white/55"}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Link href={hrefFor(popupAttraction)} className="block px-4 pb-4 pt-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-[17px] font-extrabold leading-tight tracking-[-0.025em] text-foreground">
                      {popupAttraction.title}
                    </h3>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {popupAttraction.city}
                    </p>
                  </div>
                  {Boolean(popupAttraction.avgRating) && (
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      {popupAttraction.avgRating?.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between gap-3 border-t border-black/[0.05] pt-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">od</div>
                    <span className="text-lg font-extrabold">{Math.round(popupAttraction.price_per_night)} zł</span>
                    <span className="text-[11px] text-muted-foreground"> / os.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {popupAttraction.max_guests > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> do {popupAttraction.max_guests}
                      </span>
                    )}
                    <span className="flex items-center rounded-full bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary">
                      Szczegóły <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {popupAttraction && !immersiveMobile && (
          <div className="absolute bottom-4 left-1/2 z-[800] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
            <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/[0.07]">
              <Link href={hrefFor(popupAttraction)} className="grid grid-cols-[105px_1fr]">
                <div className="relative min-h-[126px] bg-muted">
                  <Image src={galleryImages[0]} alt={popupAttraction.title} fill className="object-cover" sizes="140px" />
                </div>
                <div className="min-w-0 p-3.5 pr-10">
                  <h3 className="line-clamp-2 text-sm font-extrabold">{popupAttraction.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{popupAttraction.city}</p>
                  <p className="mt-4 text-base font-extrabold">od {Math.round(popupAttraction.price_per_night)} zł</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        <style>{`
          .eh-map-gallery::-webkit-scrollbar { display: none; }
          .eh-map-gallery { scrollbar-width: none; }
          .eh-object-marker-wrapper { background: transparent !important; border: 0 !important; overflow: visible !important; }
          .eh-object-marker { --eh-orange:#f47521; position:relative; display:grid; height:64px; width:60px; place-items:start center; transform-origin:50% 92%; animation:eh-marker-enter .28s cubic-bezier(.2,.85,.32,1.2) both; animation-delay:var(--eh-enter-delay,0ms); cursor:pointer; }
          .eh-object-marker__halo { position:absolute; top:-4px; left:2px; width:56px; height:56px; border-radius:20px; background:rgba(244,117,33,.22); opacity:0; pointer-events:none; }
          .eh-object-marker__bubble { position:relative; z-index:2; display:grid; width:52px; height:52px; place-items:center; overflow:hidden; border:2px solid rgba(11,18,32,.12); border-radius:18px; background:rgba(255,255,255,.98); box-shadow:0 7px 20px rgba(11,18,32,.20),0 2px 5px rgba(11,18,32,.10); transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease; }
          .eh-object-marker__image { width:100%; height:100%; object-fit:cover; }
          .eh-object-marker__image--local { object-fit:contain; padding:2px; background:#fffaf5; }
          .eh-object-marker__emoji { font-size:28px; line-height:1; }
          .eh-object-marker__tip { position:absolute; z-index:1; bottom:4px; left:25px; width:10px; height:10px; transform:rotate(45deg); border-right:1px solid rgba(11,18,32,.10); border-bottom:1px solid rgba(11,18,32,.10); background:white; }
          .eh-object-marker:hover .eh-object-marker__bubble { transform:translateY(-3px) scale(1.07); border-color:rgba(244,117,33,.45); }
          .eh-object-marker--selected .eh-object-marker__halo { animation:eh-marker-selected-pulse 1.8s ease-out infinite; }
          .eh-object-marker--selected .eh-object-marker__bubble { transform:translateY(-4px) scale(1.1); border-color:var(--eh-orange); box-shadow:0 12px 30px rgba(244,117,33,.28); }
          .eh-object-marker-tooltip { border:0 !important; border-radius:12px !important; background:rgba(35,30,26,.96) !important; color:white !important; box-shadow:0 8px 24px rgba(11,18,32,.18) !important; padding:7px 10px !important; font-size:11px !important; font-weight:700 !important; }
          .eh-object-marker-tooltip::before { display:none !important; }
          .leaflet-control-zoom { border:0 !important; box-shadow:0 5px 18px rgba(11,18,32,.18) !important; margin-top:12px !important; margin-left:12px !important; }
          .leaflet-control-zoom a { color:#0b1220 !important; border:0 !important; }
          .leaflet-control-attribution { font-size:8px !important; }
          @keyframes eh-marker-enter { from { opacity:0; transform:translateY(10px) scale(.76); } to { opacity:1; transform:translateY(0) scale(1); } }
          @keyframes eh-marker-selected-pulse { 0% { opacity:.38; transform:scale(.84); } 60% { opacity:.04; transform:scale(1.22); } 100% { opacity:0; transform:scale(1.28); } }
          @media (prefers-reduced-motion: reduce) { .eh-object-marker,.eh-object-marker--selected .eh-object-marker__halo { animation:none !important; } .eh-object-marker__bubble { transition:none !important; } }
        `}</style>
      </div>

      {isFullscreen && <div className="fixed inset-0 z-[1300] bg-black/45" onClick={() => setIsFullscreen(false)} />}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    </>
  )
}
