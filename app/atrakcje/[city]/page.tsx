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
  isSeoCityIndexable,
} from "@/lib/seo/landings"
import { slugify } from "@/lib/utils"

export const revalidate = 900

interface CityLandingPageProps {
  params: Promise<{ city: string }>
}

export async function generateMetadata({ params }: CityLandingPageProps): Promise<Metadata> {
  const { city } = await params
  const citySlug = slugify(city)
  const [landing, catalog] = await Promise.all([
    getSeoLanding(citySlug),
    getSeoLandingCatalog(),
  ])

  if (!landing?.location || landing.stats.total <= 0) {
    return {
      title: "Atrakcje w mieście",
      robots: { index: false, follow: true },
    }
  }

  const catalogCity = findSeoCatalogCity(catalog, citySlug)
  const indexable = Boolean(catalogCity && isSeoCityIndexable(catalogCity))
  const title = `Atrakcje: ${landing.location.name} – ceny, opinie i bilety`
  const description = getSeoLandingDescription(landing)
  const canonical = getSeoLandingUrl(landing.location.slug)

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

export default async function CityLandingPage({ params }: CityLandingPageProps) {
  const { city } = await params
  const citySlug = slugify(city)
  if (!citySlug) notFound()
  if (city !== citySlug) permanentRedirect(`/atrakcje/${citySlug}`)

  const [landing, catalog] = await Promise.all([
    getSeoLanding(citySlug),
    getSeoLandingCatalog(),
  ])

  const catalogCity = findSeoCatalogCity(catalog, citySlug)
  if (!landing?.location || landing.stats.total <= 0 || !catalogCity) notFound()

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
