import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  PlusCircle,
  ReceiptText,
  ScanLine,
  Settings2,
  ShieldCheck,
  Store,
  Ticket,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  hasOrganizerRole,
  organizerManagementRoles,
  organizerRoleLabels,
  organizerSalesRoles,
  organizerScannerRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

interface OrganizerMembership {
  organization_id: string
  role: OrganizerRole
}

interface DashboardOrganization {
  id: string
  name: string
  verification_status: "not_started" | "pending" | "verified" | "rejected"
  payments_enabled: boolean
}

interface DashboardVenue {
  id: string
  organization_id: string
  name: string
  city: string | null
  timezone: string
}

interface DashboardAttraction {
  id: string
  name: string
  city: string
  venue_id: string | null
  is_active: boolean
}

interface DashboardProduct {
  id: string
  venue_id: string
  attraction_id: string | null
  name: string
  status: "draft" | "active" | "archived"
}

interface DashboardSession {
  id: string
  product_id: string
  starts_at: string
  ends_at: string
  capacity: number
  status: string
}

interface DashboardOrder {
  id: string
  order_number: number
  organization_id: string
  status: string
  payment_status: string
  customer_name: string
  total_amount: number | string
  currency: string
  created_at: string
}

interface DashboardAvailability {
  available_capacity_units: number
  is_sellable: boolean
}

interface DashboardTask {
  title: string
  description: string
  href: string
  action: string
}

const polishTimezone = "Europe/Warsaw"

export default async function HostDashboard() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby otworzyć panel organizatora.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host")

  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (error) {
    return <CenteredMessage>Nie udało się pobrać uprawnień do panelu organizatora.</CenteredMessage>
  }

  const memberships = (data ?? []) as OrganizerMembership[]
  if (memberships.length === 0) {
    return <FirstOrganizerDashboard />
  }

  const roles = new Set(memberships.map((membership) => membership.role))
  const canManage = hasOrganizerRole(roles, organizerManagementRoles)
  const canViewSales = hasOrganizerRole(roles, organizerSalesRoles)
  const canScan = hasOrganizerRole(roles, organizerScannerRoles)
  const organizationIds = [...new Set(memberships.map((membership) => membership.organization_id))]
  const salesOrganizationIds = [...new Set(
    memberships
      .filter((membership) => organizerSalesRoles.includes(membership.role as (typeof organizerSalesRoles)[number]))
      .map((membership) => membership.organization_id),
  )]

  const [organizationsResult, venuesResult, attractionsResult, ordersResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, verification_status, payments_enabled")
      .in("id", organizationIds)
      .order("name"),
    supabase
      .from("venues")
      .select("id, organization_id, name, city, timezone")
      .in("organization_id", organizationIds)
      .in("status", ["draft", "active"])
      .order("name"),
    supabase
      .from("organizer_attractions")
      .select("id, name, city, venue_id, is_active")
      .eq("is_active", true)
      .order("name"),
    canViewSales && salesOrganizationIds.length
      ? supabase
          .from("orders")
          .select("id, order_number, organization_id, status, payment_status, customer_name, total_amount, currency, created_at")
          .in("organization_id", salesOrganizationIds)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as DashboardOrder[], error: null }),
  ])

  if (organizationsResult.error || venuesResult.error || attractionsResult.error || ordersResult.error) {
    return <CenteredMessage>Nie udało się przygotować danych pulpitu organizatora.</CenteredMessage>
  }

  const organizations = (organizationsResult.data ?? []) as DashboardOrganization[]
  const venues = (venuesResult.data ?? []) as DashboardVenue[]
  const venueIds = venues.map((venue) => venue.id)
  const venueIdSet = new Set(venueIds)
  const attractions = ((attractionsResult.data ?? []) as DashboardAttraction[])
    .filter((attraction) => attraction.venue_id && venueIdSet.has(attraction.venue_id))
  const orders = (ordersResult.data ?? []) as DashboardOrder[]

  let products: DashboardProduct[] = []
  if (venueIds.length) {
    const productResult = await supabase
      .from("products")
      .select("id, venue_id, attraction_id, name, status")
      .in("venue_id", venueIds)
      .neq("status", "archived")
      .order("created_at", { ascending: false })

    if (productResult.error) {
      return <CenteredMessage>Nie udało się pobrać ofert organizatora.</CenteredMessage>
    }
    products = (productResult.data ?? []) as DashboardProduct[]
  }

  const productIds = products.map((product) => product.id)
  let sessions: DashboardSession[] = []
  if (productIds.length) {
    const now = Date.now()
    const sessionResult = await supabase
      .from("sessions")
      .select("id, product_id, starts_at, ends_at, capacity, status")
      .in("product_id", productIds)
      .eq("status", "scheduled")
      .gte("starts_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
      .lte("starts_at", new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(500)

    if (sessionResult.error) {
      return <CenteredMessage>Nie udało się pobrać kalendarza organizatora.</CenteredMessage>
    }
    sessions = (sessionResult.data ?? []) as DashboardSession[]
  }

  const now = new Date()
  const todayKey = localDateKey(now.toISOString(), polishTimezone)
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]))
  const productsById = new Map(products.map((product) => [product.id, product]))

  const todaySessions = sessions.filter((session) => {
    const product = productsById.get(session.product_id)
    const venue = product ? venuesById.get(product.venue_id) : null
    if (!venue) return false
    return localDateKey(session.starts_at, venue.timezone || polishTimezone)
      === localDateKey(now.toISOString(), venue.timezone || polishTimezone)
  })
  const upcomingSessions = sessions
    .filter((session) => new Date(session.starts_at).getTime() >= now.getTime())
    .slice(0, 6)

  const availabilityEntries = await Promise.all(
    upcomingSessions.map(async (session) => {
      const { data: availability } = await supabase.rpc("ticketing_get_session_availability", {
        p_session_id: session.id,
      })
      const row = availability?.[0] as DashboardAvailability | undefined
      return [session.id, row?.is_sellable ? row.available_capacity_units : null] as const
    }),
  )
  const availabilityBySessionId = new Map(availabilityEntries)

  const confirmedOrders = orders.filter(
    (order) => order.status === "confirmed" && order.payment_status === "paid",
  )
  const todayConfirmedOrders = confirmedOrders.filter(
    (order) => localDateKey(order.created_at, polishTimezone) === todayKey,
  )
  const todayRevenue = todayConfirmedOrders.reduce(
    (sum, order) => sum + Number(order.total_amount),
    0,
  )
  const thirtyDayRevenue = confirmedOrders.reduce(
    (sum, order) => sum + Number(order.total_amount),
    0,
  )
  const activeAttractions = attractions.filter((attraction) => attraction.is_active)
  const activeOffers = products.filter((product) => product.status === "active")
  const pendingOrders = orders.filter((order) => order.status === "awaiting_payment").length
  const unverifiedOrganizations = organizations.filter(
    (organization) => organization.verification_status !== "verified" || !organization.payments_enabled,
  )
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Użytkowniku"
  const tasks: DashboardTask[] = []

  if (canManage && unverifiedOrganizations.length > 0) {
    tasks.push({
      title: "Dokończ weryfikację firmy",
      description: unverifiedOrganizations.length === 1
        ? "Sprzedaż online wymaga zweryfikowanych danych organizacji i aktywnych płatności."
        : `${unverifiedOrganizations.length} organizacje wymagają sprawdzenia przed pełnym uruchomieniem płatności.`,
      href: "/host/weryfikacja",
      action: "Sprawdź weryfikację",
    })
  }
  if (canManage && activeAttractions.length > 0 && activeOffers.length === 0) {
    tasks.push({
      title: "Dodaj ofertę do atrakcji",
      description: "Masz aktywną atrakcję, ale klient nie ma jeszcze czego kupić.",
      href: "/host/sprzedaz/konfiguracja",
      action: "Dodaj ofertę",
    })
  }
  if (canManage && activeOffers.length > 0 && upcomingSessions.length === 0) {
    tasks.push({
      title: "Sprawdź dostępność",
      description: "Aktywne oferty nie mają żadnego terminu w najbliższych 14 dniach.",
      href: "/host/sprzedaz/dostepnosc",
      action: "Otwórz kalendarz",
    })
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> EnjoyHub
            </Link>
            <div className="flex items-center gap-2">
              {[...roles].slice(0, 2).map((role) => (
                <Badge key={role} variant="outline" className="hidden sm:inline-flex">{organizerRoleLabels[role]}</Badge>
              ))}
              {canManage ? (
                <Button asChild size="sm">
                  <Link href="/host/atrakcje/nowa"><PlusCircle className="h-4 w-4" /> Dodaj atrakcję</Link>
                </Button>
              ) : canScan ? (
                <Button asChild size="sm"><Link href="/host/skaner"><ScanLine className="h-4 w-4" /> Skaner</Link></Button>
              ) : null}
            </div>
          </div>
          <DashboardNavigation canManage={canManage} canViewSales={canViewSales} canScan={canScan} />
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-7 sm:py-10">
        <section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">Dzisiaj · {formatDashboardDate(now)}</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dzień dobry, {displayName}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Tu od razu widzisz, co dzieje się ze sprzedażą, terminami i atrakcjami oraz co wymaga Twojej reakcji.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {organizations.length} {organizations.length === 1 ? "organizacja" : "organizacje"} · {activeAttractions.length} {activeAttractions.length === 1 ? "atrakcja" : "atrakcje"}
          </div>
        </section>

        <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canViewSales ? (
            <>
              <MetricCard icon={Banknote} label="Sprzedaż dzisiaj" value={formatMoney(todayRevenue, "PLN")} hint={`${todayConfirmedOrders.length} opłaconych zamówień`} />
              <MetricCard icon={BarChart3} label="Sprzedaż · 30 dni" value={formatMoney(thirtyDayRevenue, "PLN")} hint={`${confirmedOrders.length} opłaconych zamówień`} />
            </>
          ) : (
            <>
              <MetricCard icon={CalendarDays} label="Terminy dzisiaj" value={String(todaySessions.length)} hint="zaplanowane wejścia" />
              <MetricCard icon={Store} label="Aktywne atrakcje" value={String(activeAttractions.length)} hint={`${activeOffers.length} aktywnych ofert`} />
            </>
          )}
          <MetricCard icon={CalendarClock} label="Terminy dzisiaj" value={String(todaySessions.length)} hint={upcomingSessions[0] ? `najbliższy ${formatSessionTime(upcomingSessions[0].starts_at, sessionTimezone(upcomingSessions[0], productsById, venuesById))}` : "brak kolejnych wejść"} />
          {canViewSales ? (
            <MetricCard icon={ReceiptText} label="Oczekujące płatności" value={String(pendingOrders)} hint="zamówienia w toku" />
          ) : (
            <MetricCard icon={Ticket} label="Aktywne oferty" value={String(activeOffers.length)} hint="widoczne w sprzedaży" />
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]">
          <div className="space-y-6">
            <Card className="surface-3d">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Najbliższe terminy</CardTitle>
                  <CardDescription>Najbliższe wejścia ze wszystkich Twoich aktywnych ofert.</CardDescription>
                </div>
                {canManage && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/host/sprzedaz/dostepnosc">Kalendarz <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {upcomingSessions.length === 0 ? (
                  <EmptyState icon={CalendarClock} title="Brak nadchodzących terminów" description="Dodaj regułę dostępności albo sprawdź, czy oferta jest aktywna." />
                ) : (
                  <div className="divide-y">
                    {upcomingSessions.map((session) => {
                      const product = productsById.get(session.product_id)
                      const venue = product ? venuesById.get(product.venue_id) : null
                      const timezone = venue?.timezone || polishTimezone
                      const available = availabilityBySessionId.get(session.id)
                      return (
                        <div key={session.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <span className="text-xs font-medium">{formatSessionDay(session.starts_at, timezone)}</span>
                              <span className="text-sm font-bold">{formatSessionTime(session.starts_at, timezone)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{product?.name ?? "Oferta"}</p>
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {venue?.name ?? "Obiekt"}{venue?.city ? ` · ${venue.city}` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-[4.25rem] sm:pl-0">
                            {available !== null && available !== undefined ? (
                              <Badge variant={available > 0 ? "secondary" : "outline"}>{available} wolnych</Badge>
                            ) : (
                              <Badge variant="outline">{session.capacity} miejsc</Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {canViewSales && (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle>Ostatnie zamówienia</CardTitle>
                    <CardDescription>Najnowsza aktywność sprzedażowa z ostatnich 30 dni.</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm"><Link href="/host/sprzedaz">Wszystkie <ArrowRight className="h-4 w-4" /></Link></Button>
                </CardHeader>
                <CardContent>
                  {orders.length === 0 ? (
                    <EmptyState icon={ReceiptText} title="Nie ma jeszcze zamówień" description="Pierwsza sprzedaż pojawi się tutaj automatycznie." />
                  ) : (
                    <div className="divide-y">
                      {orders.slice(0, 5).map((order) => (
                        <div key={order.id} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:gap-4">
                          <span className="font-mono text-sm font-semibold">#{order.order_number}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{formatOrderDate(order.created_at)}</p>
                          </div>
                          <OrderStatusBadge status={order.status} paymentStatus={order.payment_status} />
                          <span className="font-semibold">{formatMoney(Number(order.total_amount), order.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle>Twoje atrakcje</CardTitle>
                  <CardDescription>Szybki podgląd publicznych atrakcji i powiązanych ofert.</CardDescription>
                </div>
                {canManage && <Button asChild variant="outline" size="sm"><Link href="/host/atrakcje/nowa"><PlusCircle className="h-4 w-4" /> Dodaj</Link></Button>}
              </CardHeader>
              <CardContent>
                {activeAttractions.length === 0 ? (
                  <EmptyState icon={Store} title="Nie masz jeszcze atrakcji" description="Dodaj pierwszą atrakcję, aby uruchomić katalog i sprzedaż." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeAttractions.slice(0, 6).map((attraction) => {
                      const offerCount = products.filter((product) => product.attraction_id === attraction.id && product.status === "active").length
                      return (
                        <div key={attraction.id} className="rounded-xl border bg-background p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{attraction.name}</p>
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {attraction.city}</p>
                            </div>
                            <Badge variant="secondary">{offerCount} {offerCount === 1 ? "oferta" : "ofert"}</Badge>
                          </div>
                          <Link href={`/attractions/${attraction.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                            Zobacz stronę <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            {canManage && (
              <Card className={tasks.length ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {tasks.length ? <AlertTriangle className="h-5 w-5 text-amber-700" /> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
                    {tasks.length ? "Wymaga uwagi" : "Wszystko wygląda dobrze"}
                  </CardTitle>
                  <CardDescription>
                    {tasks.length ? "Najważniejsze rzeczy do zrobienia przed pełną sprzedażą." : "Nie widzę teraz krytycznych braków w konfiguracji."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tasks.length ? tasks.slice(0, 3).map((task) => (
                    <div key={task.title} className="rounded-lg border bg-background/90 p-4">
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{task.description}</p>
                      <Button asChild variant="link" className="mt-2 h-auto p-0"><Link href={task.href}>{task.action} <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Atrakcje, oferty, kalendarz i gotowość płatności są spójne.</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Szybkie działania</CardTitle>
                <CardDescription>Najczęstsze operacje bez szukania po panelu.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {canManage && <QuickAction href="/host/atrakcje/nowa" icon={PlusCircle} title="Dodaj atrakcję" />}
                {canManage && <QuickAction href="/host/sprzedaz/konfiguracja" icon={Settings2} title="Oferty i cennik" />}
                {canManage && <QuickAction href="/host/sprzedaz/dostepnosc" icon={CalendarClock} title="Kalendarz i dostępność" />}
                {canViewSales && <QuickAction href="/host/sprzedaz" icon={BarChart3} title="Sprzedaż i zamówienia" />}
                {canScan && <QuickAction href="/host/skaner" icon={ScanLine} title="Kontrola wejścia" />}
                {canManage && <QuickAction href="/host/weryfikacja" icon={ShieldCheck} title="Weryfikacja i płatności" />}
              </CardContent>
            </Card>

            {canManage && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Stan organizacji</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {organizations.map((organization) => {
                    const ready = organization.verification_status === "verified" && organization.payments_enabled
                    return (
                      <div key={organization.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{organization.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{verificationLabel(organization.verification_status)}</p>
                        </div>
                        <Badge variant={ready ? "secondary" : "outline"}>{ready ? "Gotowa" : "Do uzupełnienia"}</Badge>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}

function DashboardNavigation({ canManage, canViewSales, canScan }: { canManage: boolean; canViewSales: boolean; canScan: boolean }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-t py-2 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <NavItem href="/host" active>Pulpit</NavItem>
      {canViewSales && <NavItem href="/host/sprzedaz">Sprzedaż</NavItem>}
      {canManage && <NavItem href="/host/sprzedaz/konfiguracja">Oferty</NavItem>}
      {canManage && <NavItem href="/host/sprzedaz/dostepnosc">Kalendarz</NavItem>}
      {canManage && <NavItem href="/host/weryfikacja">Weryfikacja</NavItem>}
      {canScan && <NavItem href="/host/skaner">Skaner</NavItem>}
    </nav>
  )
}

function NavItem({ href, children, active = false }: { href: string; children: React.ReactNode; active?: boolean }) {
  return <Link href={href} className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{children}</Link>
}

function FirstOrganizerDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-background/90"><div className="container mx-auto max-w-6xl px-4 py-4"><Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Strona główna</Link></div></header>
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <Card className="surface-3d border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Ticket className="h-8 w-8 text-primary" /></div>
            <Badge variant="secondary" className="mb-4">Panel organizatora</Badge>
            <h1 className="text-2xl font-bold sm:text-3xl">Dodaj pierwszą atrakcję</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">Krótki kreator utworzy organizację, atrakcję, pierwszą ofertę, bilet i regułę dostępności. Dane prawne uzupełnisz później.</p>
            <Button asChild size="lg" className="mt-7"><Link href="/host/start">Zostań organizatorem <ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <Card className="surface-3d">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickAction({ href, icon: Icon, title }: { href: string; icon: LucideIcon; title: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
      <span className="flex items-center gap-3 text-sm font-medium"><Icon className="h-4 w-4 text-primary" /> {title}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="py-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function OrderStatusBadge({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  if (status === "confirmed" && paymentStatus === "paid") return <Badge variant="secondary">Opłacone</Badge>
  if (status === "awaiting_payment") return <Badge variant="outline">Oczekuje</Badge>
  if (status === "expired") return <Badge variant="outline">Wygasło</Badge>
  return <Badge variant="outline">{status === "cancelled" ? "Anulowane" : "W toku"}</Badge>
}

function localDateKey(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

function formatDashboardDate(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: polishTimezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date)
}

function formatSessionDay(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value))
}

function formatSessionTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: polishTimezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function sessionTimezone(
  session: DashboardSession,
  products: Map<string, DashboardProduct>,
  venues: Map<string, DashboardVenue>,
) {
  const product = products.get(session.product_id)
  if (!product) return polishTimezone
  return venues.get(product.venue_id)?.timezone || polishTimezone
}

function verificationLabel(status: DashboardOrganization["verification_status"]) {
  if (status === "verified") return "Dane zweryfikowane"
  if (status === "pending") return "Weryfikacja w toku"
  if (status === "rejected") return "Weryfikacja wymaga poprawy"
  return "Weryfikacja nie rozpoczęta"
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card className="max-w-xl"><CardContent className="flex items-start gap-3 p-8 text-muted-foreground"><Building2 className="mt-0.5 h-5 w-5 shrink-0" /><p>{children}</p></CardContent></Card></main>
}
