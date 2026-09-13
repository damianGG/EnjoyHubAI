import Link from "next/link"
import { ArrowLeft, CheckCircle2, ExternalLink, Eye, Rocket, Save, Sparkles, XCircle } from "lucide-react"
import { notFound } from "next/navigation"

import { publishSupplyLeadAction, resolveSupplyClaimAction, updateSupplyLeadAction } from "@/app/admin/supply/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

const supplyRoles = ["platform_superadmin", "platform_support", "platform_content"] as const

const statuses = [
  ["discovered", "Znaleziony"],
  ["reviewing", "Weryfikacja"],
  ["verified", "Zweryfikowany"],
  ["contacted", "Skontaktowano"],
  ["owner_approved", "Zgoda właściciela"],
  ["published", "Opublikowany"],
  ["partner", "Partner sprzedażowy"],
  ["rejected", "Odrzucony"],
] as const

export default async function SupplyLeadPage({ params, searchParams }: {
  params: { leadId: string }
  searchParams?: { zapisano?: string; blad?: string; opublikowano?: string; claim?: string }
}) {
  const next = `/admin/supply/${params.leadId}`
  const { supabase, role } = await requirePlatformStaff(supplyRoles, next)
  const [{ data, error }, categoriesResult, subcategoriesResult] = await Promise.all([
    supabase.rpc("platform_supply_get_lead", { p_lead_id: params.leadId }),
    supabase.from("categories").select("id,name").order("name"),
    supabase.from("subcategories").select("id,parent_category_id,name").order("name"),
  ])
  if (error || !data) notFound()

  const lead = data as any
  const categories = categoriesResult.data ?? []
  const subcategories = subcategoriesResult.data ?? []
  const claimRequests = (lead.claimRequests ?? []) as any[]
  const action = updateSupplyLeadAction.bind(null, params.leadId)
  const publishAction = publishSupplyLeadAction.bind(null, params.leadId)
  const canReviewClaims = role === "platform_superadmin" || role === "platform_support"
  const canPublish = !lead.attraction_id && ["verified", "owner_approved"].includes(lead.status)

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <Link href="/admin/supply" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Wszystkie leady
      </Link>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{statusLabel(lead.status)}</Badge>
            <Badge variant="outline">{lead.claim_status === "claimed" ? "Profil przejęty" : lead.claim_status === "claim_requested" ? "Czeka wniosek o przejęcie" : "Bez właściciela"}</Badge>
            {lead.attraction_id && <Badge>Połączony z atrakcją</Badge>}
          </div>
          <h1 className="text-3xl font-bold">{lead.name}</h1>
          <p className="mt-2 text-muted-foreground">{[lead.city, lead.region].filter(Boolean).join(" · ") || "Lokalizacja do uzupełnienia"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.website_url && <Button asChild variant="outline"><a href={lead.website_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Strona źródłowa</a></Button>}
          <Button asChild variant="outline"><Link href={`/admin/supply/${lead.id}/podglad`}><Eye className="mr-2 h-4 w-4" />Podgląd roboczy</Link></Button>
          {lead.attraction_id && <Button asChild variant="outline"><Link href={`/attractions/${lead.attraction_id}`} target="_blank"><ExternalLink className="mr-2 h-4 w-4" />Profil publiczny</Link></Button>}
          {canPublish && (
            <form action={publishAction}>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700"><Rocket className="mr-2 h-4 w-4" />Opublikuj profil</Button>
            </form>
          )}
        </div>
      </div>

      {searchParams?.zapisano && <Notice>Zapisano zmiany.</Notice>}
      {searchParams?.opublikowano && <Notice>Profil został opublikowany bez przypisywania właściciela. Może zostać przejęty przez zweryfikowanego operatora.</Notice>}
      {searchParams?.claim === "approved" && <Notice>Wniosek został zaakceptowany. Użytkownik jest teraz właścicielem organizacji i może zarządzać profilem.</Notice>}
      {searchParams?.claim === "rejected" && <Notice>Wniosek o przejęcie został odrzucony.</Notice>}
      {searchParams?.blad && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Operacja nie powiodła się. Przy publikacji profil musi być najpierw zweryfikowany i mieć uzupełnione miasto.</div>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="EnjoyHub Score" value={`${lead.score}/100`} note="priorytet pozyskania" />
        <Metric label="Cena od" value={lead.price_from ? `${Number(lead.price_from).toFixed(0)} ${lead.currency}` : "—"} note="wartość koszyka" />
        <Metric label="Opinie" value={lead.review_rating ? `${lead.review_rating} ★` : "—"} note={lead.review_count ? `${lead.review_count} opinii` : "brak danych"} />
        <Metric label="Rezerwacja" value={bookingLabel(lead.booking_method)} note={lead.booking_url ? "ma link bookingowy" : "bez linku"} />
      </div>

      {claimRequests.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle>Wnioski o przejęcie profilu</CardTitle>
            <CardDescription>Akceptacja nie tworzy duplikatu. Użytkownik dostaje rolę właściciela istniejącej organizacji i dostęp do istniejącego obiektu oraz atrakcji.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {claimRequests.map((claim) => (
              <div key={claim.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{claim.claimantName || claim.claimant_email || "Użytkownik EnjoyHub"}</p>
                      <Badge variant={claim.status === "approved" ? "default" : claim.status === "rejected" ? "destructive" : "secondary"}>{claimStatusLabel(claim.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{claim.claimant_email}{claim.claimant_phone ? ` · ${claim.claimant_phone}` : ""}</p>
                    {claim.message && <p className="mt-3 whitespace-pre-line text-sm">{claim.message}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">Wysłano: {new Date(claim.submitted_at).toLocaleString("pl-PL")}</p>
                  </div>
                  {canReviewClaims && claim.status === "pending" && (
                    <div className="grid min-w-[280px] gap-2">
                      <form action={resolveSupplyClaimAction.bind(null, params.leadId, claim.id, "approved")} className="space-y-2">
                        <Input name="admin_note" placeholder="Notatka z weryfikacji (opcjonalnie)" />
                        <Button type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4" />Zatwierdź przejęcie</Button>
                      </form>
                      <form action={resolveSupplyClaimAction.bind(null, params.leadId, claim.id, "rejected")}>
                        <input type="hidden" name="admin_note" value="Wniosek odrzucony przez administratora." />
                        <Button type="submit" variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" />Odrzuć</Button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <form action={action} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dane podstawowe</CardTitle>
            <CardDescription>To są dane robocze Supply. Możesz je poprawiać po rozmowie z właścicielem.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Nazwa"><Input name="name" required defaultValue={lead.name ?? ""} /></Field>
            <Field label="Telefon"><Input name="phone" defaultValue={lead.phone ?? ""} /></Field>
            <Field label="E-mail"><Input name="email" type="email" defaultValue={lead.email ?? ""} /></Field>
            <Field label="Strona WWW"><Input name="website_url" type="url" defaultValue={lead.website_url ?? ""} /></Field>
            <Field label="Link do rezerwacji"><Input name="booking_url" type="url" defaultValue={lead.booking_url ?? ""} /></Field>
            <Field label="Źródło danych"><Input name="source_url" type="url" defaultValue={lead.source_url ?? ""} /></Field>
            <Field label="Typ źródła">
              <select name="source_kind" defaultValue={lead.source_kind ?? "manual"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="manual">Ręcznie</option><option value="web">WWW</option><option value="map">Mapa</option><option value="social">Social media</option><option value="referral">Polecenie</option><option value="owner">Właściciel</option>
              </select>
            </Field>
            <Field label="Kategoria">
              <select name="category_id" defaultValue={lead.category_id ?? ""} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Bez kategorii</option>{categories.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Podkategoria">
              <select name="subcategory_id" defaultValue={lead.subcategory_id ?? ""} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Bez podkategorii</option>{subcategories.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lokalizacja</CardTitle><CardDescription>Dane do mapy i wyszukiwania lokalnego.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Adres"><Input name="address_line_1" defaultValue={lead.address_line_1 ?? ""} /></Field>
            <Field label="Miasto"><Input name="city" defaultValue={lead.city ?? ""} /></Field>
            <Field label="Województwo"><Input name="region" defaultValue={lead.region ?? ""} /></Field>
            <Field label="Kod pocztowy"><Input name="postal_code" defaultValue={lead.postal_code ?? ""} /></Field>
            <Field label="Kraj"><Input name="country_code" defaultValue={lead.country_code ?? "PL"} /></Field>
            <Field label="Latitude"><Input name="latitude" inputMode="decimal" defaultValue={lead.latitude ?? ""} /></Field>
            <Field label="Longitude"><Input name="longitude" inputMode="decimal" defaultValue={lead.longitude ?? ""} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Oferta i potencjał sprzedażowy</CardTitle><CardDescription>Te pola wpływają na EnjoyHub Score i kolejność kontaktu z operatorami.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Cena od"><Input name="price_from" type="number" min="0" step="0.01" defaultValue={lead.price_from ?? ""} /></Field>
            <Field label="Waluta"><Input name="currency" defaultValue={lead.currency ?? "PLN"} /></Field>
            <Field label="Ocena"><Input name="review_rating" type="number" min="0" max="5" step="0.1" defaultValue={lead.review_rating ?? ""} /></Field>
            <Field label="Liczba opinii"><Input name="review_count" type="number" min="0" step="1" defaultValue={lead.review_count ?? ""} /></Field>
            <Field label="Sposób rezerwacji">
              <select name="booking_method" defaultValue={lead.booking_method ?? "unknown"} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="unknown">Nieznany</option><option value="none">Brak</option><option value="phone">Telefon</option><option value="whatsapp">WhatsApp</option><option value="messenger">Messenger</option><option value="form">Formularz</option><option value="email">E-mail</option><option value="own_booking">Własny booking online</option>
              </select>
            </Field>
            <div className="grid gap-2 sm:grid-cols-2 xl:col-span-3">
              <Check name="has_paid_offer" label="Płatna oferta" checked={lead.has_paid_offer} />
              <Check name="requires_schedule" label="Wymaga terminu" checked={lead.requires_schedule} />
              <Check name="group_offer" label="Oferta grupowa" checked={lead.group_offer} />
              <Check name="indoor" label="Indoor" checked={lead.indoor} />
              <Check name="year_round" label="Całoroczne" checked={lead.year_round} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Treść profilu</CardTitle><CardDescription>Oddzielamy informacje znalezione w źródłach od tekstu, który docelowo pokażemy klientowi.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <Field label="Krótki opis"><Textarea name="short_description" rows={5} defaultValue={lead.short_description ?? ""} /></Field>
            <Field label="Opis publiczny"><Textarea name="public_description" rows={5} defaultValue={lead.public_description ?? ""} /></Field>
            <Field label="Notatki ze źródeł"><Textarea name="source_notes" rows={5} defaultValue={lead.source_notes ?? ""} /></Field>
            <Field label="Notatki administratora"><Textarea name="admin_notes" rows={5} defaultValue={lead.admin_notes ?? ""} placeholder="Np. 15.09: właściciel potwierdził cenę, ma wysłać zdjęcia." /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status i własność</CardTitle><CardDescription>Najpierw zweryfikuj lead. Dopiero osobny przycisk publikacji tworzy publiczny profil bez właściciela.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Status leada">
              <select name="status" defaultValue={lead.status} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </Field>
            <Field label="Status przejęcia">
              <select name="claim_status" defaultValue={lead.claim_status} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="unclaimed">Nieprzejęty</option><option value="claim_requested">Wniosek o przejęcie</option><option value="claimed">Przejęty</option></select>
            </Field>
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-medium">Powiązanie marketplace</p>
              <p className="mt-1 break-all text-muted-foreground">{lead.attraction_id ? `Atrakcja: ${lead.attraction_id}` : "Jeszcze nie opublikowano jako atrakcja."}</p>
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-20 flex justify-end">
          <Button type="submit" size="lg" className="shadow-lg"><Save className="mr-2 h-4 w-4" />Zapisz zmiany</Button>
        </div>
      </form>
    </main>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-2 text-sm"><span className="font-medium">{label}</span>{children}</label>
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" name={name} defaultChecked={Boolean(checked)} className="h-4 w-4" />{label}</label>
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 flex items-center gap-2 text-2xl font-bold">{label === "EnjoyHub Score" && <Sparkles className="h-5 w-5 text-primary" />}{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>
}

function statusLabel(value: string) { return statuses.find(([status]) => status === value)?.[1] ?? value }
function claimStatusLabel(value: string) { return ({ pending: "Oczekuje", approved: "Zaakceptowany", rejected: "Odrzucony" } as Record<string, string>)[value] ?? value }
function bookingLabel(value: string) { return ({ unknown: "Nieznana", none: "Brak", phone: "Telefon", whatsapp: "WhatsApp", messenger: "Messenger", form: "Formularz", email: "E-mail", own_booking: "Online" } as Record<string, string>)[value] ?? value }
