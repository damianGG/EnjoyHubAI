import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { listMarketplacePropertySessions } from "@/lib/ticketing/marketplace"

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
  next_available_slot: { date: string; startTime: string; availableCapacity: number } | null
  price_from: number | null
}

type SearchItem = SearchResult & { hasAvailability?: boolean }

const MAX_VALID_AGE = 150
const NOW_WINDOW_HOURS = 4
const MAX_DISCOVERY_RANGE_DAYS = 31

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

export const revalidate = 60

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const q = searchParams.get("q") || ""
    const bbox = searchParams.get("bbox") || ""
    const categoriesParam = searchParams.get("categories") || ""
    const sort = searchParams.get("sort") || "relevance"
    const parsedPage = parseInt(searchParams.get("page") || "1", 10)
    const parsedPer = parseInt(searchParams.get("per") || "20", 10)
    const page = Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 10_000)
      : 1
    const per = Number.isFinite(parsedPer) && parsedPer > 0
      ? Math.min(parsedPer, 50)
      : 20
    const childAge = searchParams.get("child_age")
    const ageMinParam = searchParams.get("age_min")
    const ageMaxParam = searchParams.get("age_max")
    const dateParam = searchParams.get("date") || ""
    const dateFromParam = searchParams.get("date_from") || ""
    const dateToParam = searchParams.get("date_to") || ""
    const whenParam = searchParams.get("when") || ""
    const parsedMaxPrice = Number.parseFloat(searchParams.get("max_price") || "")
    const maxPrice = Number.isFinite(parsedMaxPrice) && parsedMaxPrice >= 0
      ? Math.min(parsedMaxPrice, 100_000)
      : null

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

    const wantsNow = whenParam === "now" && requestedRangeStart !== null
    const hasAvailabilityWindow = requestedRangeStart !== null && requestedRangeEnd !== null

    const supabase = createClient()

    let categoryIds: string[] | null = null
    let subcategoryIds: string[] | null = null
    if (categoriesParam) {
      const categoryArray = categoriesParam.split(",").map((c) => c.trim())

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id")
        .in("slug", categoryArray)

      if (categoryData && categoryData.length > 0) {
        categoryIds = categoryData.map((c) => c.id)
      }

      const { data: subcategoryData } = await supabase
        .from("subcategories")
        .select("id")
        .in("slug", categoryArray)

      if (subcategoryData && subcategoryData.length > 0) {
        subcategoryIds = subcategoryData.map((c) => c.id)
      }
    }

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

    if (q) {
      const safeQuery = q
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
      if (safeQuery) {
        const searchPattern = `%${safeQuery}%`
        query = query.or(
          `title.ilike.${searchPattern},city.ilike.${searchPattern},country.ilike.${searchPattern}`
        )
      }
    }

    if (subcategoryIds && subcategoryIds.length > 0) {
      query = query.in("subcategory_id", subcategoryIds)
    } else if (categoryIds && categoryIds.length > 0) {
      query = query.in("category_id", categoryIds)
    }

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
        break
      case "relevance":
      default:
        query = query.order("created_at", { ascending: false })
        break
    }

    const from = (page - 1) * per
    const to = from + per - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error("Search error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let items: SearchItem[] = (data || []).map((property: any) => {
      const ratings = property.reviews?.map((r: any) => r.rating) || []
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10
        : 0

      const minimumAgeField = property.object_field_values?.find(
        (fv: any) => fv.category_fields?.field_name === "minimum_age"
      )
      const maximumAgeField = property.object_field_values?.find(
        (fv: any) => fv.category_fields?.field_name === "maximum_age"
      )

      const minimumAge = minimumAgeField?.value ? parseInt(minimumAgeField.value, 10) : null
      const maximumAge = maximumAgeField?.value ? parseInt(maximumAgeField.value, 10) : null

      return {
        id: property.id,
        title: property.title,
        city: property.city,
        country: property.country,
        region: property.city,
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
        next_available_slot: null,
        price_from: null,
      }
    })

    const parseAge = (value: string | null) => {
      if (!value) return null
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > MAX_VALID_AGE) return null
      return parsed
    }

    let minAge = parseAge(ageMinParam)
    let maxAge = parseAge(ageMaxParam)

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      [minAge, maxAge] = [maxAge, minAge]
    }

    if (minAge !== null || maxAge !== null) {
      const requestedMinAge = minAge ?? 0
      const requestedMaxAge = maxAge ?? MAX_VALID_AGE
      items = items.filter((item) => {
        const itemMin = item.minimum_age ?? 0
        const itemMax = item.maximum_age ?? MAX_VALID_AGE
        return itemMin <= requestedMaxAge && itemMax >= requestedMinAge
      })
    } else if (childAge) {
      const childAgeNum = parseInt(childAge, 10)
      if (!Number.isNaN(childAgeNum) && childAgeNum > 0 && childAgeNum < MAX_VALID_AGE) {
        items = items.filter((item) => {
          const meetsMinimum = item.minimum_age === null || childAgeNum >= item.minimum_age
          const meetsMaximum = item.maximum_age === null || childAgeNum <= item.maximum_age
          return meetsMinimum && meetsMaximum
        })
      }
    }

    if (sort === "rating") {
      items.sort((a: SearchResult, b: SearchResult) => b.avg_rating - a.avg_rating)
    }

    const now = new Date()
    const dateStart = now.toISOString().split("T")[0]
    const futureDate = new Date(now)
    futureDate.setDate(futureDate.getDate() + 90)
    const dateEnd = futureDate.toISOString().split("T")[0]

    const requestedRangeOutsideMainRange = hasAvailabilityWindow
      && requestedRangeStart !== null
      && requestedRangeEnd !== null
      && (requestedRangeStart < dateStart || requestedRangeEnd > dateEnd)

    const nowDeadlineMs = now.getTime() + NOW_WINDOW_HOURS * 60 * 60 * 1000

    const ticketingResults = await Promise.all(
      items.map(async (item) => {
        const [sessions, requestedRangeSessions] = await Promise.all([
          listMarketplacePropertySessions(item.id, dateStart, dateEnd),
          requestedRangeOutsideMainRange && requestedRangeStart && requestedRangeEnd
            ? listMarketplacePropertySessions(item.id, requestedRangeStart, requestedRangeEnd)
            : Promise.resolve([]),
        ])

        const allSessions = requestedRangeSessions.length > 0
          ? [...sessions, ...requestedRangeSessions].filter(
              (session, index, array) => array.findIndex((candidate) => candidate.id === session.id) === index,
            ).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          : sessions

        let relevantSessions = allSessions
        if (hasAvailabilityWindow && requestedRangeStart && requestedRangeEnd) {
          relevantSessions = relevantSessions.filter(
            (session) => session.localDate >= requestedRangeStart && session.localDate <= requestedRangeEnd,
          )
        }

        if (wantsNow) {
          relevantSessions = relevantSessions.filter((session) => {
            const startsAtMs = Date.parse(session.startsAt)
            return Number.isFinite(startsAtMs) && startsAtMs <= nowDeadlineMs
          })
        }

        const availabilityFiltered = hasAvailabilityWindow || wantsNow
        const hasRequestedAvailability = !availabilityFiltered || relevantSessions.length > 0
        const candidateSessions = availabilityFiltered ? relevantSessions : sessions
        const nextSession = candidateSessions[0] ?? null
        const priceFrom = candidateSessions.length > 0
          ? Math.min(...candidateSessions.map((session) => session.priceFrom))
          : null

        return {
          ...item,
          hasAvailability: hasRequestedAvailability,
          next_available_slot: nextSession
            ? {
                date: nextSession.localDate,
                startTime: nextSession.localStartTime,
                availableCapacity: nextSession.availableCapacity,
              }
            : null,
          price_from: priceFrom,
        }
      })
    )

    const itemsWithSlots = ticketingResults.filter((item) => {
      if ((hasAvailabilityWindow || wantsNow) && !item.hasAvailability) return false
      if (maxPrice !== null) {
        const effectivePrice = item.price_from ?? item.price_per_night
        if (effectivePrice > maxPrice) return false
      }
      return true
    })

    const response = NextResponse.json({
      items: itemsWithSlots,
      total: hasAvailabilityWindow || wantsNow || maxPrice !== null ? itemsWithSlots.length : count || 0,
      page,
      per,
    })

    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120")

    return response
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
