import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import {
  applyAnalyticsCookies,
  readAnalyticsRequestContext,
  recordAnalyticsEvent,
} from "@/lib/analytics/server"
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

type DynamicCondition = {
  eq?: string | boolean | number
  min?: number
  max?: number
}

type DynamicFilterPayload = {
  category?: string
  supply?: Record<string, DynamicCondition>
  product?: Record<string, DynamicCondition>
}

const MAX_VALID_AGE = 150
const NOW_WINDOW_HOURS = 4
const MAX_DISCOVERY_RANGE_DAYS = 31
const MAX_DYNAMIC_FILTERS_PER_SCOPE = 40
const MAX_DYNAMIC_FILTER_PAYLOAD_LENGTH = 8_000
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

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replaceAll("_", "-")
}

function sanitizeDynamicScope(value: unknown): Record<string, DynamicCondition> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}

  const result: Record<string, DynamicCondition> = {}
  for (const [key, rawCondition] of Object.entries(value).slice(0, MAX_DYNAMIC_FILTERS_PER_SCOPE)) {
    if (!/^[a-z0-9_]{2,80}$/.test(key)) continue
    if (!rawCondition || typeof rawCondition !== "object" || Array.isArray(rawCondition)) continue

    const condition = rawCondition as Record<string, unknown>
    const next: DynamicCondition = {}

    if (typeof condition.eq === "boolean") next.eq = condition.eq
    if (typeof condition.eq === "string" && condition.eq.length <= 160) next.eq = condition.eq
    if (typeof condition.eq === "number" && Number.isFinite(condition.eq)) next.eq = condition.eq

    if (typeof condition.min === "number" && Number.isFinite(condition.min)) {
      next.min = Math.max(-1_000_000_000, Math.min(1_000_000_000, condition.min))
    }
    if (typeof condition.max === "number" && Number.isFinite(condition.max)) {
      next.max = Math.max(-1_000_000_000, Math.min(1_000_000_000, condition.max))
    }

    if (next.min !== undefined && next.max !== undefined && next.min > next.max) {
      ;[next.min, next.max] = [next.max, next.min]
    }

    if (next.eq !== undefined || next.min !== undefined || next.max !== undefined) result[key] = next
  }

  return result
}

function parseDynamicFilters(value: string | null, categorySlugs: string[]) {
  if (!value || value.length > MAX_DYNAMIC_FILTER_PAYLOAD_LENGTH || categorySlugs.length !== 1) {
    return { supply: {}, product: {} }
  }

  try {
    const parsed = JSON.parse(value) as DynamicFilterPayload
    if (!parsed || typeof parsed !== "object") return { supply: {}, product: {} }
    if (normalizeSlug(String(parsed.category || "")) !== categorySlugs[0]) return { supply: {}, product: {} }

    return {
      supply: sanitizeDynamicScope(parsed.supply),
      product: sanitizeDynamicScope(parsed.product),
    }
  } catch {
    return { supply: {}, product: {} }
  }
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

function safeCampaignText(value: string | null, max: number) {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const { searchParams } = requestUrl

    const safeQuery = sanitizeQuery(searchParams.get("q") || "")
    const boundingBox = parseBoundingBox(searchParams.get("bbox") || "")
    const categorySlugs = parseCsv(searchParams.get("categories")).map(normalizeSlug)
    const typeSlugs = parseCsv(searchParams.get("types")).map(normalizeSlug)
    const amenities = parseCsv(searchParams.get("amenities"))
    const guests = parsePositiveInteger(searchParams.get("guests"), 1_000)
    const dynamicFilters = parseDynamicFilters(searchParams.get("attrs"), categorySlugs)

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
    const { data, error } = await supabase.rpc("marketplace_search_attractions_v6", {
      p_query: safeQuery || null,
      p_category_slugs: categorySlugs.length > 0 ? categorySlugs : null,
      p_type_slugs: typeSlugs.length > 0 ? typeSlugs : null,
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
      p_supply_filters: dynamicFilters.supply,
      p_product_filters: dynamicFilters.product,
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
    const analyticsContext = readAnalyticsRequestContext(request)
    const searchId = randomUUID()
    const source = safeCampaignText(searchParams.get("utm_source"), 120) || analyticsContext.source
    const medium = safeCampaignText(searchParams.get("utm_medium"), 120) || analyticsContext.medium
    const campaign = safeCampaignText(searchParams.get("utm_campaign"), 160) || analyticsContext.campaign

    await recordAnalyticsEvent({
      eventName: "search_performed",
      anonymousId: analyticsContext.anonymousId,
      analyticsSessionId: analyticsContext.analyticsSessionId,
      searchId,
      source,
      medium,
      campaign,
      referrer: request.headers.get("referer"),
      path: `${requestUrl.pathname}${requestUrl.search}`,
      properties: {
        query: safeQuery,
        categories: categorySlugs,
        guests,
        date: requestedDate,
        dateFrom: requestedRangeStart,
        dateTo: requestedRangeEnd,
        when: wantsNow ? "now" : null,
        minPrice,
        maxPrice,
        minAge,
        maxAge,
        sort,
        page,
        resultCount: total,
        returnedCount: items.length,
        supplyFilterCount: Object.keys(dynamicFilters.supply).length,
        productFilterCount: Object.keys(dynamicFilters.product).length,
      },
      searchResults: items.slice(0, 50).map((item, index) => ({
        attractionId: item.id,
        position: (page - 1) * per + index + 1,
      })),
    })

    const response = NextResponse.json({ items, total, page, per, searchId })
    applyAnalyticsCookies(response, {
      ...analyticsContext,
      searchId,
      source,
      medium,
      campaign,
    }, { searchMaxAgeSeconds: 30 * 60 })
    response.headers.set("Cache-Control", "private, no-store")

    return response
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
