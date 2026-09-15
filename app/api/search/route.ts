import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

interface SearchResult {
  id: string
  title: string
  city: string
  country: string
  latitude: number
  longitude: number
  property_type: string
  max_guests: number
  amenities?: string[]
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
  next_available_slot: { date: string; startTime: string; availableCapacity: number } | null
  price_from: number | null
  has_online_sales: boolean
}

type SearchPayload = {
  items?: SearchResult[]
  total?: number
}

const MAX_VALID_AGE = 150
const NOW_WINDOW_HOURS = 4
const MAX_DISCOVERY_RANGE_DAYS = 31
const ALLOWED_SORTS = new Set(["relevance", "price_asc", "price_desc", "newest", "rating", "reviews"])

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function dayDifference(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  return Math.round((endMs - startMs) / 86_400_000)
}

function parseAge(value: string | null) {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0 || parsed > MAX_VALID_AGE) return null
  return parsed
}

function parsePositiveInteger(value: string | null, max: number) {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.min(parsed, max)
}

function parseMoney(value: string | null) {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.min(parsed, 100_000)
}

function parseCsv(value: string | null, limit = 50) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function parseBoundingBox(value: string) {
  if (!value) return null
  const coordinates = value.split(",").map((part) => Number.parseFloat(part))
  if (coordinates.length !== 4 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) {
    return null
  }

  const [west, south, east, north] = coordinates
  if (west < -180 || west > 180 || east < -180 || east > 180) return null
  if (south < -90 || south > 90 || north < -90 || north > 90) return null
  if (west > east || south > north) return null

  return { west, south, east, north }
}

function sanitizeQuery(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export const revalidate = 60

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const safeQuery = sanitizeQuery(searchParams.get("q") || "")
    const boundingBox = parseBoundingBox(searchParams.get("bbox") || "")
    const categorySlugs = parseCsv(searchParams.get("categories"))
      .map((slug) => slug.toLowerCase())
    const propertyTypes = parseCsv(searchParams.get("types"))
    const amenities = parseCsv(searchParams.get("amenities"))
    const guests = parsePositiveInteger(searchParams.get("guests"), 1_000)

    const requestedSort = searchParams.get("sort") || "relevance"
    const sort = ALLOWED_SORTS.has(requestedSort) ? requestedSort : "relevance"

    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10)
    const parsedPer = Number.parseInt(searchParams.get("per") || "20", 10)
    const page = Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 10_000)
      : 1
    const per = Number.isFinite(parsedPer) && parsedPer > 0
      ? Math.min(parsedPer, 50)
      : 20

    let minPrice = parseMoney(searchParams.get("min_price"))
    let maxPrice = parseMoney(searchParams.get("max_price"))
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      [minPrice, maxPrice] = [maxPrice, minPrice]
    }

    let minAge = parseAge(searchParams.get("age_min"))
    let maxAge = parseAge(searchParams.get("age_max"))

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      [minAge, maxAge] = [maxAge, minAge]
    }

    if (minAge === null && maxAge === null) {
      const childAge = parseAge(searchParams.get("child_age"))
      if (childAge !== null && childAge > 0) {
        minAge = childAge
        maxAge = childAge
      }
    }

    const dateParam = searchParams.get("date") || ""
    const dateFromParam = searchParams.get("date_from") || ""
    const dateToParam = searchParams.get("date_to") || ""
    const whenParam = searchParams.get("when") || ""

    const requestedDate = isValidIsoDate(dateParam) ? dateParam : null
    const requestedDateFrom = isValidIsoDate(dateFromParam) ? dateFromParam : null
    const requestedDateTo = isValidIsoDate(dateToParam) ? dateToParam : null

    let requestedRangeStart: string | null = requestedDate
    let requestedRangeEnd: string | null = requestedDate

    if (!requestedDate && requestedDateFrom && requestedDateTo) {
      const rangeDays = dayDifference(requestedDateFrom, requestedDateTo)
      if (rangeDays >= 0 && rangeDays <= MAX_DISCOVERY_RANGE_DAYS) {
        requestedRangeStart = requestedDateFrom
        requestedRangeEnd = requestedDateTo
      }
    }

    const hasAvailabilityWindow = requestedRangeStart !== null && requestedRangeEnd !== null
    const wantsNow = whenParam === "now" && hasAvailabilityWindow
    const nowDeadline = wantsNow
      ? new Date(Date.now() + NOW_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
      : null

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("marketplace_search_attractions_v3", {
      p_query: safeQuery || null,
      p_category_slugs: categorySlugs.length > 0 ? categorySlugs : null,
      p_property_types: propertyTypes.length > 0 ? propertyTypes : null,
      p_amenities: amenities.length > 0 ? amenities : null,
      p_guests: guests,
      p_west: boundingBox?.west ?? null,
      p_south: boundingBox?.south ?? null,
      p_east: boundingBox?.east ?? null,
      p_north: boundingBox?.north ?? null,
      p_age_min: minAge,
      p_age_max: maxAge,
      p_start_date: requestedRangeStart,
      p_end_date: requestedRangeEnd,
      p_now_deadline: nowDeadline,
      p_require_availability: hasAvailabilityWindow || wantsNow,
      p_min_price: minPrice,
      p_max_price: maxPrice,
      p_sort: sort,
      p_limit: per,
      p_offset: (page - 1) * per,
    })

    if (error) {
      console.error("Search RPC error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const payload = (data ?? {}) as SearchPayload
    const items = Array.isArray(payload.items) ? payload.items : []
    const total = Number.isFinite(Number(payload.total)) ? Number(payload.total) : 0

    const response = NextResponse.json({ items, total, page, per })
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120")

    return response
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
