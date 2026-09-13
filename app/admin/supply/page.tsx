import Link from "next/link"
import { ExternalLink, Plus, Search, Sparkles } from "lucide-react"

import { createSupplyLeadAction } from "@/app/admin/supply/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

const supplyRoles = ["platform_superadmin", "platform_support", "platform_content"] as const

const statuses = [
  ["discovered", "Znaleziony"],
  ["reviewing", "Weryfikacja"],
  ["verified", "Zweryfikowany"],
  ["contacted", "Kontakt"],
  ["owner_approved", "Zgoda właściciela"],
  ["published", "Opublikowany"],
  ["partner", "Partner"],
  ["rejected", "Odrzucony"],
] as const

const regions = ["Podkarpackie", "Małopolskie"] as const

export default async function SupplyPage({ searchParams }: { searchParams?: { q?: string; status?: string; region?: string; blad?: string } }) {
  const q = searchParams?.q?.trim() ?? ""
  const status = searchParams?.status?.trim() ?? ""
  const region = searchParams?.region?.trim() ?? ""
  const { supabase } = await requirePlatformStaff(supplyRoles, "/admin/supply")

  const { data, error } = await supabase.rpc("platform_supply_list_leads", {
    p_search: q || null,
    p_status: status || null,
    p_region: region || null,
    p_limit: 500,
  })
  const leads = (data ?? []) as any[]

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">EnjoyHub Supply</Badge>
          <h1 className="text-3xl font-bold">Potencjalne atrakcje i partnerzy</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">Jedno miejsce do zbierania leadów, uzupełniania danych, kontaktu z właścicielami i przygotowania atrakcji do publikacji.</p>
        </div>

        <form className="grid w-full gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto] xl:max-w-3xl" action="/admin/supply">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Nazwa, miasto, telefon…" className="pl-9" />
          </div>
          <select name="status" defaultValue={status} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Wszystkie statusy</option>
            {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="region" defaultValue={region} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Wszystkie regiony</option>
            {regions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <Button type="submit" variant="outline">Filtruj</Button>
        </form>
      </div>

      {error && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się pobrać leadów Supply. Upewnij się, że migracja bazy została wdrożona.</div>}
      {searchParams?.blad && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Nie udało się utworzyć leada. Sprawdź wprowadzone dane.</div>}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Dodaj lead ręcznie</CardTitle>
          <CardDescription>Na początek wpisujemy także firmy znalezione telefonicznie, w Google, social mediach lub z polecenia. Konto właściciela nie jest wymagane.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSupplyLeadAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input name="name" required minLength={2} placeholder="Nazwa atrakcji / firmy" />
            <Input name="city" placeholder="Miasto" />
            <select name="region" defaultValue="Podkarpackie" className="h-10 rounded-md border bg-background px-3 text-sm">
              {regions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <Input name="phone" placeholder="Telefon" />
            <Input name="website_url" type="url" placeholder="https://strona.pl" />
            <Input name="email" type="email" placeholder="E-mail" />
            <select name="booking_method" defaultValue="unknown" className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="unknown">Rezerwacja: nieznana</option>
              <option value="phone">Telefon</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="form">Formularz</option>
              <option value="email">E-mail</option>
              <option value="own_booking">Własny booking online</option>
              <option value="none">Brak systemu</option>
            </select>
            <Input name="source_url" type="url" placeholder="Źródło / URL" />
            <input type="hidden" name="source_kind" value="manual" />
            <Input name="admin_notes" placeholder="Krótka notatka" className="md:col-span-2 xl:col-span-3" />
            <Button type="submit">Dodaj do Supply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{leads.length} leadów</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-4 w-4" /> Najwyższy score = pierwszy kontakt</div>
      </div>

      <div className="grid gap-3">
        {leads.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Brak leadów pasujących do filtrów.</CardContent></Card>
        ) : leads.map((lead) => (
          <Card key={lead.lead_id} className="transition-colors hover:bg-muted/30">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.5fr)_1fr_1fr_120px_auto] lg:items-center">
              <div>
                <Link href={`/admin/supply/${lead.lead_id}`} className="font-semibold hover:text-primary hover:underline">{lead.lead_name}</Link>
                <p className="mt-1 text-sm text-muted-foreground">{[lead.city, lead.region].filter(Boolean).join(" · ") || "Lokalizacja do uzupełnienia"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{lead.category_name || "Bez kategorii"}{lead.subcategory_name ? ` / ${lead.subcategory_name}` : ""}</p>
              </div>
              <div className="text-sm">
                <p className="font-medium">{lead.price_from ? `od ${Number(lead.price_from).toFixed(0)} ${lead.currency}` : "Cena nieznana"}</p>
                <p className="text-muted-foreground">Rezerwacja: {bookingLabel(lead.booking_method)}</p>
              </div>
              <div className="text-sm">
                <p className="font-medium">{lead.review_rating ? `${lead.review_rating} ★` : "Brak oceny"}</p>
                <p className="text-muted-foreground">{lead.review_count ? `${lead.review_count} opinii` : "opinie do sprawdzenia"}</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{lead.score}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                <p className="text-xs text-muted-foreground">EnjoyHub Score</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Badge variant={lead.status === "partner" ? "default" : lead.status === "rejected" ? "destructive" : "secondary"}>{statusLabel(lead.status)}</Badge>
                {lead.website_url && <Button asChild variant="ghost" size="icon"><a href={lead.website_url} target="_blank" rel="noreferrer" aria-label="Otwórz stronę"><ExternalLink className="h-4 w-4" /></a></Button>}
                <Button asChild size="sm"><Link href={`/admin/supply/${lead.lead_id}`}>Otwórz</Link></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}

function statusLabel(value: string) {
  return statuses.find(([status]) => status === value)?.[1] ?? value
}

function bookingLabel(value: string) {
  return ({ unknown: "nieznana", none: "brak", phone: "telefon", whatsapp: "WhatsApp", messenger: "Messenger", form: "formularz", email: "e-mail", own_booking: "online" } as Record<string, string>)[value] ?? value
}
