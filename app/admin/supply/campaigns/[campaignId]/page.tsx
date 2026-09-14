import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { DiscoveryRunner } from "@/app/admin/supply/campaigns/[campaignId]/discovery-runner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

const supplyRoles = ["platform_superadmin", "platform_support", "platform_content"] as const

export default async function SupplyCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params
  const { supabase } = await requirePlatformStaff(supplyRoles, `/admin/supply/campaigns/${campaignId}`)
  const { data, error } = await supabase.rpc("platform_supply_get_campaign", { p_campaign_id: campaignId })
  const campaign = data as any

  if (error || !campaign) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3"><Link href="/admin/supply/campaigns"><ArrowLeft className="mr-2 h-4 w-4" />Kampanie</Link></Button>
        <Card><CardContent className="py-12 text-center text-destructive">Nie udało się pobrać kampanii.</CardContent></Card>
      </main>
    )
  }

  const stats = campaign.stats ?? {}
  const queries = Array.isArray(campaign.queries) ? campaign.queries : []

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
          <Link href="/admin/supply/campaigns"><ArrowLeft className="mr-2 h-4 w-4" />Kampanie</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">{campaign.category_name}</Badge>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="mt-2 text-muted-foreground">Model: {campaign.discovery_model} · kraj: {campaign.country_code}</p>
          </div>
          <Badge variant={campaign.status === "completed" ? "default" : "secondary"}>{statusLabel(campaign.status)}</Badge>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Zapytania" value={stats.queries_total ?? 0} />
        <StatCard label="Oczekujące" value={stats.queries_pending ?? 0} />
        <StatCard label="Zakończone" value={stats.queries_completed ?? 0} />
        <StatCard label="Kandydaci" value={stats.candidates_found ?? 0} />
        <StatCard label="Nowe leady" value={stats.new_leads ?? 0} />
        <StatCard label="Duplikaty" value={stats.duplicates ?? 0} />
      </div>

      <div className="mb-8">
        <DiscoveryRunner campaignId={campaignId} />
      </div>

      <Card>
        <CardHeader><CardTitle>Zapytania kampanii</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Zapytanie</th>
                <th className="px-5 py-3 font-medium">Region</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Kandydaci</th>
                <th className="px-5 py-3 text-right font-medium">Nowe</th>
                <th className="px-5 py-3 text-right font-medium">Duplikaty</th>
                <th className="px-5 py-3 text-right font-medium">Próby</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((query: any) => (
                <tr key={query.id} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">{query.query_text}</td>
                  <td className="px-5 py-3 text-muted-foreground">{query.location_region || "—"}</td>
                  <td className="px-5 py-3"><Badge variant={query.status === "failed" ? "destructive" : query.status === "completed" ? "default" : "secondary"}>{queryStatusLabel(query.status)}</Badge></td>
                  <td className="px-5 py-3 text-right">{query.candidates_found}</td>
                  <td className="px-5 py-3 text-right">{query.new_leads}</td>
                  <td className="px-5 py-3 text-right">{query.duplicates}</td>
                  <td className="px-5 py-3 text-right">{query.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{String(value)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function statusLabel(status: string) {
  return ({ draft: "Szkic", ready: "Gotowa", running: "W toku", paused: "Wstrzymana", completed: "Zakończona", archived: "Archiwum" } as Record<string, string>)[status] ?? status
}

function queryStatusLabel(status: string) {
  return ({ pending: "Oczekuje", running: "Trwa", completed: "Gotowe", failed: "Błąd", skipped: "Pominięte" } as Record<string, string>)[status] ?? status
}
