import "server-only"

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  SEO_CITY_CATEGORY_MIN_OBJECTS,
  SEO_CITY_MIN_OBJECTS,
  getSeoLandingCatalog,
  isSeoCategoryIndexable,
  isSeoCityIndexable,
} from "@/lib/seo/landings"
import { publicAttractionPath } from "@/lib/marketplace/attraction-path"

const PAGE_SIZE = 1000

export const SEO_PROFILE_REQUIREMENTS = [
  "title",
  "description",
  "address",
  "category",
  "image",
  "gps",
] as const

export type SeoProfileRequirement = (typeof SEO_PROFILE_REQUIREMENTS)[number]

const requirementLabels: Record<SeoProfileRequirement, string> = {
  title: "tytuł ≥ 5 znaków",
  description: "opis ≥ 50 znaków",
  address: "adres ≥ 8 znaków",
  category: "kategoria",
  image: "min. 1 zdjęcie",
  gps: "poprawny GPS",
}

type PropertyRow = {
  id: string
  title: string | null
  description: string | null
  address: string | null
  city: string | null
  city_slug: string | null
  property_type: string | null
  latitude: number | null
  longitude: number | null
  images: string[] | null
  category_id: string | null
  seo_excluded: boolean | null
  is_active: boolean | null
  updated_at: string | null
}

export type SeoQualityProfile = {
  id: string
  title: string
  city: string
  score: number
  missing: SeoProfileRequirement[]
  missingLabels: string[]
  seoEligible: boolean
  seoExcluded: boolean
  canonicalPath: string
  updatedAt: string | null
}

export type SeoQualityCity = {
  slug: string
  name: string
  activeCount: number
  seoEligibleCount: number
  indexable: boolean
  threshold: number
  categoryCount: number
  indexableCategoryCount: number
}

export type SeoQualityDashboard = {
  totalActive: number
  eligibleProfiles: number
  excludedProfiles: number
  averageScore: number
  indexableCities: number
  indexableCategories: number
  profiles: SeoQualityProfile[]
  cities: SeoQualityCity[]
}

function textLength(value: unknown) {
  return typeof value === "string" ? value.trim().length : 0
}

function validCoordinate(value: unknown, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max
}

function missingRequirements(row: PropertyRow): SeoProfileRequirement[] {
  const missing: SeoProfileRequirement[] = []
  if (textLength(row.title) < 5) missing.push("title")
  if (textLength(row.description) < 50) missing.push("description")
  if (textLength(row.address) < 8) missing.push("address")
  if (!row.category_id) missing.push("category")
  if (!Array.isArray(row.images) || row.images.filter(Boolean).length < 1) missing.push("image")
  if (!validCoordinate(row.latitude, -90, 90) || !validCoordinate(row.longitude, -180, 180)) missing.push("gps")
  return missing
}

async function listActiveProperties() {
  if (!isSupabaseAdminConfigured) return [] as PropertyRow[]
  const admin = createAdminClient()
  const rows: PropertyRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("properties")
      .select("id,title,description,address,city,city_slug,property_type,latitude,longitude,images,category_id,seo_excluded,is_active,updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const page = (data ?? []) as PropertyRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

export async function getSeoQualityDashboard(): Promise<SeoQualityDashboard> {
  const [rows, catalog] = await Promise.all([
    listActiveProperties(),
    getSeoLandingCatalog(),
  ])

  const profiles = rows.map((row): SeoQualityProfile => {
    const missing = missingRequirements(row)
    const passed = SEO_PROFILE_REQUIREMENTS.length - missing.length
    const score = Math.round((passed / SEO_PROFILE_REQUIREMENTS.length) * 100)
    const title = row.title?.trim() || "Bez nazwy"
    const city = row.city?.trim() || "Brak miasta"
    const canonicalPath = publicAttractionPath({
      id: row.id,
      title,
      city,
      property_type: row.property_type,
    })

    return {
      id: row.id,
      title,
      city,
      score,
      missing,
      missingLabels: missing.map((requirement) => requirementLabels[requirement]),
      seoEligible: missing.length === 0 && !row.seo_excluded,
      seoExcluded: Boolean(row.seo_excluded),
      canonicalPath,
      updatedAt: row.updated_at,
    }
  })

  profiles.sort((a, b) => {
    if (a.seoExcluded !== b.seoExcluded) return a.seoExcluded ? -1 : 1
    if (a.seoEligible !== b.seoEligible) return a.seoEligible ? 1 : -1
    if (a.score !== b.score) return a.score - b.score
    return a.title.localeCompare(b.title, "pl")
  })

  const cities: SeoQualityCity[] = catalog.map((city) => ({
    slug: city.slug,
    name: city.name,
    activeCount: city.activeCount,
    seoEligibleCount: city.seoEligibleCount,
    indexable: isSeoCityIndexable(city),
    threshold: SEO_CITY_MIN_OBJECTS,
    categoryCount: city.categories.length,
    indexableCategoryCount: city.categories.filter(isSeoCategoryIndexable).length,
  }))

  cities.sort((a, b) => {
    if (a.indexable !== b.indexable) return a.indexable ? -1 : 1
    return b.seoEligibleCount - a.seoEligibleCount || a.name.localeCompare(b.name, "pl")
  })

  const eligibleProfiles = profiles.filter((profile) => profile.seoEligible).length
  const excludedProfiles = profiles.filter((profile) => profile.seoExcluded).length
  const averageScore = profiles.length
    ? Math.round(profiles.reduce((sum, profile) => sum + profile.score, 0) / profiles.length)
    : 0

  return {
    totalActive: profiles.length,
    eligibleProfiles,
    excludedProfiles,
    averageScore,
    indexableCities: cities.filter((city) => city.indexable).length,
    indexableCategories: catalog.reduce(
      (sum, city) => sum + city.categories.filter(isSeoCategoryIndexable).length,
      0,
    ),
    profiles,
    cities,
  }
}

export function seoProfileRequirementLabel(requirement: SeoProfileRequirement) {
  return requirementLabels[requirement]
}

export const SEO_LOCAL_THRESHOLDS = {
  city: SEO_CITY_MIN_OBJECTS,
  cityCategory: SEO_CITY_CATEGORY_MIN_OBJECTS,
} as const
