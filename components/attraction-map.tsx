"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { CalendarDays, ChevronRight, MapPin, Maximize2, Minimize2, Sparkles, Star, Users, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getEnjoyHubCategoryIcon } from "@/lib/category-icon-assets"
import { applyEnjoyHubMapTheme, getMapTilerKey, getMapTilerStyleUrl, loadMapLibre, type EnjoyHubMapTheme } from "@/lib/maps/maplibre"
import { publicAttractionPath } from "@/lib/marketplace/attraction-path"

type AvailableSlot = {
  date: string
  startTime: string
  availableCapacity?: number
}

interface Attraction {
  id: string
  title: string
  city: string
  country: string
  latitude?: number
  longitude?: number
  property_type: string
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
  max_guests: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
  nextAvailableSlot?: AvailableSlot | null
  priceFrom?: number | null
}

interface AttractionMapProps {
  attractions: Attraction[]
  selectedAttraction?: string | null
  onAttractionSelect?: (attractionId: string | null) => void
  className?: string
  immersiveMobile?: boolean
}

type MarkerRecord = {
  marker: any
  element: HTMLDivElement
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

const hrefFor = publicAttractionPath

function localIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatSlot(slot: AvailableSlot) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (slot.date === localIsoDate(today)) return `Dzisiaj · ${slot.startTime}`
  if (slot.date === localIsoDate(tomorrow)) return `Jutro · ${slot.startTime}`

  const [, month, day] = slot.date.split("-")
  return `${day}.${month} · ${slot.startTime}`
}

function capacityText(capacity?: number) {
  if (!capacity || capacity < 1) return null
  if (capacity === 1) return "zostało 1 miejsce"
  if (capacity >= 2 && capacity <= 4) return `zostały ${capacity} miejsca`
  return `${capacity} miejsc dostępnych`
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
    return `<img class="eh-object-marker__image eh-object-marker__image--local" src="${escapeHtml(localImage)}" alt="" loading="lazy" style="display:block;width:42px;height:42px;max-width:42px;max-height:42px;object-fit:contain;object-position:center;padding:3px;box-sizing:border-box;background:#fff1eb" />`
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

export default function AttractionMap({
  attractions,
  selectedAttraction,
  onAttractionSelect,
  className = "",
  immersiveMobile = false,
}: AttractionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const mapLibreRef = useRef<any>(null)
  const markersByIdRef = useRef<Map<string, MarkerRecord>>(new Map())
  const fittedLocationsRef = useRef<string | null>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const mapThemeRef = useRef<EnjoyHubMapTheme>("enjoyhub")
  const mapTilerKeyRef = useRef("")

  const [map, setMap] = useState<any>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapTheme, setMapTheme] = useState<EnjoyHubMapTheme>("enjoyhub")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [popupAttraction, setPopupAttraction] = useState<Attraction | null>(null)
  const [popupImageIndex, setPopupImageIndex] = useState(0)

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("enjoyhub-map-theme")
    if (savedTheme === "simple" || savedTheme === "enjoyhub") {
      mapThemeRef.current = savedTheme
      setMapTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstanceRef.current) return

    const apiKey = getMapTilerKey()
    mapTilerKeyRef.current = apiKey
    if (!apiKey) {
      setMapError("Brak klucza MapTiler. Dodaj NEXT_PUBLIC_MAPTILER_KEY.")
      return
    }

    let disposed = false

    void (async () => {
      try {
        const maplibregl = await loadMapLibre()
        if (disposed || !mapRef.current) return
        mapLibreRef.current = maplibregl

        const instance = new maplibregl.Map({
          container: mapRef.current,
          style: getMapTilerStyleUrl(apiKey),
          center: immersiveMobile ? [21.0122, 52.2297] : [19.4803, 52.0693],
          zoom: immersiveMobile ? 11 : 5.5,
          attributionControl: true,
        })

        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left")
        instance.on("style.load", () => applyEnjoyHubMapTheme(instance, mapThemeRef.current))
        instance.on("error", (event: any) => {
          if (event?.error?.message) console.error("MapTiler map error:", event.error.message)
        })

        mapInstanceRef.current = instance
        setMap(instance)
      } catch (error) {
        if (!disposed) {
          console.error("Unable to initialize MapLibre:", error)
          setMapError("Nie udało się uruchomić mapy. Sprawdź klucz MapTiler.")
        }
      }
    })()

    return () => {
      disposed = true
      markersByIdRef.current.forEach(({ marker }) => marker.remove())
      markersByIdRef.current.clear()
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      fittedLocationsRef.current = null
    }
  }, [immersiveMobile])

  useEffect(() => {
    const maplibregl = mapLibreRef.current
    if (!map || !maplibregl) return

    markersByIdRef.current.forEach(({ marker }) => marker.remove())
    markersByIdRef.current.clear()

    if (!attractions.length) {
      fittedLocationsRef.current = null
      return
    }

    const bounds = new maplibregl.LngLatBounds()
    const locations: string[] = []

    attractions.forEach((attraction, index) => {
      const [lat, lng] =
        typeof attraction.latitude === "number" && typeof attraction.longitude === "number"
          ? [attraction.latitude, attraction.longitude]
          : getFallbackCoordinates(attraction)

      bounds.extend([lng, lat])
      locations.push(JSON.stringify([attraction.id, lat, lng]))

      const element = document.createElement("div")
      element.className = "eh-object-marker-wrapper"
      element.innerHTML = markerHtml(attraction, index)
      element.title = attraction.title
      element.setAttribute("role", "button")
      element.setAttribute("aria-label", attraction.title)
      element.tabIndex = 0

      const selectAttraction = () => {
        onAttractionSelect?.(attraction.id)
        setPopupAttraction(attraction)
        setPopupImageIndex(0)
      }

      element.addEventListener("click", selectAttraction)
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          selectAttraction()
        }
      })

      const marker = new maplibregl.Marker({
        element,
        anchor: "bottom",
      })
        .setLngLat([lng, lat])
        .addTo(map)

      markersByIdRef.current.set(attraction.id, { marker, element })
    })

    const locationsKey = JSON.stringify(locations.sort())
    if (!bounds.isEmpty() && fittedLocationsRef.current !== locationsKey) {
      map.fitBounds(bounds, {
        padding: immersiveMobile ? 46 : 60,
        maxZoom: attractions.length === 1 ? 14 : 13,
        duration: 420,
      })
      fittedLocationsRef.current = locationsKey
    }
  }, [attractions, map, onAttractionSelect, immersiveMobile])

  useEffect(() => {
    markersByIdRef.current.forEach(({ element }, id) => {
      const root = element.querySelector(".eh-object-marker") as HTMLElement | null
      if (!root) return
      const selected = id === selectedAttraction
      root.classList.toggle("eh-object-marker--selected", selected)
      element.style.zIndex = selected ? "10" : ""
    })
  }, [selectedAttraction, attractions, map])

  useEffect(() => {
    if (popupAttraction && !attractions.some((item) => item.id === popupAttraction.id)) setPopupAttraction(null)
  }, [attractions, popupAttraction])

  useEffect(() => {
    if (!popupAttraction) return
    const fresh = attractions.find((item) => item.id === popupAttraction.id)
    if (fresh && fresh !== popupAttraction) setPopupAttraction(fresh)
  }, [attractions, popupAttraction])

  useEffect(() => {
    setPopupImageIndex(0)
    if (galleryRef.current) galleryRef.current.scrollLeft = 0
  }, [popupAttraction?.id])

  useEffect(() => {
    if (!map) return
    const timer = window.setTimeout(() => map.resize(), 160)
    return () => window.clearTimeout(timer)
  }, [isFullscreen, map])

  const handleMapThemeChange = (nextTheme: EnjoyHubMapTheme) => {
    if (nextTheme === mapThemeRef.current) return

    mapThemeRef.current = nextTheme
    setMapTheme(nextTheme)
    window.localStorage.setItem("enjoyhub-map-theme", nextTheme)

    if (!map || !mapTilerKeyRef.current) return

    map.once("style.load", () => applyEnjoyHubMapTheme(map, nextTheme))
    map.setStyle(getMapTilerStyleUrl(mapTilerKeyRef.current))
  }

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

  const popupCapacity = capacityText(popupAttraction?.nextAvailableSlot?.availableCapacity)
  const popupPrice = typeof popupAttraction?.priceFrom === "number" && Number.isFinite(popupAttraction.priceFrom)
    ? popupAttraction.priceFrom
    : null

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

        {mapError && (
          <div className="absolute inset-0 z-[850] grid place-items-center bg-muted px-6 text-center">
            <div>
              <MapPin className="mx-auto mb-2 h-7 w-7 text-primary" />
              <p className="font-bold text-foreground">Mapa jest gotowa do konfiguracji</p>
              <p className="mt-1 text-xs text-muted-foreground">{mapError}</p>
            </div>
          </div>
        )}

        <div className="absolute left-14 top-3 z-[900] flex rounded-full border border-[#0b1220]/[0.08] bg-white/95 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => handleMapThemeChange("simple")}
            className={`rounded-full px-3 py-2 text-[11px] font-bold transition sm:text-xs ${
              mapTheme === "simple"
                ? "bg-[#0b1220] text-white shadow-sm"
                : "text-[#5e6673] hover:bg-[#f5f6f8] hover:text-[#0b1220]"
            }`}
            aria-pressed={mapTheme === "simple"}
          >
            Prosta PL
          </button>
          <button
            type="button"
            onClick={() => handleMapThemeChange("enjoyhub")}
            className={`flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold transition sm:text-xs ${
              mapTheme === "enjoyhub"
                ? "bg-primary text-white shadow-sm"
                : "text-[#5e6673] hover:bg-[#fff1eb] hover:text-primary"
            }`}
            aria-pressed={mapTheme === "enjoyhub"}
          >
            <Sparkles className="h-3.5 w-3.5" />
            EnjoyHub
          </button>
        </div>

        <div className="absolute right-3 top-3 z-[900]">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setIsFullscreen((value) => !value)}
            className="h-10 w-10 rounded-full border border-[#0b1220]/[0.08] bg-white/95 text-[#0b1220] shadow-lg backdrop-blur hover:bg-white"
            aria-label={isFullscreen ? "Zamknij pełny ekran mapy" : "Powiększ mapę"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {popupAttraction && immersiveMobile && (
          <div
            className="absolute left-1/2 z-[800] w-[calc(100%-1.25rem)] max-w-[520px] -translate-x-1/2"
            style={{ bottom: "calc(max(14px, env(safe-area-inset-bottom)) + 64px)" }}
          >
            <div className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_22px_60px_rgba(11,18,32,0.30)] ring-1 ring-[#0b1220]/[0.07]">
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
                  <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-[#0b1220]/30 px-2.5 py-1.5 backdrop-blur-sm">
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

                {popupAttraction.nextAvailableSlot && (
                  <div className="mt-3 rounded-xl border border-primary/15 bg-[#fff7f2] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#b63b12]"><CalendarDays className="h-4 w-4" />{formatSlot(popupAttraction.nextAvailableSlot)}</p>
                    {popupCapacity && <p className="mt-1 text-[11px] font-medium text-muted-foreground">{popupCapacity}</p>}
                  </div>
                )}

                <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#0b1220]/[0.05] pt-3">
                  <div>
                    {popupPrice !== null ? (
                      <>
                        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">od</div>
                        <span className="text-lg font-extrabold">{Math.round(popupPrice)} zł</span>
                        <span className="text-[11px] text-muted-foreground"> / os.</span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-primary">Sprawdź ofertę</span>
                    )}
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
            <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-[#0b1220]/[0.07]">
              <Link href={hrefFor(popupAttraction)} className="grid grid-cols-[105px_1fr]">
                <div className="relative min-h-[144px] bg-muted">
                  <Image src={galleryImages[0]} alt={popupAttraction.title} fill className="object-cover" sizes="140px" />
                </div>
                <div className="min-w-0 p-3.5 pr-10">
                  <h3 className="line-clamp-2 text-sm font-extrabold">{popupAttraction.title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground">{popupAttraction.city}</p>
                  {popupAttraction.nextAvailableSlot && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#b63b12]">
                      <CalendarDays className="h-3.5 w-3.5" /> {formatSlot(popupAttraction.nextAvailableSlot)}
                    </div>
                  )}
                  {popupPrice !== null ? (
                    <p className="mt-3 text-base font-extrabold">od {Math.round(popupPrice)} zł</p>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-primary">Sprawdź ofertę</p>
                  )}
                </div>
              </Link>
            </div>
          </div>
        )}

        <style>{`
          .eh-map-gallery::-webkit-scrollbar { display: none; }
          .eh-map-gallery { scrollbar-width: none; }
          .eh-object-marker-wrapper { background: transparent !important; border: 0 !important; overflow: visible !important; width:60px; height:64px; }
          .eh-object-marker { --eh-orange:#ff5a1f; position:relative; display:grid; height:64px; width:60px; place-items:start center; transform-origin:50% 92%; animation:eh-marker-enter .28s cubic-bezier(.2,.85,.32,1.2) both; animation-delay:var(--eh-enter-delay,0ms); cursor:pointer; }
          .eh-object-marker__halo { position:absolute; top:-4px; left:2px; width:56px; height:56px; border-radius:20px; background:rgba(255,90,31,.22); opacity:0; pointer-events:none; }
          .eh-object-marker__bubble { position:relative; z-index:2; display:grid; width:52px; height:52px; place-items:center; overflow:hidden; border:2px solid rgba(11,18,32,.12); border-radius:18px; background:rgba(255,255,255,.98); box-shadow:0 7px 20px rgba(11,18,32,.20),0 2px 5px rgba(11,18,32,.10); transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease; }
          .eh-object-marker__image { width:100%; height:100%; object-fit:cover; }
          .eh-object-marker__image--local { width:42px; height:42px; max-width:42px; max-height:42px; object-fit:contain; object-position:center; padding:3px; box-sizing:border-box; background:#fff1eb; }
          .eh-object-marker__emoji { font-size:28px; line-height:1; }
          .eh-object-marker__tip { position:absolute; z-index:1; bottom:4px; left:25px; width:10px; height:10px; transform:rotate(45deg); border-right:1px solid rgba(11,18,32,.10); border-bottom:1px solid rgba(11,18,32,.10); background:white; }
          .eh-object-marker:hover .eh-object-marker__bubble { transform:translateY(-3px) scale(1.07); border-color:rgba(255,90,31,.45); }
          .eh-object-marker--selected .eh-object-marker__halo { animation:eh-marker-selected-pulse 1.8s ease-out infinite; }
          .eh-object-marker--selected .eh-object-marker__bubble { transform:translateY(-4px) scale(1.1); border-color:var(--eh-orange); box-shadow:0 12px 30px rgba(255,90,31,.28); }
          @keyframes eh-marker-enter { from { opacity:0; transform:translateY(10px) scale(.76); } to { opacity:1; transform:translateY(0) scale(1); } }
          @keyframes eh-marker-selected-pulse { 0% { opacity:.38; transform:scale(.84); } 60% { opacity:.04; transform:scale(1.22); } 100% { opacity:0; transform:scale(1.28); } }
          @media (prefers-reduced-motion: reduce) { .eh-object-marker,.eh-object-marker--selected .eh-object-marker__halo { animation:none !important; } .eh-object-marker__bubble { transition:none !important; } }
        `}</style>
      </div>

      {isFullscreen && <div className="fixed inset-0 z-[1300] bg-[#0b1220]/45" onClick={() => setIsFullscreen(false)} />}
    </>
  )
}
