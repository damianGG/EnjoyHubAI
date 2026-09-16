import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import AttractionsView from "@/components/attractions-view"
import { DiscoveryChrome } from "@/components/discovery-chrome"
import { listMarketplaceDiscoveryAttractions, type MarketplaceDiscoveryAttraction } from "@/lib/marketplace/discovery"

export const revalidate = 60

export default async function AttractionsPage() {
  let data: MarketplaceDiscoveryAttraction[] = []
  let errorMessage: string | null = null

  try {
    const discovery = await listMarketplaceDiscoveryAttractions(50)
    data = discovery.items
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
                <p className="font-semibold">Podgląd nowego interfejsu jest aktywny</p>
                <p className="mt-0.5 text-muted-foreground">{errorMessage} Połączenie danych można naprawić niezależnie od warstwy wizualnej.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <AttractionsView attractions={data} mobileImmersive />
      </main>
    </DiscoveryChrome>
  )
}
