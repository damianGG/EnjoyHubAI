/**
 * URL-driven search state utilities
 * Manages query params for shareable, URL-driven search
 */

export interface SearchParams {
  q?: string
  categories?: string[]
  bbox?: string // "minLng,minLat,maxLng,maxLat"
  center?: string // "lat,lng"
  zoom?: number
  sort?: 'distance' | 'rating' | 'popular'
  page?: number
  af?: Record<string, string> // attribute filters: key:value
}

/**
 * Parse URL search params into SearchParams object
 */
export function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  const result: SearchParams = {}

  // Simple string params
  const q = searchParams.get('q')
  if (q) result.q = q

  const bbox = searchParams.get('bbox')
  if (bbox) result.bbox = bbox

  const center = searchParams.get('center')
  if (center) result.center = center

  const sort = searchParams.get('sort')
  if (sort && ['distance', 'rating', 'popular'].includes(sort)) {
    result.sort = sort as 'distance' | 'rating' | 'popular'
  }

  // Numeric params
  const zoom = searchParams.get('zoom')
  if (zoom) {
    const z = parseInt(zoom, 10)
    if (!isNaN(z)) result.zoom = z
  }

  const page = searchParams.get('page')
  if (page) {
    const p = parseInt(page, 10)
    if (!isNaN(p) && p > 0) result.page = p
  }

  // Array param: categories
  const categories = searchParams.getAll('categories')
  if (categories.length > 0) {
    result.categories = categories
  }

  // Attribute filters: repeated af=key:value
  const afParams = searchParams.getAll('af')
  if (afParams.length > 0) {
    result.af = {}
    afParams.forEach((param) => {
      const [key, value] = param.split(':', 2)
      if (key && value !== undefined) {
        result.af![key] = value
      }
    })
  }

  return result
}

/**
 * Build URLSearchParams from SearchParams object
 */
export function buildSearchParams(params: SearchParams): URLSearchParams {
  const searchParams = new URLSearchParams()

  if (params.q) searchParams.set('q', params.q)
  if (params.bbox) searchParams.set('bbox', params.bbox)
  if (params.center) searchParams.set('center', params.center)
  if (params.zoom !== undefined) searchParams.set('zoom', params.zoom.toString())
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.page !== undefined && params.page > 1) searchParams.set('page', params.page.toString())

  // Categories as repeated param
  if (params.categories && params.categories.length > 0) {
    params.categories.forEach((cat) => searchParams.append('categories', cat))
  }

  // Attribute filters as repeated af=key:value
  if (params.af) {
    Object.entries(params.af).forEach(([key, value]) => {
      searchParams.append('af', `${key}:${value}`)
    })
  }

  return searchParams
}

/**
 * Update specific search params while preserving others
 */
export function updateSearchParams(
  current: SearchParams,
  updates: Partial<SearchParams>
): SearchParams {
  return {
    ...current,
    ...updates,
    // Special handling for nested objects
    af: updates.af !== undefined ? updates.af : current.af,
    categories: updates.categories !== undefined ? updates.categories : current.categories,
  }
}

/**
 * Convert attribute filters object to JSONB for Supabase RPC
 */
export function attributeFiltersToJsonb(af?: Record<string, string>): Record<string, any> | null {
  if (!af || Object.keys(af).length === 0) return null

  const jsonb: Record<string, any> = {}

  Object.entries(af).forEach(([key, value]) => {
    // Try to parse as JSON (for boolean, number, etc.)
    try {
      if (value === 'true') {
        jsonb[key] = true
      } else if (value === 'false') {
        jsonb[key] = false
      } else if (value.trim() !== '' && !isNaN(Number(value))) {
        jsonb[key] = Number(value)
      } else {
        jsonb[key] = value
      }
    } catch {
      jsonb[key] = value
    }
  })

  return jsonb
}
