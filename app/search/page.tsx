import { Suspense } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import MapWithSearch from '@/components/MapWithSearch'
import SearchFilters from '@/components/SearchFilters'
import SearchResultsClient from '@/components/SearchResultsClient'
import { parseSearchParams, attributeFiltersToJsonb } from '@/lib/urlSearch'

interface SearchPageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

// Example categories - you can fetch these from DB or define statically
const CATEGORIES = [
  { slug: 'paintball', label: 'Paintball' },
  { slug: 'gokarty', label: 'Gokarty' },
  { slug: 'escape-room', label: 'Escape Room' },
]

/**
 * Search page with SSR initial data fetch
 * URL is the single source of truth
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  // Parse URL params
  const urlSearchParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => urlSearchParams.append(key, v))
    } else if (value) {
      urlSearchParams.append(key, value)
    }
  })
  
  const params = parseSearchParams(urlSearchParams)

  // Create Supabase client
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )

  // Parse center lat/lng
  let centerLat: number | null = null
  let centerLng: number | null = null
  if (params.center) {
    const [lat, lng] = params.center.split(',').map(Number)
    if (!isNaN(lat) && !isNaN(lng)) {
      centerLat = lat
      centerLng = lng
    }
  }

  // Convert attribute filters to JSONB
  const attrJsonb = attributeFiltersToJsonb(params.af)

  // Calculate limit and offset
  const page = params.page || 1
  const limit = 30
  const offset = (page - 1) * limit

  // Fetch initial results via RPC
  const { data: initialResults, error } = await supabase.rpc('search_places_simple', {
    p_bbox: params.bbox || null,
    p_categories: params.categories || null,
    p_q: params.q || null,
    p_sort: params.sort || 'popular',
    p_center_lat: centerLat,
    p_center_lng: centerLng,
    p_attr: attrJsonb,
    p_limit: limit,
    p_offset: offset,
  })

  const results = error ? [] : (initialResults || [])

  if (error) {
    console.error('SSR search error:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Wyszukiwarka Atrakcji
          </h1>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters sidebar */}
          <div className="lg:col-span-1">
            <Suspense fallback={<div>Ładowanie filtrów...</div>}>
              <SearchFilters categories={CATEGORIES} />
            </Suspense>
          </div>

          {/* Results list */}
          <div className="lg:col-span-1">
            <Suspense fallback={<div>Ładowanie wyników...</div>}>
              <SearchResultsClient initialResults={results} />
            </Suspense>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <div className="bg-white rounded-lg shadow overflow-hidden" style={{ height: '600px' }}>
                <Suspense fallback={<div>Ładowanie mapy...</div>}>
                  <MapWithSearch initialResults={results} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
