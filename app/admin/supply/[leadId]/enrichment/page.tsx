import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { SupplyEnrichmentPanel } from "@/components/admin/supply-enrichment-panel"
import { Badge } from "@/components/ui/badge"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

const supplyRoles = ["platform_superadmin", "platform_support", "platform_content"] as const

export default async function SupplyEnrichmentPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params
  const next = `/admin/supply/${leadId}/enrichment`
  const { supabase } = await requirePlatformStaff(supplyRoles, next)

  const [{ data: lead, error: leadError }, { data: enrichment, error: enrichmentError }] = await Promise.all([
    supabase.rpc("platform_supply_get_lead", { p_lead_id: leadId }),
    supabase.rpc("platform_supply_get_enrichment", { p_lead_id: leadId }),
  ])

  if (leadError || enrichmentError || !lead) notFound()

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <Link href={`/admin/supply/${leadId}`} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Wróć do obiektu
      </Link>

      <div className="mb-8">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="secondary">AI Enrichment</Badge>
          <Badge variant="outline">{(lead as any).categoryName || "Bez kategorii"}</Badge>
          {(lead as any).subcategoryName && <Badge variant="outline">{(lead as any).subcategoryName}</Badge>}
        </div>
        <h1 className="text-3xl font-bold">{(lead as any).name}</h1>
        <p className="mt-2 text-muted-foreground">Research, źródła, nowe atrybuty i zewnętrzne oceny przed publikacją lub aktualizacją profilu.</p>
      </div>

      <SupplyEnrichmentPanel leadId={leadId} enrichment={(enrichment || {}) as any} />
    </main>
  )
}
