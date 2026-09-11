import Link from "next/link"
import { ArrowLeft, Building2, LifeBuoy, MapPin, ShieldAlert, Ticket, Users } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { clearSupportContextAction } from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

export default async function SupportModePage({ params }: { params: { organizationId: string } }) {
  const next = `/admin/wsparcie/${params.organizationId}`
  const { supabase, user } = await requirePlatformStaff(["platform_superadmin", "platform_support"], next)
  const { data: context } = await supabase
    .from("platform_support_context")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (context?.organization_id !== params.organizationId) redirect(`/admin/organizacje/${params.organizationId}`)

  const { data, error } = await supabase.rpc("platform_admin_get_organization", { p_organization_id: params.organizationId })
  if (error || !data) notFound()

  const payload = data as any
  const organization = payload.organization
  const members = payload.members ?? []
  const venues = payload.venues ?? []
  const attractions = payload.attractions ?? []
  const offers = payload.offers ?? []
  const metrics = payload.metrics ?? {}

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/organizacje/${organization.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Karta organizacji</Link>
        <form action={clearSupportContextAction}><Button type="submit" variant="outline">Zakończ tryb wsparcia</Button></form>
      </div>

      <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Działasz jako administrator EnjoyHub, nie jako właściciel konta.</p>
            <p className="mt-1 text-sm text-amber-800">Zmiany wykonane podczas pomocy są przypisywane do Twojego konta administratora i widoczne w audycie.</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <Badge variant="secondary" className="mb-3"><LifeBuoy className="mr-1 h-3 w-3" /> Tryb wsparcia</Badge>
        <h1 className="text-3xl font-bold">{organization.name}</h1>
        <p className="mt-2 text-muted-foreground">Szybki obraz tego, co widzi i konfiguruje organizator.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Obiekty" value={venues.length} />
        <Metric label="Atrakcje" value={attractions.length} />
        <Metric label="Oferty" value={offers.length} />
        <Metric label="Potwierdzony obrót" value={formatMoney(Number(metrics.revenue ?? 0), "PLN")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Struktura</CardTitle><CardDescription>Obiekty i atrakcje, które są skonfigurowane dla firmy.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {venues.map((venue: any) => (
              <div key={venue.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3"><p className="font-medium">{venue.name}</p><Badge variant="outline">{venue.status}</Badge></div>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3 w-3" /> {[venue.address, venue.city].filter(Boolean).join(", ") || "Brak adresu"}</p>
                <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                  {attractions.filter((attraction: any) => attraction.venueId === venue.id).map((attraction: any) => <p key={attraction.id}>• {attraction.title} <span className="text-muted-foreground">({attraction.isActive ? "aktywna" : "szkic"})</span></p>)}
                </div>
              </div>
            ))}
            {venues.length === 0 && <p className="text-sm text-muted-foreground">Firma nie ma jeszcze żadnego obiektu.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> Sprzedaż</CardTitle><CardDescription>Oferty i stan sprzedaży bez przejmowania sesji właściciela.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {offers.map((offer: any) => <div key={offer.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><p className="font-medium">{offer.name}</p><p className="text-muted-foreground">{offer.durationMinutes} min</p></div><Badge variant="outline">{offer.status}</Badge></div>)}
            {offers.length === 0 && <p className="text-sm text-muted-foreground">Brak skonfigurowanych ofert.</p>}
            <div className="rounded-lg bg-muted p-4 text-sm">Zamówienia: <strong>{metrics.orders ?? 0}</strong> · Potwierdzone: <strong>{metrics.confirmedOrders ?? 0}</strong> · Wykorzystane bilety: <strong>{metrics.usedTickets ?? 0}/{metrics.tickets ?? 0}</strong></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Dostęp zespołu</CardTitle><CardDescription>Sprawdź, czy problem nie wynika z roli lub braku członkostwa.</CardDescription></CardHeader>
          <CardContent className="divide-y rounded-lg border p-0">
            {members.map((member: any) => <div key={member.userId} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className="font-medium">{member.fullName || member.email}</p><p className="text-muted-foreground">{member.email}</p></div><Badge variant="outline">{member.role}</Badge></div>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Szybka pomoc</CardTitle><CardDescription>Zmiany konfiguracyjne wykonuj z karty organizacji — zostaną zapisane w audycie.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full"><Link href={`/admin/organizacje/${organization.id}`}>Edytuj organizację / dodaj obiekt</Link></Button>
            <Button asChild variant="outline" className="w-full"><Link href={`/admin/audyt?organizationId=${organization.id}`}>Historia działań administratorów</Link></Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>
}
