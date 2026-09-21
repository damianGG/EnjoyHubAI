import "server-only"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  findSeoCatalogCity,
  getSeoLandingCatalog,
  getSeoLandingPath,
  isSeoCategoryIndexable,
  isSeoCityIndexable,
} from "@/lib/seo/landings"
import { getPublicSiteUrl } from "@/lib/site-url"
import { publicAttractionPath } from "@/lib/marketplace/attraction-path"
import { slugify } from "@/lib/utils"

export const INDEXNOW_KEY = "db13ebf9007a99a14b35f8d474700d02"
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
const MAX_BATCH_SIZE = 10_000
const PAGE_SIZE = 1000

type IndexNowResult = {
  submitted: number
  batches: number
  ok: boolean
  statuses: number[]
}

type AttractionRow = {
  id: string
  title: string
  city: string
  city_slug?: string | null
  property_type?: string | null
  category_id?: string | null
  seo_excluded?: boolean | null
}

function canonicalSite() {
  const siteUrl = getPublicSiteUrl()
  const url = new URL(siteUrl)
  return { siteUrl, url }
}

function uniquePublicUrls(urls: string[]) {
  const { url: site } = canonicalSite()
  const unique = new Set<string>()

  for (const value of urls) {
    try {
      const url = new URL(value)
      if (url.host !== site.host || !["http:", "https:"].includes(url.protocol)) continue
      unique.add(url.toString())
    } catch {
      // Ignore malformed URLs. IndexNow should never receive them.
    }
  }

  return [...unique]
}

async function submitBatch(urlList: string[]) {
  if (urlList.length === 0) return { ok: true, status: 204 }

  const { siteUrl, url } = canonicalSite()
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return { ok: true, status: 204 }
  }

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: url.host,
        key: INDEXNOW_KEY,
        keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok && response.status !== 202) {
      console.warn("[seo:indexnow] Submission rejected", { status: response.status, count: urlList.length })
    }

    return { ok: response.ok || response.status === 202, status: response.status }
  } catch (error) {
    console.warn("[seo:indexnow] Submission failed", error)
    return { ok: false, status: 0 }
  }
}

export async function submitIndexNowUrls(urls: string[]): Promise<IndexNowResult> {
  const publicUrls = uniquePublicUrls(urls)
  const statuses: number[] = []
  let ok = true

  for (let index = 0; index < publicUrls.length; index += MAX_BATCH_SIZE) {
    const result = await submitBatch(publicUrls.slice(index, index + MAX_BATCH_SIZE))
    statuses.push(result.status)
    ok = ok && result.ok
  }

  return {
    submitted: publicUrls.length,
    batches: Math.ceil(publicUrls.length / MAX_BATCH_SIZE),
    ok,
    statuses,
  }
}

async function attractionCanonicalUrl(attraction: AttractionRow) {
  const { siteUrl } = canonicalSite()
  return `${siteUrl}${publicAttractionPath(attraction)}`
}

export async function submitIndexNowForAttractionId(attractionId: string) {
  if (!isSupabaseAdminConfigured || !attractionId) {
    return { submitted: 0, batches: 0, ok: true, statuses: [] } satisfies IndexNowResult
  }

  const admin = createAdminClient()
  const { data: attraction, error } = await admin
    .from("properties")
    .select("id,title,city,city_slug,property_type,category_id,seo_excluded")
    .eq("id", attractionId)
    .maybeSingle()

  if (error || !attraction) {
    console.warn("[seo:indexnow] Attraction lookup failed", { attractionId, error: error?.message })
    return { submitted: 0, batches: 0, ok: false, statuses: [] } satisfies IndexNowResult
  }

  const row = attraction as AttractionRow
  const { siteUrl } = canonicalSite()
  const urls = [await attractionCanonicalUrl(row), `${siteUrl}/attractions`, `${siteUrl}/sitemap.xml`]

  if (!row.seo_excluded) {
    const catalog = await getSeoLandingCatalog()
    const city = findSeoCatalogCity(catalog, row.city_slug || row.city)
    if (city && isSeoCityIndexable(city)) {
      urls.push(`${siteUrl}${getSeoLandingPath(city.slug)}`)

      if (row.category_id) {
        const { data: category } = await admin
          .from("categories")
          .select("slug")
          .eq("id", row.category_id)
          .maybeSingle()
        const categorySlug = slugify(category?.slug || "")
        const catalogCategory = city.categories.find((item) => item.slug === categorySlug)
        if (catalogCategory && isSeoCategoryIndexable(catalogCategory)) {
          urls.push(`${siteUrl}${getSeoLandingPath(city.slug, catalogCategory.slug)}`)
        }
      }
    }
  }

  return submitIndexNowUrls(urls)
}

async function listIndexableAttractions() {
  if (!isSupabaseAdminConfigured) return [] as AttractionRow[]
  const admin = createAdminClient()
  const rows: AttractionRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("properties")
      .select("id,title,city,city_slug,property_type,category_id,seo_excluded")
      .eq("is_active", true)
      .eq("seo_excluded", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const page = (data ?? []) as AttractionRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

export async function submitIndexNowSeoSnapshot() {
  if (!isSupabaseAdminConfigured) {
    return { submitted: 0, batches: 0, ok: true, statuses: [] } satisfies IndexNowResult
  }

  const { siteUrl } = canonicalSite()
  const [attractions, catalog] = await Promise.all([
    listIndexableAttractions(),
    getSeoLandingCatalog(),
  ])

  const urls = [siteUrl, `${siteUrl}/attractions`, `${siteUrl}/dla-organizatorow`, `${siteUrl}/sitemap.xml`]

  for (const attraction of attractions) {
    urls.push(await attractionCanonicalUrl(attraction))
  }

  for (const city of catalog) {
    if (!isSeoCityIndexable(city)) continue
    urls.push(`${siteUrl}${getSeoLandingPath(city.slug)}`)
    for (const category of city.categories) {
      if (isSeoCategoryIndexable(category)) {
        urls.push(`${siteUrl}${getSeoLandingPath(city.slug, category.slug)}`)
      }
    }
  }

  return submitIndexNowUrls(urls)
}
