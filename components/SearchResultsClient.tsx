'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Place {
  id: number
  name: string
  category_slug: string
  lat: number
  lng: number
  rating?: number
  distance_m?: number
}

interface SearchResultsClientProps {
  initialResults: Place[]
}

/**
 * SearchResultsClient - Client component that refetches results when URL changes
 * Displays list of places
 */
export default function SearchResultsClient({ initialResults }: SearchResultsClientProps) {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<Place[]>(initialResults)
  const [loading, setLoading] = useState(false)

  // Refetch when URL changes
  useEffect(() => {
    setLoading(true)
    
    // Build API URL from current search params
    const apiUrl = `/api/search?${searchParams.toString()}`

    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        setResults(data.results || [])
      })
      .catch((err) => {
        console.error('Failed to fetch search results:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [searchParams])

  return (
    <div className="space-y-4">
      {loading && (
        <div className="text-center py-4 text-gray-500">
          Ładowanie wyników...
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Brak wyników. Spróbuj zmienić filtry lub powiększ obszar mapy.
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="text-sm text-gray-600 mb-2">
            Znaleziono: {results.length} wyników
          </div>
          <div className="space-y-3">
            {results.map((place) => (
              <div
                key={place.id}
                className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg mb-1">{place.name}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Kategoria: {place.category_slug}</div>
                  {place.rating && (
                    <div className="flex items-center gap-1">
                      <span>⭐</span>
                      <span>{place.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {place.distance_m !== undefined && place.distance_m !== null && (
                    <div>
                      Odległość: {(place.distance_m / 1000).toFixed(1)} km
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
