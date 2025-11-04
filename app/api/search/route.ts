import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { parseSearchParams, attributeFiltersToJsonb } from "@/lib/urlSearch"

/**
 * Search API endpoint - proxies to Supabase RPC search_places_simple
 * GET /api/search?q=...&categories=...&bbox=...&center=...&zoom=...&sort=...&page=...&af=key:value
 */
export async function GET(request: Request) {
  try {
    const { searchParams: urlParams } = new URL(request.url)
    const params = parseSearchParams(urlParams)

    const cookieStore = await cookies()
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

    // Calculate limit and offset from page
    const page = params.page || 1
    const limit = 30
    const offset = (page - 1) * limit

    // Call RPC function
    const { data, error } = await supabase.rpc('search_places_simple', {
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

    if (error) {
      console.error("Search RPC error:", error)
      return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 })
    }

    return NextResponse.json({ results: data || [], page, limit })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({ results: [], error: "Internal server error" }, { status: 500 })
  }
}
