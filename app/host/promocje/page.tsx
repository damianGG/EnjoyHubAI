import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Gift,
  Percent,
  type LucideIcon,
  PlusCircle,
  Power,
  PowerOff,
  Users,
} from "lucide-react"

import { createPromotion, setPromotionActive } from "@/app/host/promocje/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  organizerManagementRoles,
  organizerSalesRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

type Membership = {
  organization_id: string
  role: OrganizerRole
}

type Organization = {
  id: string
  name: string
}

type Venue = {
  id: string
  organization_id: string
  name: string
}

type Attraction = {
  id: string
  name: string
  venue_id: string
}

type Product = {
  id: string
  name: string
  venue_id: string
  attraction_id: string | null
  status: string
}

type Promotion = {
  id: string
  organization_id: string
  venue_id: string | null
  attraction_id: string | null
  product_id: string | null
  name: string
  code: string
  kind: "promotion" | "voucher"
  discount_type: "percentage" | "fixed"
  discount_value: number | string
  currency: string | null
  minimum_subtotal: number | string
  max_uses: number | null
  max_uses_per_customer: number | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  created_at: string
}

type Redemption = {
  promotion_id: string
  discount_amount: number | string
  currency: string
}

export default async function OrganizerPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host")

  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/promocje")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) {
    return <CenteredMessage>Nie udało się pobrać uprawnień organizatora.</CenteredMessage>
  }

  const memberships = (membershipData ?? []) as Membership[]
  const salesMemberships = memberships.filter((membership) =>
    organizerSalesRoles.includes(membership.role as (typeof organizerSalesRoles)[number]),
  )
  if (!salesMemberships.length) redirect("/host")

  const organizationIds = [...new Set(salesMemberships.map((membership) => membership.organization_id))]
  const manageableOrganizationIds = [...new Set(
    memberships
      .filter((membership) =>
        organizerManagementRoles.includes(membership.role as (typeof organizerManagementRoles)[number]),
      )
      .map((membership) => membership.organization_id),
  )]

  const { data: organizationData } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds)
    .order("name")
  const organizations = (organizationData ?? []) as Organization[]

  const { data: venueData } = await supabase
    .from("venues")
    .select("id, organization_id, name")
    .in("organization_id", organizationIds)
    .order("name")
  const venues = (venueData ?? []) as Venue[]
  const venueIds = venues.map((venue) => venue.id)

  const { data: attractionData } = venueIds.length
    ? await supabase
        .from("organizer_attractions")
        .select("id, name, venue_id")
        .in("venue_id", venueIds)
        .order("name")
    : { data: [] as Attraction[] }
  const attractions = (attractionData ?? []) as Attraction[]

  const { data: productData } = venueIds.length
    ? await supabase
        .from("products")
        .select("id, name, venue_id, attraction_id, status")
        .in("venue_id", venueIds)
        .neq("status", "archived")
        .order("name")
    : { data: [] as Product[] }
  const products = (productData ?? []) as Product[]

  const { data: promotionData, error: promotionError } = await supabase
    .from("promotions")
    .select("id, organization_id, venue_id, attraction_id, product_id, name, code, kind, discount_type, discount_value, currency, minimum_subtotal, max_uses, max_uses_per_customer, valid_from, valid_until, is_active, created_at")
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false })

  if (promotionError) {
    return <CenteredMessage>Nie udało się pobrać promocji i voucherów.</CenteredMessage>
  }

  const promotions = (promotionData ?? []) as Promotion[]
  const promotionIds = promotions.map((promotion) => promotion.id)
  const { data: redemptionData } = promotionIds.length
    ? await supabase
        .from("promotion_redemptions")
        .select("promotion_id, discount_amount, currency")
        .in("promotion_id", promotionIds)
    : { data: [] as Redemption[] }
  const redemptions = (redemptionData ?? []) as Redemption[]

  const usesByPromotion = new Map<string, number>()
  const discountByPromotion = new Map<string, number>()
  for (const redemption of redemptions) {
    usesByPromotion.set(redemption.promotion_id, (usesByPromotion.get(redemption.promotion_id) ?? 0) + 1)
    discountByPromotion.set(
      redemption.promotion_id,
      (discountByPromotion.get(redemption.promotion_id) ?? 0) + Number(redemption.discount_amount),
    )
  }

  const now = Date.now()
  const activeCount = promotions.filter((promotion) => promotionState(promotion, now) === "active").length
  const scheduledCount = promotions.filter((promotion) => promotionState(promotion, now) === "scheduled").length
  const totalUses = redemptions.length

  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]))
  const venueById = new Map(venues.map((venue) => [venue.id, venue]))
  const attractionById = new Map(attractions.map((attraction) => [attraction.id, attraction]))
  const productById = new Map(products.map((product) => [product.id, product]))

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Panel organizatora
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/host/sprzedaz">Sprzedaż i rezerwacje</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <section className="mb-7">
          <Badge variant="secondary">Organizer Operating System · P1</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Promocje i vouchery</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Jeden mechanizm rabatowy dla marketplace i rezerwacji ręcznych. Limity użyć są sprawdzane atomowo przy tworzeniu zamówienia.
          </p>
        </section>

        {query.ok && (
          <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Zapisano</AlertTitle>
            <AlertDescription>
              {query.ok === "utworzona" ? "Kod został utworzony i jest gotowy do użycia." : "Status kodu został zmieniony."}
            </AlertDescription>
          </Alert>
        )}
        {query.blad && <PromotionError code={query.blad} />}

        <section className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Percent} label="Wszystkie kody" value={String(promotions.length)} />
          <Metric icon={CheckCircle2} label="Aktywne" value={String(activeCount)} />
          <Metric icon={CalendarClock} label="Zaplanowane" value={String(scheduledCount)} />
          <Metric icon={Users} label="Wykorzystania" value={String(totalUses)} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
          {manageableOrganizationIds.length > 0 && (
            <Card className="h-fit surface-3d">
              <CardHeader>
                <CardTitle>Utwórz kod</CardTitle>
                <CardDescription>Promocja obniża cenę, voucher może również pokryć 100% wartości rezerwacji.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createPromotion} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="organizationId">Organizacja</Label>
                    <select id="organizationId" name="organizationId" required className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                      {organizations
                        .filter((organization) => manageableOrganizationIds.includes(organization.id))
                        .map((organization) => (
                          <option key={organization.id} value={organization.id}>{organization.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nazwa wewnętrzna</Label>
                      <Input id="name" name="name" required maxLength={160} placeholder="np. Jesień -20%" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Kod</Label>
                      <Input id="code" name="code" required minLength={3} maxLength={32} className="uppercase" placeholder="JESIEN20" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kind">Rodzaj</Label>
                      <select id="kind" name="kind" defaultValue="promotion" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="promotion">Promocja</option>
                        <option value="voucher">Voucher</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountType">Sposób rabatu</Label>
                      <select id="discountType" name="discountType" defaultValue="percentage" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="percentage">Procent (%)</option>
                        <option value="fixed">Kwota (PLN)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountValue">Wartość rabatu</Label>
                      <Input id="discountValue" name="discountValue" inputMode="decimal" required placeholder="np. 20" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minimumSubtotal">Min. wartość koszyka</Label>
                      <Input id="minimumSubtotal" name="minimumSubtotal" inputMode="decimal" defaultValue="0" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope">Zakres</Label>
                    <select id="scope" name="scope" defaultValue="organization" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="organization">Cała organizacja</option>
                      {attractions.map((attraction) => {
                        const venue = venueById.get(attraction.venue_id)
                        const organization = venue ? organizationById.get(venue.organization_id) : null
                        return (
                          <option key={attraction.id} value={`attraction:${attraction.id}`}>
                            Atrakcja: {attraction.name}{organization ? ` · ${organization.name}` : ""}
                          </option>
                        )
                      })}
                      {products.map((product) => {
                        const venue = venueById.get(product.venue_id)
                        const organization = venue ? organizationById.get(venue.organization_id) : null
                        return (
                          <option key={product.id} value={`product:${product.id}`}>
                            Oferta: {product.name}{organization ? ` · ${organization.name}` : ""}
                          </option>
                        )
                      })}
                    </select>
                    <p className="text-xs text-muted-foreground">Zakres musi należeć do wybranej organizacji — baza dodatkowo to weryfikuje.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxUses">Limit wszystkich użyć</Label>
                      <Input id="maxUses" name="maxUses" type="number" min={1} placeholder="bez limitu" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxUsesPerCustomer">Limit na klienta</Label>
                      <Input id="maxUsesPerCustomer" name="maxUsesPerCustomer" type="number" min={1} placeholder="bez limitu" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validFrom">Aktywna od</Label>
                      <Input id="validFrom" name="validFrom" type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validUntil">Aktywna do</Label>
                      <Input id="validUntil" name="validUntil" type="date" />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    <PlusCircle className="h-4 w-4" /> Utwórz kod
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Twoje kody</CardTitle>
              <CardDescription>Aktywne, zaplanowane i wygasłe promocje oraz vouchery.</CardDescription>
            </CardHeader>
            <CardContent>
              {promotions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Gift className="mx-auto h-10 w-10" />
                  <p className="mt-3 font-medium">Nie masz jeszcze żadnych kodów</p>
                  <p className="mt-1 text-sm">Utwórz pierwszą promocję albo voucher po lewej stronie.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {promotions.map((promotion) => {
                    const state = promotionState(promotion, now)
                    const uses = usesByPromotion.get(promotion.id) ?? 0
                    const discount = discountByPromotion.get(promotion.id) ?? 0
                    const organization = organizationById.get(promotion.organization_id)

                    return (
                      <div key={promotion.id} className="rounded-xl border bg-background p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-base font-bold">{promotion.code}</span>
                              <StateBadge state={state} />
                              <Badge variant="outline">{promotion.kind === "voucher" ? "Voucher" : "Promocja"}</Badge>
                            </div>
                            <p className="mt-2 font-semibold">{promotion.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {discountLabel(promotion)} · {scopeLabel(promotion, attractionById, productById)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {organization?.name ?? "Organizacja"} · {validityLabel(promotion)}
                            </p>
                          </div>
                          <div className="grid min-w-[13rem] grid-cols-2 gap-2 text-center">
                            <MiniMetric label="Użycia" value={promotion.max_uses ? `${uses}/${promotion.max_uses}` : String(uses)} />
                            <MiniMetric label="Rabaty" value={formatMoney(discount, promotion.currency ?? "PLN")} />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                          <div className="text-xs text-muted-foreground">
                            {Number(promotion.minimum_subtotal) > 0 ? `Min. koszyk ${formatMoney(Number(promotion.minimum_subtotal), promotion.currency ?? "PLN")} · ` : ""}
                            {promotion.max_uses_per_customer ? `maks. ${promotion.max_uses_per_customer} / klient` : "bez limitu / klient"}
                          </div>
                          {manageableOrganizationIds.includes(promotion.organization_id) && (
                            <form action={setPromotionActive}>
                              <input type="hidden" name="promotionId" value={promotion.id} />
                              <input type="hidden" name="active" value={promotion.is_active ? "false" : "true"} />
                              <Button type="submit" variant="outline" size="sm">
                                {promotion.is_active
                                  ? <><PowerOff className="h-4 w-4" /> Wyłącz</>
                                  : <><Power className="h-4 w-4" /> Włącz</>}
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted p-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>
}

function StateBadge({ state }: { state: ReturnType<typeof promotionState> }) {
  if (state === "active") return <Badge className="bg-emerald-600">Aktywna</Badge>
  if (state === "scheduled") return <Badge variant="secondary">Zaplanowana</Badge>
  if (state === "expired") return <Badge variant="outline">Wygasła</Badge>
  return <Badge variant="outline">Wyłączona</Badge>
}

function promotionState(promotion: Promotion, now: number) {
  if (!promotion.is_active) return "disabled" as const
  if (promotion.valid_from && new Date(promotion.valid_from).getTime() > now) return "scheduled" as const
  if (promotion.valid_until && new Date(promotion.valid_until).getTime() <= now) return "expired" as const
  return "active" as const
}

function discountLabel(promotion: Promotion) {
  return promotion.discount_type === "percentage"
    ? `−${Number(promotion.discount_value)}%`
    : `−${formatMoney(Number(promotion.discount_value), promotion.currency ?? "PLN")}`
}

function scopeLabel(
  promotion: Promotion,
  attractionById: Map<string, Attraction>,
  productById: Map<string, Product>,
) {
  if (promotion.product_id) return `Oferta: ${productById.get(promotion.product_id)?.name ?? "wybrana oferta"}`
  if (promotion.attraction_id) return `Atrakcja: ${attractionById.get(promotion.attraction_id)?.name ?? "wybrana atrakcja"}`
  return "Cała organizacja"
}

function validityLabel(promotion: Promotion) {
  if (!promotion.valid_from && !promotion.valid_until) return "bez ograniczenia dat"
  const from = promotion.valid_from ? formatDate(promotion.valid_from) : "od teraz"
  const until = promotion.valid_until ? formatDate(promotion.valid_until) : "bez daty końcowej"
  return `${from} — ${until}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value))
}

function PromotionError({ code }: { code: string }) {
  const message = code === "kod"
    ? "Taki kod już istnieje w tej organizacji."
    : code === "uprawnienia"
      ? "Nie masz uprawnień do zarządzania kodami w tej organizacji."
      : code === "zakres"
        ? "Wybrany zakres kodu jest nieprawidłowy."
        : "Nie udało się zapisać kodu. Sprawdź wartości, daty i limity."

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTitle>Nie udało się zapisać</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main>
}
