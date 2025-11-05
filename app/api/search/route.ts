import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Search API endpoint for properties with bbox, categories, query, sort, and pagination
 * 
 * Query parameters:
 * - q: search query string (searches in title)
 * - bbox: bounding box as "west,south,east,north" (e.g., "19.8,50.0,20.2,50.2")
 * - categories: comma-separated category slugs (e.g., "paintball,gokarty")
 * - sort: relevance|rating|price_asc|price_desc|newest (default: relevance)
 * - page: page number (default: 1)
 * - per: items per page (default: 20, max: 100)
 * 
 * Returns:
 * {
 *   items: Array of properties with category and avg_rating
 *   total: Total count of matching items
 *   page: Current page number
 *   per: Items per page
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const q = searchParams.get("q") || ""
    const bboxStr = searchParams.get("bbox") || ""
    const categoriesStr = searchParams.get("categories") || ""
    const sort = searchParams.get("sort") || "relevance"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const per = Math.min(100, Math.max(1, parseInt(searchParams.get("per") || "20", 10)))

    // Parse bbox (west, south, east, north)
    let bbox: { west: number; south: number; east: number; north: number } | null = null
    if (bboxStr) {
      const parts = bboxStr.split(",").map((s) => parseFloat(s.trim()))
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        bbox = { west: parts[0], south: parts[1], east: parts[2], north: parts[3] }
      }
    }

    // Parse categories
    const categories = categoriesStr
      ? categoriesStr.split(",").map((s) => s.trim()).filter(Boolean)
      : []

    // Initialize Supabase client
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

    // Build query
    let query = supabase
      .from("properties")
      .select(
        `
        id,
        title,
        city,
        country,
        latitude,
        longitude,
        price_per_night,
        created_at,
        category_id,
        categories (
          slug,
          name
        ),
        reviews (
          rating
        )
      `,
        { count: "exact" }
      )
      .eq("is_active", true)

    // Filter by categories if provided
    if (categories.length > 0) {
      // First, we need to get category IDs from slugs
      // For now, we'll use a subquery approach
      // Alternative: Filter by matching slug in the join
      const { data: categoryData } = await supabase
        .from("categories")
        .select("id")
        .in("slug", categories)
      
      if (categoryData && categoryData.length > 0) {
        const categoryIds = categoryData.map((c: any) => c.id)
        query = query.in("category_id", categoryIds)
      }
    }

    // Filter by bbox if provided (fallback lat/lng filtering)
    if (bbox) {
      query = query
        .gte("latitude", bbox.south)
        .lte("latitude", bbox.north)
        .gte("longitude", bbox.west)
        .lte("longitude", bbox.east)
    }

    // Filter by search query if provided
    if (q) {
      query = query.ilike("title", `%${q}%`)
    }

    // Apply sorting
    switch (sort) {
      case "price_asc":
        query = query.order("price_per_night", { ascending: true })
        break
      case "price_desc":
        query = query.order("price_per_night", { ascending: false })
        break
      case "newest":
        query = query.order("created_at", { ascending: false })
        break
      case "rating":
        // Fallback: order by created_at for now
        // TODO: When avg_rating materialized view is available, use that
        query = query.order("created_at", { ascending: false })
        break
      case "relevance":
      default:
        // Fallback: order by created_at
        query = query.order("created_at", { ascending: false })
        break
    }

    // Apply pagination
    const from = (page - 1) * per
    const to = from + per - 1
    query = query.range(from, to)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      console.error("Search API error:", error)
      return NextResponse.json(
        { error: "Failed to fetch properties", details: error.message },
        { status: 500 }
      )
    }

    // Transform data to compute avg_rating
    const items = (data || []).map((property: any) => {
      const ratings = property.reviews?.map((r: any) => r.rating).filter((r: number) => r) || []
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length 
        : 0

      return {
        id: property.id,
        title: property.title,
        city: property.city,
        country: property.country,
        latitude: property.latitude,
        longitude: property.longitude,
        price_per_night: property.price_per_night,
        category_slug: property.categories?.slug || null,
        category_name: property.categories?.name || null,
        avg_rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
      }
    })

    return NextResponse.json({
      items,
      total: count || 0,
      page,
      per,
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
