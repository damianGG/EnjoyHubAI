import "server-only"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export type MarketplaceDiscoveryAttraction = {
  id: string
  title: string
  city: string
  country: string
  region?: string
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
  amenities?: string[]
  nextAvailableSlot?: {
    date: string
    startTime: string
    availableCapacity?: number
  } | null
  priceFrom?: number | null
  hasOnlineSales?: boolean
}

type SearchRpcItem = {
  id: string
  title: string
  city: string
  country: string
  region?: string
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
  amenities?: string[]
  images?: string[]
  avg_rating?: number
  review_count?: number
  next_available_slot?: MarketplaceDiscoveryAttraction["nextAvailableSlot"]
  price_from?: number | null
  has_online_sales?: boolean
}

type SearchRpcPayload = {
  items?: SearchRpcItem[]
  total?: number
}

export async function listMarketplaceDiscoveryAttractions(limit = 50) {
  if (!isSupabaseAdminConfigured) {
    return { items: [] as MarketplaceDiscoveryAttraction[], total: 0 }
  }

  const safeLimit = Math.max(1, Math.min(limit, 50))
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("marketplace_search_attractions_v6", {
    p_query: null,
    p_category_slugs: null,
    p_type_slugs: null,
    p_amenities: null,
    p_guests: null,
    p_west: null,
    p_south: null,
    p_east: null,
    p_north: null,
    p_age_min: null,
    p_age_max: null,
    p_start_date: null,
    p_end_date: null,
    p_now_deadline: null,
    p_require_availability: false,
    p_min_price: null,
    p_max_price: null,
    p_supply_filters: {},
    p_product_filters: {},
    p_sort: "relevance",
    p_limit: safeLimit,
    p_offset: 0,
  })

  if (error) throw error

  const payload = (data ?? {}) as SearchRpcPayload
  const rpcItems = Array.isArray(payload.items) ? payload.items : []

  const items = rpcItems.map((item): MarketplaceDiscoveryAttraction => ({
    id: item.id,
    title: item.title,
    city: item.city,
    country: item.country,
    region: item.region,
    latitude: item.latitude,
    longitude: item.longitude,
    property_type: item.property_type || item.subcategory_slug || item.category_slug || "attraction",
    category_slug: item.category_slug ?? null,
    category_icon: item.category_icon ?? null,
    category_image_url: item.category_image_url ?? null,
    subcategory_slug: item.subcategory_slug ?? null,
    subcategory_icon: item.subcategory_icon ?? null,
    subcategory_image_url: item.subcategory_image_url ?? null,
    max_guests: item.max_guests ?? 0,
    amenities: item.amenities ?? [],
    images: item.images ?? [],
    avgRating: item.avg_rating ?? 0,
    reviewCount: item.review_count ?? 0,
    nextAvailableSlot: item.next_available_slot ?? null,
    priceFrom: item.price_from ?? null,
    hasOnlineSales: Boolean(item.has_online_sales),
  }))

  return {
    items,
    total: Number.isFinite(Number(payload.total)) ? Number(payload.total) : items.length,
  }
}
