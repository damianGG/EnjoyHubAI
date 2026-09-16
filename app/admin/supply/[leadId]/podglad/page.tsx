import Link from "next/link"
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck, Star, Ticket, Users } from "lucide-react"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"

export const dynamic = "force-dynamic"

const supplyRoles = ["platform_superadmin", "platform_support", "platform_content"] as const

export default async function SupplyPreviewPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params
  const { supabase } = await requirePlatformStaff(supplyRoles, `/admin/supply/${leadId}/podglad`)
  const { data, error } = await supabase.rpc("platform_supply_get_lead", { p_lead_id: leadId })
  if (error || !data) notFound()
  const lead = data as any
  const images = (lead.images ?? []) as any[]
  const location = [lead.address_line_1, lead.city, lead.region].filter(Boolean).join(", ")

  return (
    <main className="min-h-[calc(100vh-64px)] bg-muted/20 pb-16">
      <div className="border-b bg-amber-50 text-amber-950">
        <div className="container mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <div><strong>Podgląd roboczy.</strong> Ten profil nie jest publikowany z tego ekranu.</div>
          <Button asChild variant="outline" size="sm" className="bg-white"><Link href={`/admin/supply/${lead.id}`}><ArrowLeft className="mr-2 h-4 w-4" />Wróć do edycji</Link></Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] px-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/admin/supply/${lead.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Edycja Supply</Link>
          <Badge variant="secondary">Symulacja widoku klienta</Badge>
        </div>

        <PreviewGallery images={images} title={lead.name} />

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="space-y-7">
            <header className="space-y-3 border-b pb-6">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lead.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                {lead.review_rating && <span className="flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-[#ff9f0a] text-[#ff9f0a]" />{lead.review_rating}<span className="font-normal text-muted-foreground">({lead.review_count || 0} opinii)</span></span>}
                <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{location || "Lokalizacja do uzupełnienia"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1.5">{lead.subcategoryName || lead.categoryName || "Kategoria do uzupełnienia"}</Badge>
                {lead.group_offer && <Badge variant="outline" className="rounded-full px-3 py-1.5"><Users className="mr-1.5 h-3.5 w-3.5" />Dla grup</Badge>}
                {lead.booking_method === "own_booking" && <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800"><Ticket className="mr-1.5 h-3.5 w-3.5" />Rezerwacja online</Badge>}
              </div>
            </header>

            <section className="space-y-4 border-b pb-7">
              <h2 className="text-xl font-bold">O atrakcji</h2>
              <p className="whitespace-pre-line text-[15px] leading-7 text-muted-foreground sm:text-base">{lead.public_description || lead.short_description || "Opis nie został jeszcze przygotowany. Uzupełnij go w panelu Supply po weryfikacji danych."}</p>
            </section>

            <section className="grid grid-cols-3 gap-3 border-b pb-7">
              <Info icon={Users} text={lead.group_offer ? "Dobre dla grup" : "Sprawdź liczbę osób"} />
              <Info icon={CalendarDays} text={lead.requires_schedule ? "Wybierz termin" : "Sprawdź dostępność"} />
              <Info icon={ShieldCheck} text="Zweryfikowane przez EnjoyHub" />
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">Gdzie to jest</h2>
              <div className="rounded-3xl border bg-background p-6">
                <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-5 w-5 text-[#ff5a1f]" />{location || "Adres wymaga uzupełnienia"}</p>
                {(lead.latitude && lead.longitude) && <p className="mt-2 text-sm text-muted-foreground">{lead.latitude}, {lead.longitude}</p>}
              </div>
            </section>
          </div>

          <aside>
            <Card className="lg:sticky lg:top-24">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">Cena od</p>
                  <p className="text-3xl font-bold">{lead.price_from ? `${Number(lead.price_from).toFixed(0)} ${lead.currency}` : "Do ustalenia"}</p>
                </div>
                <Button className="h-12 w-full bg-[#ff5a1f] text-base font-semibold text-white hover:bg-[#e94f18]" disabled>Sprawdź terminy</Button>
                <p className="text-center text-xs text-muted-foreground">W podglądzie przycisk rezerwacji jest wyłączony.</p>
                <div className="border-t pt-4 text-sm">
                  <p className="font-medium">Aktualny sposób rezerwacji</p>
                  <p className="mt-1 text-muted-foreground">{bookingLabel(lead.booking_method)}</p>
                  {lead.phone && <p className="mt-3">Tel. {lead.phone}</p>}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}

function PreviewGallery({ images, title }: { images: any[]; title: string }) {
  if (images.length === 0) {
    return <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed bg-background text-center text-muted-foreground sm:h-96"><div><p className="font-medium">Brak zdjęć</p><p className="mt-1 text-sm">Dodamy zdjęcia przekazane przez właściciela lub z zatwierdzonego źródła.</p></div></div>
  }
  return (
    <div className="grid h-72 grid-cols-2 gap-2 overflow-hidden rounded-3xl bg-muted sm:h-96 md:grid-cols-4">
      {images.slice(0, 5).map((image, index) => <img key={image.id ?? image.image_url} src={image.image_url} alt={`${title} ${index + 1}`} className={index === 0 ? "col-span-2 row-span-2 h-full w-full object-cover" : "h-full w-full object-cover"} />)}
    </div>
  )
}

function Info({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return <div className="rounded-2xl bg-muted/60 p-3 text-center sm:p-4"><Icon className="mx-auto mb-2 h-5 w-5 text-[#ff5a1f]" /><p className="text-xs font-medium sm:text-sm">{text}</p></div>
}

function bookingLabel(value: string) { return ({ unknown: "Nieustalony", none: "Brak systemu", phone: "Telefon", whatsapp: "WhatsApp", messenger: "Messenger", form: "Formularz", email: "E-mail", own_booking: "Własny booking online" } as Record<string, string>)[value] ?? value }
