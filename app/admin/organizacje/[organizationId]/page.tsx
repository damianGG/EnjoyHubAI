import Link from "next/link"
import { ArrowLeft, Building2, LifeBuoy, MapPin, Plus, ShieldCheck, Ticket, Users } from "lucide-react"
import { notFound } from "next/navigation"

import {
  activateSupportContextAction,
  assignOrganizationMemberAction,
  createAttractionDraftAction,
  createVenueAction,
  updateOrganizationAction,
} from "@/app/admin/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { canPlatformContent, canPlatformSupport, requirePlatformStaff } from "@/lib/platform-admin/access"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

export default async function OrganizationAdminPage({
  params,
  searchParams,
}: {
  params: { organizationId: string }
  searchParams?: { ok?: string; blad?: string }
}) {
  const next = `/admin/organizacje/${params.organizationId}`
  const { supabase, role } = await requirePlatformStaff(undefined, next)
  const { data, error } = await supabase.rpc("platform_admin_get_organization", {
    p_organization_id: params.organizationId,
  })
  if (error || !data) notFound()

  const payload = data as any
  const organization = payload.organization
  const members = payload.members ?? []
  const venues = payload.venues ?? []
  const attractions = payload.attractions ?? []
  const offers = payload.offers ?? []
  const metrics = payload.metrics ?? {}
  const canSupport = canPlatformSupport(role)
  const canContent = canPlatformContent(role)
  const canEditOrganization = role === "platform_superadmin"

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <Link href="/admin/organizacje" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Wszystkie organizacje
      </Link>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge>{organization.status}</Badge>
            <Badge variant={organization.verification_status === "verified" ? "default" : "secondary"}>
              <ShieldCheck className="mr-1 h-3 w-3" /> {organization.verification_status}
            </Badge>
            <Badge variant={organization.payments_enabled ? "default" : "outline"}>{organization.payments_enabled ? "Płatności aktywne" : "Płatności wyłączone"}</Badge>
          </div>
          <h1 className="text-3xl font-bold">{organization.name}</h1>
          <p className="mt-2 text-muted-foreground">ID: {organization.id}</p>
        </div>
        {canSupport && (
          <form action={activateSupportContextAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <Button type="submit" className="gap-2"><LifeBuoy className="h-4 w-4" /> Wejdź w tryb wsparcia</Button>
          </form>
        )}
      </div>

      {searchParams?.ok && <p className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">Zmiana została zapisana.</p>}
      {searchParams?.blad && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się wykonać operacji. Sprawdź dane i uprawnienia.</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Członkowie" value={members.length} />
        <Metric label="Obiekty" value={venues.length} />
        <Metric label="Atrakcje" value={attractions.length} />
        <Metric label="Oferty" value={offers.length} />
        <Metric label="Obrót" value={formatMoney(Number(metrics.revenue ?? 0), "PLN")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Zespół</CardTitle>
            <CardDescription>Administrator platformy może przypisać istniejące konto do tej organizacji.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y rounded-lg border">
              {members.map((member: any) => (
                <div key={member.userId} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div><p className="font-medium">{member.fullName || member.email}</p><p className="text-muted-foreground">{member.email}</p></div>
                  <Badge variant="outline">{member.role}</Badge>
                </div>
              ))}
              {members.length === 0 && <p className="p-4 text-sm text-muted-foreground">Brak przypisanych osób.</p>}
            </div>
            {canSupport && (
              <form action={assignOrganizationMemberAction} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <input type="hidden" name="organizationId" value={organization.id} />
                <Input name="email" type="email" required placeholder="E-mail istniejącego konta" />
                <select name="role" defaultValue="manager" className="h-10 rounded-md border bg-background px-3 text-sm">
                  {role === "platform_superadmin" && <option value="owner">Właściciel</option>}
                  <option value="admin">Administrator firmy</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Obsługa wejścia</option>
                  <option value="viewer">Podgląd</option>
                </select>
                <Button type="submit">Przypisz</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Obiekty</CardTitle>
            <CardDescription>Lokalizacje należące do organizacji.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {venues.map((venue: any) => (
                <div key={venue.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><p className="font-medium">{venue.name}</p><Badge variant="outline">{venue.status}</Badge></div>
                  <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" /> {[venue.address, venue.city].filter(Boolean).join(", ") || "Brak adresu"}</p>
                </div>
              ))}
              {venues.length === 0 && <p className="text-sm text-muted-foreground">Brak obiektów.</p>}
            </div>
            {canContent && (
              <form action={createVenueAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={organization.id} />
                <Input name="name" required placeholder="Nazwa obiektu" />
                <Input name="city" placeholder="Miasto" />
                <Input name="address" placeholder="Adres" />
                <Input name="postalCode" placeholder="Kod pocztowy" />
                <Button type="submit" className="sm:col-span-2"><Plus className="mr-2 h-4 w-4" /> Dodaj obiekt</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atrakcje</CardTitle>
            <CardDescription>Atrakcje są przypisane do konkretnego obiektu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {attractions.map((attraction: any) => (
                <div key={attraction.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><p className="font-medium">{attraction.title}</p><Badge variant={attraction.isActive ? "default" : "secondary"}>{attraction.isActive ? "Aktywna" : "Szkic"}</Badge></div>
                  <p className="mt-1 text-muted-foreground">{attraction.city || "Brak miasta"}</p>
                </div>
              ))}
              {attractions.length === 0 && <p className="text-sm text-muted-foreground">Brak atrakcji.</p>}
            </div>
            {canContent && venues.length > 0 && (
              <form action={createAttractionDraftAction} className="space-y-3">
                <input type="hidden" name="organizationId" value={organization.id} />
                <select name="venueId" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {venues.map((venue: any) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                </select>
                <Input name="title" required placeholder="Nazwa atrakcji" />
                <Textarea name="description" placeholder="Krótki opis (opcjonalnie)" />
                <Button type="submit" className="w-full"><Plus className="mr-2 h-4 w-4" /> Dodaj szkic atrakcji</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> Oferty i sprzedaż</CardTitle>
            <CardDescription>Podgląd ofert powiązanych z organizacją.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {offers.map((offer: any) => (
              <div key={offer.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3"><p className="font-medium">{offer.name}</p><Badge variant="outline">{offer.status}</Badge></div>
                <p className="mt-1 text-muted-foreground">{offer.durationMinutes} min</p>
              </div>
            ))}
            {offers.length === 0 && <p className="text-sm text-muted-foreground">Brak ofert.</p>}
            <div className="mt-4 rounded-lg bg-muted p-4 text-sm">
              Zamówienia: <strong>{metrics.orders ?? 0}</strong> · Potwierdzone: <strong>{metrics.confirmedOrders ?? 0}</strong> · Bilety wykorzystane: <strong>{metrics.usedTickets ?? 0}/{metrics.tickets ?? 0}</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {canEditOrganization && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Ustawienia administracyjne organizacji</CardTitle>
            <CardDescription>Operacje wysokiego ryzyka są dostępne tylko dla super administratora i trafiają do audytu.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOrganizationAction} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <input type="hidden" name="organizationId" value={organization.id} />
              <Input name="name" defaultValue={organization.name} required />
              <select name="status" defaultValue={organization.status} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="active">Aktywna</option><option value="suspended">Zawieszona</option></select>
              <select name="verificationStatus" defaultValue={organization.verification_status} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="not_started">Nie rozpoczęto</option><option value="pending">Oczekuje</option><option value="verified">Zweryfikowana</option><option value="rejected">Odrzucona</option></select>
              <select name="paymentsEnabled" defaultValue={organization.payments_enabled ? "true" : "false"} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="false">Płatności OFF</option><option value="true">Płatności ON</option></select>
              <Button type="submit">Zapisz ustawienia</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>
}
