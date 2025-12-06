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
  category_image_url: string | null
  subcategory_slug: string | null
  subcategory_name: string | null
  subcategory_icon: string | null
  subcategory_image_url: string | null
  avg_rating: number
  images?: string[]
  region?: string
  review_count?: number
  minimum_age?: number | null
  maximum_age?: number | null
  cover_image_url: string | null
}

// Maximum valid age for filtering
const MAX_VALID_AGE = 150

// Enable caching for this route - revalidate every 60 seconds
export const revalidate = 60

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
    const childAge = searchParams.get("child_age")
    
    const supabase = createClient()
    
    // Get category IDs and subcategory IDs if filtering by categories/subcategories
    let categoryIds: string[] | null = null
    let subcategoryIds: string[] | null = null
    if (categoriesParam) {
      const categoryArray = categoriesParam.split(",").map((c) => c.trim())
      
      // Check categories table
      const { data: categoryData } = await supabase
        .from("categories")
        .select("id")
        .in("slug", categoryArray)
      
      if (categoryData && categoryData.length > 0) {
        categoryIds = categoryData.map((c) => c.id)
      }
      
      // Check subcategories table
      const { data: subcategoryData } = await supabase
        .from("subcategories")
        .select("id")
        .in("slug", categoryArray)
      
      if (subcategoryData && subcategoryData.length > 0) {
        subcategoryIds = subcategoryData.map((c) => c.id)
      }
    }
    
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
        images,
        category_id,
        subcategory_id,
        categories (
          slug,
          name,
          icon,
          image_url
        ),
        subcategories (
          slug,
          name,
          icon,
          image_url
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
    
    // Filter by categories or subcategories
    if (subcategoryIds && subcategoryIds.length > 0) {
      // If subcategories are specified, filter by subcategory_id
      query = query.in("subcategory_id", subcategoryIds)
    } else if (categoryIds && categoryIds.length > 0) {
      // If only categories are specified, filter by category_id
      query = query.in("category_id", categoryIds)
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
      
      // Extract minimum_age and maximum_age from object_field_values
      const minimumAgeField = property.object_field_values?.find(
        (fv: any) => fv.category_fields?.field_name === 'minimum_age'
      )
      const maximumAgeField = property.object_field_values?.find(
        (fv: any) => fv.category_fields?.field_name === 'maximum_age'
      )
      
      const minimumAge = minimumAgeField?.value ? parseInt(minimumAgeField.value, 10) : null
      const maximumAge = maximumAgeField?.value ? parseInt(maximumAgeField.value, 10) : null
      
      return {
        id: property.id,
        title: property.title,
        city: property.city,
        country: property.country,
        region: property.city,  // region column doesn't exist, use city instead
        latitude: property.latitude,
        longitude: property.longitude,
        price_per_night: property.price_per_night,
        images: property.images || [],
        category_slug: property.categories?.slug || null,
        category_name: property.categories?.name || null,
        category_icon: property.categories?.icon || null,
        category_image_url: property.categories?.image_url || null,
        subcategory_slug: property.subcategories?.slug || null,
        subcategory_name: property.subcategories?.name || null,
        subcategory_icon: property.subcategories?.icon || null,
        subcategory_image_url: property.subcategories?.image_url || null,
        avg_rating: avgRating,
        review_count: ratings.length,
        minimum_age: minimumAge,
        maximum_age: maximumAge,
        cover_image_url: property.images && property.images.length > 0 ? property.images[0] : null,
      }
    })
    
    // Filter by child_age if provided
    if (childAge) {
      const childAgeNum = parseInt(childAge, 10)
      if (!isNaN(childAgeNum) && childAgeNum > 0 && childAgeNum < MAX_VALID_AGE) {
        items = items.filter((item: any) => {
          // If no minimum_age is set, don't filter based on minimum
          const meetsMinimum = item.minimum_age === null || childAgeNum >= item.minimum_age
          
          // If no maximum_age is set, treat it as Infinity (no upper limit)
          const meetsMaximum = item.maximum_age === null || childAgeNum <= item.maximum_age
          
          return meetsMinimum && meetsMaximum
        })
      }
    }
    
    // Sort by rating if requested (after computing avg_rating)
    if (sort === "rating") {
      items.sort((a: SearchResult, b: SearchResult) => b.avg_rating - a.avg_rating)
    }
    
    const response = NextResponse.json({
      items,
      total: count || 0,
      page,
      per,
    })
    
    // Add cache headers for better performance
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    
    return response
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
