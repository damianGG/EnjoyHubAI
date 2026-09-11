import Link from "next/link"
import { Building2, Plus, Search, ShieldCheck } from "lucide-react"

import { createOrganizationAction } from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

export default async function OrganizationsPage({ searchParams }: { searchParams?: { q?: string; blad?: string } }) {
  const q = searchParams?.q?.trim() ?? ""
  const { supabase, role } = await requirePlatformStaff(undefined, "/admin/organizacje")
  const { data, error } = await supabase.rpc("platform_admin_list_organizations", {
    p_search: q || null,
    p_limit: 250,
  })

  const organizations = (data ?? []) as any[]
  const canCreate = role === "platform_superadmin" || role === "platform_support"

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">Organizacje</Badge>
          <h1 className="text-3xl font-bold">Firmy i organizatorzy</h1>
          <p className="mt-2 text-muted-foreground">Wyszukuj firmy, sprawdzaj konfigurację i wchodź w tryb wsparcia.</p>
        </div>
        <form className="flex w-full max-w-md gap-2" action="/admin/organizacje">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Nazwa, NIP, nazwa prawna…" className="pl-9" />
          </div>
          <Button type="submit" variant="outline">Szukaj</Button>
        </form>
      </div>

      {error && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się pobrać organizacji.</p>}
      {searchParams?.blad && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się wykonać operacji. Sprawdź dane i uprawnienia.</p>}

      {canCreate && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Utwórz organizację za właściciela</CardTitle>
            <CardDescription>Właściciel musi mieć już konto EnjoyHub. Możesz też utworzyć organizację bez właściciela i przypisać go później.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createOrganizationAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Input name="name" required minLength={2} placeholder="Nazwa marki / firmy" />
              <Input name="ownerEmail" type="email" placeholder="E-mail właściciela (opcjonalnie)" />
              <Button type="submit">Utwórz</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {organizations.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Brak organizacji pasujących do wyszukiwania.</CardContent></Card>
        ) : organizations.map((organization) => (
          <Link key={organization.organization_id} href={`/admin/organizacje/${organization.organization_id}`}>
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                <div>
                  <p className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" /> {organization.organization_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{organization.member_count} członków · {organization.venue_count} obiektów · {organization.attraction_count} atrakcji</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{organization.offer_count} ofert</p>
                  <p className="text-muted-foreground">{organization.order_count} zamówień</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{formatMoney(Number(organization.confirmed_revenue), "PLN")}</p>
                  <p className="text-muted-foreground">potwierdzony obrót</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Badge variant={organization.verification_status === "verified" ? "default" : "secondary"}>
                    <ShieldCheck className="mr-1 h-3 w-3" /> {organization.verification_status}
                  </Badge>
                  <Badge variant={organization.payments_enabled ? "default" : "outline"}>{organization.payments_enabled ? "Płatności ON" : "Płatności OFF"}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
