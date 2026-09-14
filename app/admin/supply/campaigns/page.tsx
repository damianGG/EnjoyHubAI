import Link from "next/link"
import { ArrowLeft, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

const supplyRoles = ["platform_superadmin", "platform_support", "platform_content"] as const

export default async function SupplyCampaignsPage() {
  const { supabase } = await requirePlatformStaff(supplyRoles, "/admin/supply/campaigns")
  const { data, error } = await supabase.rpc("platform_supply_list_campaigns")
  const campaigns = (data ?? []) as any[]

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
            <Link href="/admin/supply"><ArrowLeft className="mr-2 h-4 w-4" />Supply</Link>
          </Button>
          <Badge variant="secondary" className="mb-3 block w-fit">Supply Campaigns</Badge>
          <h1 className="text-3xl font-bold">Kampanie Discovery</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Kampanie wyszukują operatorów kategoriami i lokalizacjami, deduplikują wyniki i zapisują nowych kandydatów do Supply.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Nie udało się pobrać kampanii Discovery.
        </div>
      )}

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Brak kampanii.</CardContent></Card>
        ) : campaigns.map((campaign) => (
          <Card key={campaign.campaign_id}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />{campaign.campaign_name}</CardTitle>
                  <CardDescription className="mt-1">{campaign.category_name} · Polska</CardDescription>
                </div>
                <Badge variant={campaign.campaign_status === "completed" ? "default" : "secondary"}>{statusLabel(campaign.campaign_status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end">
              <Stat label="Zapytania" value={`${campaign.queries_completed}/${campaign.queries_total}`} />
              <Stat label="Kandydaci" value={campaign.candidates_found} />
              <Stat label="Nowe leady" value={campaign.new_leads} />
              <Stat label="Duplikaty" value={campaign.duplicates} />
              <Button asChild><Link href={`/admin/supply/campaigns/${campaign.campaign_id}`}>Otwórz kampanię</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-2xl font-bold">{String(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function statusLabel(status: string) {
  return ({ draft: "Szkic", ready: "Gotowa", running: "W toku", paused: "Wstrzymana", completed: "Zakończona", archived: "Archiwum" } as Record<string, string>)[status] ?? status
}
