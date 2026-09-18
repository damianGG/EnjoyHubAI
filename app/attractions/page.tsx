import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircle, MapPin } from "lucide-react"

import AttractionsView from "@/components/attractions-view"
import { DiscoveryChrome } from "@/components/discovery-chrome"
import { Card, CardContent } from "@/components/ui/card"
import { listMarketplaceDiscoveryAttractions, type MarketplaceDiscoveryAttraction } from "@/lib/marketplace/discovery"
import { getSeoLandingCatalog, getSeoLandingPath, isSeoCityIndexable } from "@/lib/seo/landings"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Atrakcje w Polsce – terminy, ceny i bilety",
  description: "Znajdź atrakcje w Polsce, porównaj miejsca, ceny i dostępne terminy oraz zarezerwuj bilety online.",
  alternates: {
    canonical: "/attractions",
  },
  openGraph: {
    url: "/attractions",
    title: "Atrakcje w Polsce – terminy, ceny i bilety | EnjoyHub",
    description: "Znajdź atrakcje w Polsce, porównaj miejsca, ceny i dostępne terminy oraz zarezerwuj bilety online.",
  },
}

export default async function AttractionsPage() {
  let data: MarketplaceDiscoveryAttraction[] = []
  let errorMessage: string | null = null
  let indexableCities: Array<{ slug: string; name: string; activeCount: number }> = []

  try {
    const [discovery, catalog] = await Promise.all([
      listMarketplaceDiscoveryAttractions(50),
      getSeoLandingCatalog(),
    ])
    data = discovery.items
    indexableCities = catalog
      .filter(isSeoCityIndexable)
      .map((city) => ({ slug: city.slug, name: city.name, activeCount: city.activeCount }))
      .slice(0, 12)
  } catch (error) {
    console.error("[attractions] Failed to load marketplace discovery", error)
    errorMessage = "Nie udało się pobrać listy atrakcji w tym środowisku."
  }

  return (
    <DiscoveryChrome>
      <main className="h-full min-h-0 md:mx-auto md:h-auto md:w-full md:max-w-[1600px] md:px-4 md:py-5 xl:px-6">
        {errorMessage ? (
          <Card className="mx-3 mb-3 border-primary/15 bg-secondary/60 shadow-none md:mx-0 md:mb-5">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Nie udało się wczytać atrakcji</p>
                <p className="mt-0.5 text-muted-foreground">{errorMessage} Spróbuj odświeżyć stronę za chwilę.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {indexableCities.length > 0 ? (
          <nav aria-label="Atrakcje według miasta" className="mx-3 mb-3 md:mx-0 md:mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Popularne miasta
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {indexableCities.map((city) => (
                <Link
                  key={city.slug}
                  href={getSeoLandingPath(city.slug)}
                  className="shrink-0 rounded-full border bg-white px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:border-primary/30 hover:text-primary"
                >
                  {city.name} <span className="text-muted-foreground">({city.activeCount})</span>
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        <AttractionsView attractions={data} mobileImmersive />
      </main>
    </DiscoveryChrome>
  )
}
