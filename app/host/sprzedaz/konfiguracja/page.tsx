import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  MapPin,
  PauseCircle,
  PlayCircle,
  Settings2,
  Ticket,
} from "lucide-react"

import { changeTicketingProductStatus } from "@/app/host/sprzedaz/konfiguracja/actions"
import { SalesSetupForm } from "@/components/ticketing/sales-setup-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server"
import { isTicketingCheckoutEnabled } from "@/lib/ticketing/config"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"
import type {
  TicketingManagedProduct,
  TicketingSetupOrganization,
  TicketingSetupVenue,
} from "@/lib/ticketing/types"

export const dynamic = "force-dynamic"

interface RawMembership {
  organization_id: string
  role: string
}

interface RawOrganization {
  id: string
  name: string
}

interface RawVenue {
  id: string
  organization_id: string
  name: string
  city: string | null
  timezone: string
  sales_mode: "native_enjoyhub" | "allocated_quota"
}

interface RawProduct {
  id: string
  venue_id: string
  name: string
  description: string | null
  status: "draft" | "active" | "archived"
  duration_minutes: number
}

interface RawTicketType {
  product_id: string
  price_amount: number | string
  currency: string
  is_active: boolean
}

interface RawSession {
  product_id: string
  starts_at: string
}

async function loadConfiguration() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) {
    return { error: "Nie udało się odczytać organizacji. Sprawdź, czy migracje ticketingu są uruchomione." } as const
  }

  const managerMemberships = ((memberships ?? []) as RawMembership[]).filter((membership) =>
    ["owner", "admin", "manager"].includes(membership.role),
  )
  const organizationIds = managerMemberships.map((membership) => membership.organization_id)

  if (organizationIds.length === 0) {
    return {
      error: null,
      organizations: [] as TicketingSetupOrganization[],
      venues: [] as TicketingSetupVenue[],
      products: [] as TicketingManagedProduct[],
    }
  }

  const [organizationsResult, venuesResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .in("id", organizationIds)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("venues")
      .select("id, organization_id, name, city, timezone, sales_mode")
      .in("organization_id", organizationIds)
      .in("status", ["draft", "active"])
      .in("sales_mode", ["native_enjoyhub", "allocated_quota"])
      .order("name"),
  ])

  if (organizationsResult.error || venuesResult.error) {
    return { error: "Nie udało się odczytać obiektów sprzedażowych." } as const
  }

  const rawOrganizations = (organizationsResult.data ?? []) as RawOrganization[]
  const activeOrganizationIds = new Set(rawOrganizations.map((organization) => organization.id))
  const rawVenues = ((venuesResult.data ?? []) as RawVenue[]).filter((venue) =>
    activeOrganizationIds.has(venue.organization_id),
  )
  const venueIds = rawVenues.map((venue) => venue.id)
  const organizationNames = new Map(rawOrganizations.map((organization) => [organization.id, organization.name]))

  const organizations = rawOrganizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
  })) satisfies TicketingSetupOrganization[]
  const venues = rawVenues.map((venue) => ({
    id: venue.id,
    organizationId: venue.organization_id,
    organizationName: organizationNames.get(venue.organization_id) ?? "Organizacja",
    name: venue.name,
    city: venue.city,
    salesMode: venue.sales_mode,
  })) satisfies TicketingSetupVenue[]

  if (venueIds.length === 0) {
    return { error: null, organizations, venues, products: [] as TicketingManagedProduct[] }
  }

  const { data: productData, error: productError } = await supabase
    .from("products")
    .select("id, venue_id, name, description, status, duration_minutes")
    .in("venue_id", venueIds)
    .neq("status", "archived")
    .order("created_at", { ascending: false })

  if (productError) {
    return { error: "Nie udało się odczytać ofert biletowych." } as const
  }

  const rawProducts = (productData ?? []) as RawProduct[]
  const productIds = rawProducts.map((product) => product.id)
  if (productIds.length === 0) {
    return { error: null, organizations, venues, products: [] as TicketingManagedProduct[] }
  }

  const [ticketTypesResult, sessionsResult] = await Promise.all([
    supabase
      .from("ticket_types")
      .select("product_id, price_amount, currency, is_active")
      .in("product_id", productIds),
    supabase
      .from("sessions")
      .select("product_id, starts_at")
      .in("product_id", productIds)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
  ])

  if (ticketTypesResult.error || sessionsResult.error) {
    return { error: "Nie udało się odczytać cennika lub przyszłych terminów." } as const
  }

  const rawTicketTypes = (ticketTypesResult.data ?? []) as RawTicketType[]
  const rawSessions = (sessionsResult.data ?? []) as RawSession[]
  const venuesById = new Map(rawVenues.map((venue) => [venue.id, venue]))

  const products = rawProducts.flatMap((product) => {
    const venue = venuesById.get(product.venue_id)
    if (!venue) return []

    const tickets = rawTicketTypes.filter((ticket) => ticket.product_id === product.id && ticket.is_active)
    const sessions = rawSessions.filter((session) => session.product_id === product.id)
    const firstTicket = tickets[0]

    return [{
      id: product.id,
      name: product.name,
      description: product.description,
      status: product.status,
      durationMinutes: product.duration_minutes,
      venueId: venue.id,
      venueName: venue.name,
      venueCity: venue.city,
      venueTimezone: venue.timezone,
      priceFrom: tickets.length
        ? Math.min(...tickets.map((ticket) => Number(ticket.price_amount)))
        : null,
      currency: firstTicket?.currency ?? "PLN",
      activeTicketTypeCount: tickets.length,
      upcomingSessionCount: sessions.length,
      nextSessionStartsAt: sessions[0]?.starts_at ?? null,
    } satisfies TicketingManagedProduct]
  })

  return { error: null, organizations, venues, products }
}

export default async function TicketingConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ utworzono?: string; zmiana?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby skonfigurować sprzedaż.</CenteredMessage>
  }

  const [configuration, query] = await Promise.all([loadConfiguration(), searchParams])
  if (configuration.error) return <CenteredMessage>{configuration.error}</CenteredMessage>

  const createdProduct = query.utworzono
    ? configuration.products.find((product) => product.id === query.utworzono)
    : null

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/host/sprzedaz" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Powrót do sprzedaży
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <Badge variant="secondary" className="mb-3">Ticketing 2A</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Uruchom sprzedaż bez konfiguracji w Supabase</h1>
          <p className="mt-3 text-muted-foreground">
            Jeden kreator tworzy obiekt, ofertę, cennik, harmonogram i pierwsze 90 dni terminów. Potem automat codziennie utrzymuje kalendarz sprzedaży.
          </p>
        </div>

        {createdProduct && (
          <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Sprzedaż została uruchomiona</AlertTitle>
            <AlertDescription>
              Oferta „{createdProduct.name}” ma już cennik i terminy. Możesz otworzyć jej stały link sprzedażowy.
              {isTicketingCheckoutEnabled ? (
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href={`/bilety/${createdProduct.id}`}><ExternalLink className="h-4 w-4" /> Otwórz stronę oferty</Link>
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        {query.zmiana && (
          <Alert className="mb-6">
            <AlertTitle>Status oferty został zmieniony</AlertTitle>
            <AlertDescription>
              {query.zmiana === "active" ? "Oferta znów jest dostępna w sprzedaży." : "Oferta została wstrzymana i nie jest publicznie widoczna."}
            </AlertDescription>
          </Alert>
        )}

        {query.blad && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Nie udało się zmienić statusu</AlertTitle>
            <AlertDescription>Sprawdź swoje uprawnienia i spróbuj ponownie.</AlertDescription>
          </Alert>
        )}

        {!isTicketingCheckoutEnabled && (
          <Alert className="mb-8">
            <Settings2 className="h-4 w-4" />
            <AlertTitle>Konfiguracja może powstać przed startem płatności</AlertTitle>
            <AlertDescription>
              Publiczne linki pozostaną niewidoczne do ustawienia <code>TICKETING_CHECKOUT_ENABLED=true</code>. Możesz już przygotować całą ofertę i cennik.
            </AlertDescription>
          </Alert>
        )}

        <section className="mb-12" aria-labelledby="managed-products-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="managed-products-heading" className="text-2xl font-semibold">Twoje oferty biletowe</h2>
              <p className="mt-1 text-sm text-muted-foreground">Stałe linki można umieścić na stronie obiektu, w social mediach i kodzie QR przy kasie.</p>
            </div>
            <Badge variant="outline">{configuration.products.length}</Badge>
          </div>

          {configuration.products.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                <Ticket className="mb-3 h-9 w-9 text-muted-foreground" />
                <h3 className="font-semibold">Nie masz jeszcze oferty w nowym ticketingu</h3>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">Wypełnij kreator poniżej. Nie będzie potrzebny ręczny seed ani fixture SQL.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configuration.products.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold">{product.name}</h3>
                        <Badge variant={product.status === "active" ? "default" : "secondary"}>
                          {product.status === "active" ? "W sprzedaży" : "Wstrzymana"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{product.venueName}{product.venueCity ? `, ${product.venueCity}` : ""}</span>
                        <span className="inline-flex items-center gap-1.5"><Ticket className="h-4 w-4" />{product.activeTicketTypeCount} rodzaje · {product.priceFrom !== null ? `od ${formatMoney(product.priceFrom, product.currency)}` : "brak ceny"}</span>
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{product.upcomingSessionCount} przyszłych terminów</span>
                      </div>
                      {product.nextSessionStartsAt && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Najbliższy: {formatSessionDate(product.nextSessionStartsAt, product.venueTimezone)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {isTicketingCheckoutEnabled && product.status === "active" ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/bilety/${product.id}`}><ExternalLink className="h-4 w-4" /> Link sprzedażowy</Link>
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" disabled>
                          <ExternalLink className="h-4 w-4" /> Link sprzedażowy
                        </Button>
                      )}
                      <form action={changeTicketingProductStatus}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="nextStatus" value={product.status === "active" ? "draft" : "active"} />
                        <Button type="submit" variant="outline" size="sm">
                          {product.status === "active" ? (
                            <><PauseCircle className="h-4 w-4" /> Wstrzymaj</>
                          ) : (
                            <><PlayCircle className="h-4 w-4" /> Wznów</>
                          )}
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="new-product-heading">
          <div className="mb-5">
            <h2 id="new-product-heading" className="text-2xl font-semibold">Dodaj ofertę</h2>
            <p className="mt-1 text-sm text-muted-foreground">Domyślne wartości pozwalają wystartować szybko, a każdy parametr można zmienić przed zapisem.</p>
          </div>
          <SalesSetupForm organizations={configuration.organizations} venues={configuration.venues} />
        </section>
      </div>
    </main>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Konfiguracja sprzedaży</CardTitle>
          <CardDescription>Nie udało się otworzyć kreatora.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">{children}</CardContent>
      </Card>
    </main>
  )
}
