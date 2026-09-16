import type { MetadataRoute } from "next"

import {
  getSeoLandingCatalog,
  getSeoLandingPath,
  isSeoCategoryIndexable,
  isSeoCityIndexable,
} from "@/lib/seo/landings"
import { getPublicSiteUrl } from "@/lib/site-url"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { generateAttractionSlug } from "@/lib/utils"

export const revalidate = 900

const PAGE_SIZE = 1000

type SitemapAttraction = {
  id: string
  title: string
  city: string
  property_type: string | null
  updated_at: string | null
  seo_excluded: boolean | null
  is_test_data: boolean | null
}

async function listAllPublicAttractions(): Promise<SitemapAttraction[]> {
  if (!isSupabaseAdminConfigured) return []

  const supabase = createAdminClient()
  const attractions: SitemapAttraction[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("properties")
      .select("id,title,city,property_type,updated_at,seo_excluded,is_test_data")
      .eq("is_active", true)
      .eq("seo_excluded", false)
      .eq("is_test_data", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as SitemapAttraction[]
    attractions.push(...page)

    if (page.length < PAGE_SIZE) break
  }

  return attractions
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/attractions`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/dla-organizatorow`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ]

  try {
    const [attractions, catalog] = await Promise.all([
      listAllPublicAttractions(),
      getSeoLandingCatalog(),
    ])

    const attractionRoutes: MetadataRoute.Sitemap = attractions
      .filter((attraction) => attraction.id && attraction.title && attraction.city)
      .map((attraction) => {
        const slug = generateAttractionSlug({
          id: attraction.id,
          title: attraction.title,
          city: attraction.city,
          category: attraction.property_type,
        })

        return {
          url: `${siteUrl}/attractions/${slug}`,
          lastModified: attraction.updated_at || undefined,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }
      })

    const localLandingRoutes: MetadataRoute.Sitemap = catalog.flatMap((city) => {
      if (!isSeoCityIndexable(city)) return []

      const cityRoute: MetadataRoute.Sitemap[number] = {
        url: `${siteUrl}${getSeoLandingPath(city.slug)}`,
        changeFrequency: "daily",
        priority: 0.85,
      }

      const categoryRoutes: MetadataRoute.Sitemap = city.categories
        .filter(isSeoCategoryIndexable)
        .map((category) => ({
          url: `${siteUrl}${getSeoLandingPath(city.slug, category.slug)}`,
          changeFrequency: "daily" as const,
          priority: 0.82,
        }))

      return [cityRoute, ...categoryRoutes]
    })

    return [...staticRoutes, ...localLandingRoutes, ...attractionRoutes]
  } catch (error) {
    console.error("[seo:sitemap] Failed to load public SEO routes", error)
    return staticRoutes
  }
}
