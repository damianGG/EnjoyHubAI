'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseSearchParams, buildSearchParams, updateSearchParams } from '@/lib/urlSearch'
import type L from 'leaflet'

interface Place {
  id: number
  name: string
  category_slug: string
  lat: number
  lng: number
  rating?: number
  distance_m?: number
}

interface MapWithSearchProps {
  initialResults: Place[]
  onResultsUpdate?: (results: Place[]) => void
}

/**
 * MapWithSearch - Leaflet map that syncs with URL state
 * - Renders markers for places
 * - Updates URL (bbox, center, zoom) on map move
 * - Triggers results refetch via callback
 */
export default function MapWithSearch({ initialResults, onResultsUpdate }: MapWithSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const [isMapReady, setIsMapReady] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Dynamically import Leaflet (client-side only)
    import('leaflet').then((L) => {
      if (!mapContainerRef.current) return

      // Parse initial center and zoom from URL
      const params = parseSearchParams(searchParams)
      let initialCenter: [number, number] = [52.237, 21.017] // Warsaw default
      let initialZoom = 7

      if (params.center) {
        const [lat, lng] = params.center.split(',').map(Number)
        if (!isNaN(lat) && !isNaN(lng)) {
          initialCenter = [lat, lng]
        }
      }

      if (params.zoom) {
        initialZoom = params.zoom
      }

      // Create map
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
      })

      // Add OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
      setIsMapReady(true)

      // Update URL on moveend (debounced via Leaflet's event system)
      map.on('moveend', () => {
        const bounds = map.getBounds()
        const center = map.getCenter()
        const zoom = map.getZoom()

        const bbox = [
          bounds.getWest().toFixed(6),
          bounds.getSouth().toFixed(6),
          bounds.getEast().toFixed(6),
          bounds.getNorth().toFixed(6),
        ].join(',')

        const centerStr = `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`

        // Update URL with new bbox, center, zoom
        const currentParams = parseSearchParams(searchParams)
        const updatedParams = updateSearchParams(currentParams, {
          bbox,
          center: centerStr,
          zoom,
        })

        const newSearchParams = buildSearchParams(updatedParams)
        router.replace(`/search?${newSearchParams.toString()}`, { scroll: false })
      })
    })

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // Only run once on mount

  // Update markers when results change
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return

    import('leaflet').then((L) => {
      const map = mapRef.current
      if (!map) return

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

      // Add new markers
      initialResults.forEach((place) => {
        const marker = L.marker([place.lat, place.lng], {
          title: place.name,
        })
          .addTo(map)
          .bindPopup(`
            <div>
              <strong>${place.name}</strong><br/>
              ${place.rating ? `⭐ ${place.rating}` : ''}
            </div>
          `)

        markersRef.current.push(marker)
      })
    })
  }, [initialResults, isMapReady])

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full min-h-[400px]"
      style={{ minHeight: '400px' }}
    />
  )
}
