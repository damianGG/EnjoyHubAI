import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import { MarketplaceSeoLanding } from "@/components/seo/marketplace-landing"
import { serializeJsonLd } from "@/lib/seo/attraction"
import {
  buildSeoLandingJsonLd,
  findSeoCatalogCity,
  getSeoLanding,
  getSeoLandingCatalog,
  getSeoLandingDescription,
  getSeoLandingUrl,
  isSeoCategoryIndexable,
} from "@/lib/seo/landings"
import { slugify } from "@/lib/utils"

export const revalidate = 900

interface CategoryLandingPageProps {
  params: Promise<{ city: string; category: string }>
}

export async function generateMetadata({ params }: CategoryLandingPageProps): Promise<Metadata> {
  const { city, category } = await params
  const citySlug = slugify(city)
  const categorySlug = slugify(category)
  const [landing, catalog] = await Promise.all([
    getSeoLanding(citySlug, categorySlug),
    getSeoLandingCatalog(),
  ])

  if (!landing?.location || !landing.category || landing.stats.total <= 0) {
    return {
      title: "Atrakcje w kategorii",
      robots: { index: false, follow: true },
    }
  }

  const catalogCity = findSeoCatalogCity(catalog, citySlug)
  const catalogCategory = catalogCity?.categories.find((item) => item.slug === categorySlug) ?? null
  const indexable = Boolean(catalogCategory && isSeoCategoryIndexable(catalogCategory))
  const title = `${landing.category.name}: ${landing.location.name} – ceny i bilety`
  const description = getSeoLandingDescription(landing)
  const canonical = getSeoLandingUrl(landing.location.slug, landing.category.slug)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: "EnjoyHub",
      url: canonical,
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  }
}

export default async function CategoryLandingPage({ params }: CategoryLandingPageProps) {
  const { city, category } = await params
  const citySlug = slugify(city)
  const categorySlug = slugify(category)
  if (!citySlug || !categorySlug) notFound()
  if (city !== citySlug || category !== categorySlug) {
    permanentRedirect(`/atrakcje/${citySlug}/${categorySlug}`)
  }

  const [landing, catalog] = await Promise.all([
    getSeoLanding(citySlug, categorySlug),
    getSeoLandingCatalog(),
  ])

  const catalogCity = findSeoCatalogCity(catalog, citySlug)
  const catalogCategory = catalogCity?.categories.find((item) => item.slug === categorySlug) ?? null
  if (!landing?.location || !landing.category || landing.stats.total <= 0 || !catalogCity || !catalogCategory) {
    notFound()
  }

  const jsonLd = buildSeoLandingJsonLd(landing)

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      ) : null}
      <MarketplaceSeoLanding landing={landing} catalogCity={catalogCity} />
    </>
  )
}
