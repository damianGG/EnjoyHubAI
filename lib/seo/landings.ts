import "server-only"

import { cache } from "react"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { getPublicSiteUrl } from "@/lib/site-url"
import { generateAttractionSlug, slugify } from "@/lib/utils"

export const SEO_CITY_MIN_OBJECTS = 3
export const SEO_CITY_CATEGORY_MIN_OBJECTS = 2

export type SeoCatalogCategory = {
  slug: string
  name: string
  activeCount: number
}

export type SeoCatalogCity = {
  slug: string
  name: string
  country: string
  activeCount: number
  categories: SeoCatalogCategory[]
}

export type SeoLandingAttraction = {
  id: string
  title: string
  city: string
  country: string
  latitude: number | null
  longitude: number | null
  propertyType: string
  categorySlug: string | null
  categoryName: string | null
  subcategorySlug: string | null
  subcategoryName: string | null
  maxGuests: number
  images: string[]
  avgRating: number
  reviewCount: number
  priceFrom: number | null
  hasOnlineSales: boolean
}

export type SeoLandingData = {
  location: { slug: string; name: string; country: string } | null
  category: { slug: string; name: string } | null
  stats: {
    total: number
    onlineSalesCount: number
    priceFrom: number | null
    ratedCount: number
    averageRating: number | null
  }
  items: SeoLandingAttraction[]
}

type CatalogRpc = {
  cities?: Array<{
    slug?: string
    name?: string
    country?: string
    active_count?: number
    categories?: Array<{
      slug?: string
      name?: string
      active_count?: number
    }>
  }>
}

type LandingRpc = {
  location?: { slug?: string; name?: string; country?: string } | null
  category?: { slug?: string; name?: string } | null
  stats?: {
    total?: number
    online_sales_count?: number
    price_from?: number | null
    rated_count?: number
    average_rating?: number | null
  }
  items?: Array<{
    id?: string
    title?: string
    city?: string
    country?: string
    latitude?: number | null
    longitude?: number | null
    property_type?: string
    category_slug?: string | null
    category_name?: string | null
    subcategory_slug?: string | null
    subcategory_name?: string | null
    max_guests?: number
    images?: string[] | null
    avg_rating?: number
    review_count?: number
    price_from?: number | null
    has_online_sales?: boolean
  }>
}

function polishedPlaceName(value: string) {
  const normalized = value.trim().toLocaleLowerCase("pl-PL")
  return normalized.replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => (
    `${separator}${letter.toLocaleUpperCase("pl-PL")}`
  ))
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const getSeoLandingCatalog = cache(async (): Promise<SeoCatalogCity[]> => {
  if (!isSupabaseAdminConfigured) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("marketplace_seo_catalog_v1")
  if (error) throw error

  const payload = (data ?? {}) as CatalogRpc
  return (payload.cities ?? [])
    .map((city): SeoCatalogCity | null => {
      const slug = slugify(city.slug ?? "")
      const name = polishedPlaceName(city.name ?? "")
      if (!slug || !name) return null

      return {
        slug,
        name,
        country: city.country?.trim() || "Polska",
        activeCount: finiteNumber(city.active_count),
        categories: (city.categories ?? [])
          .map((category): SeoCatalogCategory | null => {
            const categorySlug = slugify(category.slug ?? "")
            const categoryName = category.name?.trim() || ""
            if (!categorySlug || !categoryName) return null
            return {
              slug: categorySlug,
              name: categoryName,
              activeCount: finiteNumber(category.active_count),
            }
          })
          .filter((category): category is SeoCatalogCategory => Boolean(category)),
      }
    })
    .filter((city): city is SeoCatalogCity => Boolean(city))
})

export const getSeoLanding = cache(async (cityInput: string, categoryInput?: string | null): Promise<SeoLandingData | null> => {
  if (!isSupabaseAdminConfigured) return null

  const citySlug = slugify(cityInput)
  const categorySlug = categoryInput ? slugify(categoryInput) : null
  if (!citySlug) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("marketplace_seo_landing_v1", {
    p_city_slug: citySlug,
    p_category_slug: categorySlug,
    p_limit: 48,
    p_offset: 0,
  })
  if (error) throw error

  const payload = (data ?? {}) as LandingRpc
  if (!payload.location) return null

  const locationSlug = slugify(payload.location.slug ?? citySlug)
  const locationName = polishedPlaceName(payload.location.name ?? "")
  if (!locationSlug || !locationName) return null

  const items = (payload.items ?? [])
    .map((item): SeoLandingAttraction | null => {
      const id = item.id?.trim() || ""
      const title = item.title?.trim() || ""
      if (!id || !title) return null

      return {
        id,
        title,
        city: polishedPlaceName(item.city ?? locationName),
        country: item.country?.trim() || payload.location?.country?.trim() || "Polska",
        latitude: nullableFiniteNumber(item.latitude),
        longitude: nullableFiniteNumber(item.longitude),
        propertyType: item.property_type?.trim() || item.subcategory_slug || item.category_slug || "attraction",
        categorySlug: item.category_slug ? slugify(item.category_slug) : null,
        categoryName: item.category_name?.trim() || null,
        subcategorySlug: item.subcategory_slug ? slugify(item.subcategory_slug) : null,
        subcategoryName: item.subcategory_name?.trim() || null,
        maxGuests: finiteNumber(item.max_guests),
        images: Array.isArray(item.images) ? item.images.filter(Boolean) : [],
        avgRating: finiteNumber(item.avg_rating),
        reviewCount: finiteNumber(item.review_count),
        priceFrom: nullableFiniteNumber(item.price_from),
        hasOnlineSales: Boolean(item.has_online_sales),
      }
    })
    .filter((item): item is SeoLandingAttraction => Boolean(item))

  return {
    location: {
      slug: locationSlug,
      name: locationName,
      country: payload.location.country?.trim() || "Polska",
    },
    category: payload.category?.slug && payload.category?.name
      ? { slug: slugify(payload.category.slug), name: payload.category.name.trim() }
      : null,
    stats: {
      total: finiteNumber(payload.stats?.total),
      onlineSalesCount: finiteNumber(payload.stats?.online_sales_count),
      priceFrom: nullableFiniteNumber(payload.stats?.price_from),
      ratedCount: finiteNumber(payload.stats?.rated_count),
      averageRating: nullableFiniteNumber(payload.stats?.average_rating),
    },
    items,
  }
})

export function findSeoCatalogCity(catalog: SeoCatalogCity[], cityInput: string) {
  const citySlug = slugify(cityInput)
  return catalog.find((city) => city.slug === citySlug) ?? null
}

export function isSeoCityIndexable(city: Pick<SeoCatalogCity, "activeCount">) {
  return city.activeCount >= SEO_CITY_MIN_OBJECTS
}

export function isSeoCategoryIndexable(category: Pick<SeoCatalogCategory, "activeCount">) {
  return category.activeCount >= SEO_CITY_CATEGORY_MIN_OBJECTS
}

export function getSeoLandingPath(citySlug: string, categorySlug?: string | null) {
  const city = slugify(citySlug)
  const category = categorySlug ? slugify(categorySlug) : null
  return category ? `/atrakcje/${city}/${category}` : `/atrakcje/${city}`
}

export function getSeoLandingUrl(citySlug: string, categorySlug?: string | null) {
  return `${getPublicSiteUrl()}${getSeoLandingPath(citySlug, categorySlug)}`
}

export function getSeoAttractionPath(item: SeoLandingAttraction) {
  const attractionSlug = generateAttractionSlug({
    id: item.id,
    title: item.title,
    city: item.city,
    category: item.propertyType,
  })
  return `/attractions/${attractionSlug}`
}

export function getSeoLandingDescription(landing: SeoLandingData) {
  if (!landing.location) return "Odkrywaj atrakcje i rezerwuj bilety online w EnjoyHub."

  const subject = landing.category
    ? `${landing.category.name}: ${landing.location.name}.`
    : `Atrakcje: ${landing.location.name}.`
  const parts = [`${landing.stats.total} dostępnych miejsc w katalogu EnjoyHub.`]

  if (landing.stats.priceFrom !== null) {
    parts.push(`Ceny od ${Math.round(landing.stats.priceFrom)} zł.`)
  }
  if (landing.stats.onlineSalesCount > 0) {
    parts.push(`${landing.stats.onlineSalesCount} obiektów z rezerwacją online.`)
  }
  if (landing.stats.ratedCount > 0 && landing.stats.averageRating !== null) {
    parts.push(`Średnia ocenionych obiektów: ${landing.stats.averageRating}/5.`)
  }

  return `${subject} ${parts.join(" ")}`.slice(0, 170)
}

export function buildSeoLandingJsonLd(landing: SeoLandingData) {
  if (!landing.location) return null

  const canonicalUrl = getSeoLandingUrl(landing.location.slug, landing.category?.slug)
  const siteUrl = getPublicSiteUrl()
  const title = landing.category
    ? `${landing.category.name}: ${landing.location.name}`
    : `Atrakcje: ${landing.location.name}`

  const breadcrumbs = [
    { name: "EnjoyHub", url: siteUrl },
    { name: "Atrakcje", url: `${siteUrl}/attractions` },
    ...(landing.category
      ? [{ name: landing.location.name, url: getSeoLandingUrl(landing.location.slug) }]
      : []),
    { name: title, url: canonicalUrl },
  ]

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description: getSeoLandingDescription(landing),
        inLanguage: "pl-PL",
        breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
        mainEntity: { "@id": `${canonicalUrl}#item-list` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#item-list`,
        numberOfItems: landing.stats.total,
        itemListElement: landing.items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.title,
          url: `${siteUrl}${getSeoAttractionPath(item)}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
    ],
  }
}
