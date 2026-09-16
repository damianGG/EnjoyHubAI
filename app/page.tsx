import type { Metadata } from "next"

import { HomeDiscovery } from "@/components/home-discovery"
import { listMarketplaceDiscoveryAttractions, type MarketplaceDiscoveryAttraction } from "@/lib/marketplace/discovery"
import { buildSiteEntityJsonLd, serializeSiteEntityJsonLd } from "@/lib/seo/site-entity"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Atrakcje i bilety online",
  description: "Odkrywaj atrakcje, sprawdzaj dostępne terminy i rezerwuj bilety online w EnjoyHub.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    title: "EnjoyHub – atrakcje i bilety online",
    description: "Odkrywaj atrakcje, sprawdzaj dostępne terminy i rezerwuj bilety online w EnjoyHub.",
  },
}

export default async function Home() {
  const siteEntityJsonLd = buildSiteEntityJsonLd()
  let attractions: MarketplaceDiscoveryAttraction[] = []

  try {
    const result = await listMarketplaceDiscoveryAttractions(50)
    attractions = result.items
  } catch (error) {
    console.error("[home] Failed to load marketplace discovery", error)
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeSiteEntityJsonLd(siteEntityJsonLd) }}
      />
      <HomeDiscovery attractions={attractions} />
    </>
  )
}
