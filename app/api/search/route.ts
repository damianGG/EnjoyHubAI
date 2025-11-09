import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface SearchResult {
  id: string
  title: string
  city: string
  country: string
  latitude: number
  longitude: number
  price_per_night: number
  category_slug: string | null
  category_name: string | null
  category_icon: string | null
  avg_rating: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const q = searchParams.get("q") || ""
    const bbox = searchParams.get("bbox") || ""
    const categoriesParam = searchParams.get("categories") || ""
    const sort = searchParams.get("sort") || "relevance"
    const page = parseInt(searchParams.get("page") || "1", 10)
    const per = parseInt(searchParams.get("per") || "20", 10)
    const ageMin = searchParams.get("age_min")
    const ageMax = searchParams.get("age_max")
    
    const supabase = createClient()
    
    // Start building query
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
        category_id,
        categories (
          slug,
          name,
          icon
        ),
        reviews (
          rating
        ),
        object_field_values (
          value,
          category_fields (
            field_name
          )
        )
        `,
        { count: "exact" }
      )
      .eq("is_active", true)
    
    // Filter by search query (ilike on title)
    if (q) {
      query = query.ilike("title", `%${q}%`)
    }
    
    // Filter by categories
    if (categoriesParam) {
      const categoryArray = categoriesParam.split(",").map((c) => c.trim())
      query = query.in("categories.slug", categoryArray)
    }
    
    // Filter by bounding box (bbox format: "w,s,e,n")
    if (bbox) {
      const [west, south, east, north] = bbox.split(",").map(parseFloat)
      if (!isNaN(west) && !isNaN(south) && !isNaN(east) && !isNaN(north)) {
        query = query
          .gte("longitude", west)
          .lte("longitude", east)
          .gte("latitude", south)
          .lte("latitude", north)
      }
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
        // Rating will be computed from reviews after fetch
        break
      case "relevance":
      default:
        // Default to newest for now (relevance would need pg_trgm in future)
        query = query.order("created_at", { ascending: false })
        break
    }
    
    // Apply pagination
    const from = (page - 1) * per
    const to = from + per - 1
    query = query.range(from, to)
    
    const { data, error, count } = await query
    
    if (error) {
      console.error("Search error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    // Transform data to match expected format
    let items = (data || []).map((property: any) => {
      const ratings = property.reviews?.map((r: any) => r.rating) || []
      const avgRating = ratings.length > 0 
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
        : 0
      
      // Extract minimum_age from object_field_values
      const minimumAgeField = property.object_field_values?.find(
        (fv: any) => fv.category_fields?.field_name === 'minimum_age'
      )
      const minimumAge = minimumAgeField?.value ? parseInt(minimumAgeField.value) : null
      
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
        category_icon: property.categories?.icon || null,
        avg_rating: avgRating,
        minimum_age: minimumAge,
      }
    })
    
    // Filter by age range if provided
    if (ageMin || ageMax) {
      const minAge = ageMin ? parseInt(ageMin) : 0
      const maxAge = ageMax ? parseInt(ageMax) : 999
      
      items = items.filter((item: any) => {
        // If property doesn't have a minimum age requirement, include it
        if (item.minimum_age === null) return true
        
        // Property's minimum age requirement should be within the user's selected range
        // This means if someone selects 18-30, they can see properties with min age 18, 20, 25, etc.
        return item.minimum_age >= minAge && item.minimum_age <= maxAge
      })
    }
    
    // Sort by rating if requested (after computing avg_rating)
    if (sort === "rating") {
      items.sort((a: SearchResult, b: SearchResult) => b.avg_rating - a.avg_rating)
    }
    
    return NextResponse.json({
      items,
      total: count || 0,
      page,
      per,
    })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
