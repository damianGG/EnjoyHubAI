import Link from "next/link"
import { Building2, ClipboardList, CreditCard, LifeBuoy, ShieldCheck, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { canPlatformSupport, requirePlatformStaff } from "@/lib/platform-admin/access"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

interface OrganizationRow {
  organization_id: string
  organization_name: string
  verification_status: string
  payments_enabled: boolean
  member_count: number
  venue_count: number
  attraction_count: number
  offer_count: number
  order_count: number
  confirmed_revenue: number | string
}

export default async function AdminDashboard() {
  const { supabase, role } = await requirePlatformStaff(undefined, "/admin")
  const [{ data: organizations }, { data: audit }] = await Promise.all([
    supabase.rpc("platform_admin_list_organizations", { p_search: null, p_limit: 250 }),
    supabase.rpc("platform_admin_list_audit", { p_organization_id: null, p_limit: 8 }),
  ])

  const orgs = (organizations ?? []) as OrganizationRow[]
  const revenue = orgs.reduce((sum, organization) => sum + Number(organization.confirmed_revenue), 0)
  const pendingVerification = orgs.filter((organization) => organization.verification_status === "pending").length
  const activePayments = orgs.filter((organization) => organization.payments_enabled).length

  let userCount: number | null = null
  if (canPlatformSupport(role)) {
    const { data: users } = await supabase.rpc("platform_admin_list_users", { p_search: null, p_limit: 250 })
    userCount = users?.length ?? 0
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">Administracja platformą</Badge>
          <h1 className="text-3xl font-bold">Centrum operacyjne EnjoyHub</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Organizacje, użytkownicy, weryfikacja, sprzedaż i wsparcie właścicieli w jednym miejscu.
          </p>
        </div>
        <Link href="/admin/organizacje" className="text-sm font-medium text-primary hover:underline">Przejdź do organizacji →</Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={Building2} label="Organizacje" value={String(orgs.length)} />
        <Metric icon={ShieldCheck} label="Do weryfikacji" value={String(pendingVerification)} />
        <Metric icon={CreditCard} label="Aktywne płatności" value={String(activePayments)} />
        <Metric icon={Users} label="Użytkownicy" value={userCount === null ? "—" : String(userCount)} />
        <Metric icon={CreditCard} label="Potwierdzony obrót" value={formatMoney(revenue, "PLN")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Organizacje wymagające uwagi</CardTitle>
            <CardDescription>Najpierw weryfikacja, brak aktywnych płatności i brak kompletnej konfiguracji.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {orgs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Brak organizacji.</p>
            ) : orgs.slice(0, 10).map((organization) => (
              <Link key={organization.organization_id} href={`/admin/organizacje/${organization.organization_id}`} className="flex items-center justify-between gap-4 py-4 hover:text-primary">
                <div>
                  <p className="font-medium">{organization.organization_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {organization.venue_count} obiektów · {organization.attraction_count} atrakcji · {organization.offer_count} ofert
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>{organization.verification_status === "verified" ? "Zweryfikowana" : `Weryfikacja: ${organization.verification_status}`}</p>
                  <p className="text-muted-foreground">{organization.order_count} zamówień</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Ostatnie działania</CardTitle>
            <CardDescription>Każda operacja administratora jest zapisywana.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(audit ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wpisów audytowych.</p>
            ) : (audit ?? []).map((entry: any) => (
              <div key={entry.audit_id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{entry.action}</p>
                <p className="mt-1 text-xs text-muted-foreground">{entry.actor_email} · {new Date(entry.created_at).toLocaleString("pl-PL")}</p>
              </div>
            ))}
            <Link href="/admin/audyt" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <LifeBuoy className="h-4 w-4" /> Zobacz pełny dziennik
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  )
}
