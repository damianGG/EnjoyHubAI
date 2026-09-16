import "server-only"

import { cache } from "react"

import {
  getAttractionCanonicalUrl,
  type PublicAttractionSeoRecord,
} from "@/lib/seo/attraction"
import {
  findSeoCatalogCity,
  getSeoLanding,
  getSeoLandingCatalog,
  getSeoLandingPath,
  isSeoCategoryIndexable,
  isSeoCityIndexable,
  type SeoLandingAttraction,
} from "@/lib/seo/landings"
import { getPublicSiteUrl } from "@/lib/site-url"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { slugify } from "@/lib/utils"

type TaxonomyRecord = {
  id: string
  name: string
  slug: string
}

type PropertyTaxonomyRow = {
  category_id: string | null
  subcategory_id: string | null
  seo_excluded: boolean | null
}

export type SeoInternalLink = {
  name: string
  path: string
}

export type SeoRelatedSection = {
  title: string
  description: string
  path: string
  items: SeoLandingAttraction[]
}

export type SeoAttractionInternalLinking = {
  city: SeoInternalLink | null
  category: SeoInternalLink | null
  categoryLabel: string | null
  breadcrumbs: SeoInternalLink[]
  relatedSections: SeoRelatedSection[]
}

const EMPTY_LINKING: SeoAttractionInternalLinking = {
  city: null,
  category: null,
  categoryLabel: null,
  breadcrumbs: [],
  relatedSections: [],
}

async function getPropertyTaxonomy(propertyId: string) {
  if (!isSupabaseAdminConfigured) return null

  const admin = createAdminClient()
  const { data: property, error } = await admin
    .from("properties")
    .select("category_id,subcategory_id,seo_excluded")
    .eq("id", propertyId)
    .maybeSingle()

  if (error) throw error
  if (!property) return null

  const row = property as PropertyTaxonomyRow
  const [categoryResult, subcategoryResult] = await Promise.all([
    row.category_id
      ? admin.from("categories").select("id,name,slug").eq("id", row.category_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.subcategory_id
      ? admin.from("subcategories").select("id,name,slug").eq("id", row.subcategory_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (categoryResult.error) throw categoryResult.error
  if (subcategoryResult.error) throw subcategoryResult.error

  return {
    seoExcluded: Boolean(row.seo_excluded),
    category: categoryResult.data as TaxonomyRecord | null,
    subcategory: subcategoryResult.data as TaxonomyRecord | null,
  }
}

async function removeSeoExcluded(items: SeoLandingAttraction[]) {
  if (!isSupabaseAdminConfigured || items.length === 0) return []

  const admin = createAdminClient()
  const ids = [...new Set(items.map((item) => item.id).filter(Boolean))]
  if (ids.length === 0) return []

  const { data, error } = await admin
    .from("properties")
    .select("id")
    .in("id", ids)
    .eq("is_active", true)
    .eq("seo_excluded", false)

  if (error) throw error
  const allowed = new Set((data ?? []).map((row) => String(row.id)))
  return items.filter((item) => allowed.has(item.id))
}

export const getAttractionInternalLinking = cache(async (
  attraction: Pick<PublicAttractionSeoRecord, "id" | "city">,
): Promise<SeoAttractionInternalLinking> => {
  if (!isSupabaseAdminConfigured || !attraction.id || !attraction.city) return EMPTY_LINKING

  const [taxonomy, catalog] = await Promise.all([
    getPropertyTaxonomy(attraction.id),
    getSeoLandingCatalog(),
  ])

  if (!taxonomy || taxonomy.seoExcluded) return EMPTY_LINKING

  const catalogCity = findSeoCatalogCity(catalog, attraction.city)
  if (!catalogCity || !isSeoCityIndexable(catalogCity)) {
    return {
      ...EMPTY_LINKING,
      categoryLabel: taxonomy.subcategory?.name || taxonomy.category?.name || null,
    }
  }

  const city: SeoInternalLink = {
    name: catalogCity.name,
    path: getSeoLandingPath(catalogCity.slug),
  }

  const categorySlug = slugify(taxonomy.category?.slug || "")
  const catalogCategory = categorySlug
    ? catalogCity.categories.find((item) => item.slug === categorySlug) ?? null
    : null
  const category = catalogCategory && isSeoCategoryIndexable(catalogCategory)
    ? {
        name: catalogCategory.name,
        path: getSeoLandingPath(catalogCity.slug, catalogCategory.slug),
      }
    : null

  const [cityLanding, categoryLanding] = await Promise.all([
    getSeoLanding(catalogCity.slug),
    category ? getSeoLanding(catalogCity.slug, catalogCategory!.slug) : Promise.resolve(null),
  ])

  const candidateItems = [
    ...(categoryLanding?.items ?? []),
    ...(cityLanding?.items ?? []),
  ]
  const allowedItems = await removeSeoExcluded(candidateItems)
  const allowedIds = new Set(allowedItems.map((item) => item.id))

  const categoryItems = categoryLanding
    ? categoryLanding.items
        .filter((item) => item.id !== attraction.id && allowedIds.has(item.id))
        .slice(0, 4)
    : []
  const categoryItemIds = new Set(categoryItems.map((item) => item.id))
  const cityItems = cityLanding
    ? cityLanding.items
        .filter((item) => item.id !== attraction.id && allowedIds.has(item.id) && !categoryItemIds.has(item.id))
        .slice(0, 4)
    : []

  const relatedSections: SeoRelatedSection[] = []
  if (category && categoryItems.length >= 2) {
    relatedSections.push({
      title: `Więcej: ${category.name} w ${catalogCity.name}`,
      description: "Podobne miejsca z tej samej kategorii w mieście.",
      path: category.path,
      items: categoryItems,
    })
  }
  if (cityItems.length >= 2) {
    relatedSections.push({
      title: `Więcej atrakcji w ${catalogCity.name}`,
      description: "Inne aktywne miejsca dostępne w tym mieście.",
      path: city.path,
      items: cityItems,
    })
  }

  return {
    city,
    category,
    categoryLabel: taxonomy.subcategory?.name || taxonomy.category?.name || null,
    breadcrumbs: [city, ...(category ? [category] : [])],
    relatedSections,
  }
})

export function applyAttractionInternalBreadcrumbs(
  jsonLd: unknown,
  attraction: Pick<PublicAttractionSeoRecord, "id" | "title" | "city" | "property_type">,
  linking: SeoAttractionInternalLinking,
) {
  if (!jsonLd || typeof jsonLd !== "object") return jsonLd

  const graph = (jsonLd as { "@graph"?: Array<Record<string, unknown>> })["@graph"]
  if (!Array.isArray(graph)) return jsonLd

  const breadcrumb = graph.find((node) => node["@type"] === "BreadcrumbList")
  if (!breadcrumb) return jsonLd

  const siteUrl = getPublicSiteUrl()
  const canonicalUrl = getAttractionCanonicalUrl(attraction)
  const trail = [
    { name: "EnjoyHub", url: siteUrl },
    { name: "Atrakcje", url: `${siteUrl}/attractions` },
    ...linking.breadcrumbs.map((item) => ({ name: item.name, url: `${siteUrl}${item.path}` })),
    { name: attraction.title, url: canonicalUrl },
  ]

  breadcrumb.itemListElement = trail.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  }))

  return jsonLd
}
