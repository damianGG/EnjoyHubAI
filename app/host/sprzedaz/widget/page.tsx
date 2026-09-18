import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, MonitorSmartphone } from "lucide-react"

import { BookingWidgetInstallCard } from "@/components/ticketing/booking-widget-install-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { organizerManagementRoles, type OrganizerRole } from "@/lib/organizer/access"
import { getPublicSiteUrl } from "@/lib/site-url"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isTicketingCheckoutEnabled } from "@/lib/ticketing/config"

export const dynamic = "force-dynamic"

interface MembershipRow {
  organization_id: string
  role: OrganizerRole
}

interface VenueRow {
  id: string
  organization_id: string
  name: string
  city: string | null
  property_id: string | null
}

interface PropertyRow {
  id: string
  title: string
  city: string
}

interface ProductRow {
  venue_id: string
}

export default async function BookingWidgetInstallerPage() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Generator widgetu jest chwilowo niedostępny. Spróbuj ponownie za chwilę.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/sprzedaz/widget")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) {
    return <CenteredMessage>Nie udało się sprawdzić Twoich uprawnień.</CenteredMessage>
  }

  const managerMemberships = ((membershipData ?? []) as MembershipRow[]).filter((membership) =>
    organizerManagementRoles.includes(membership.role as (typeof organizerManagementRoles)[number]),
  )

  if (managerMemberships.length === 0) {
    return <CenteredMessage>Nie masz uprawnień do konfiguracji widgetu sprzedażowego.</CenteredMessage>
  }

  const organizationIds = [...new Set(managerMemberships.map((membership) => membership.organization_id))]
  const { data: venueData, error: venueError } = await supabase
    .from("venues")
    .select("id, organization_id, name, city, property_id")
    .in("organization_id", organizationIds)
    .eq("status", "active")
    .not("property_id", "is", null)
    .order("name")

  if (venueError) {
    return <CenteredMessage>Nie udało się pobrać obiektów połączonych z marketplace.</CenteredMessage>
  }

  const venues = (venueData ?? []) as VenueRow[]
  const venueIds = venues.map((venue) => venue.id)
  const propertyIds = venues.flatMap((venue) => venue.property_id ? [venue.property_id] : [])

  const [productResult, propertyResult] = await Promise.all([
    venueIds.length
      ? supabase.from("products").select("venue_id").in("venue_id", venueIds).eq("status", "active")
      : Promise.resolve({ data: [] as ProductRow[], error: null }),
    propertyIds.length
      ? supabase.from("properties").select("id, title, city").in("id", propertyIds).eq("is_active", true)
      : Promise.resolve({ data: [] as PropertyRow[], error: null }),
  ])

  if (productResult.error || propertyResult.error) {
    return <CenteredMessage>Nie udało się pobrać aktywnych ofert dla widgetu.</CenteredMessage>
  }

  const activeVenueIds = new Set(((productResult.data ?? []) as ProductRow[]).map((product) => product.venue_id))
  const propertiesById = new Map(((propertyResult.data ?? []) as PropertyRow[]).map((property) => [property.id, property]))
  const installable = venues.flatMap((venue) => {
    if (!venue.property_id || !activeVenueIds.has(venue.id)) return []
    const property = propertiesById.get(venue.property_id)
    if (!property) return []
    return [{ venue, property }]
  })

  const siteUrl = getPublicSiteUrl()

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
          <Badge variant="secondary" className="mb-3">Widget EnjoyHub</Badge>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
            <MonitorSmartphone className="h-8 w-8 text-[#ff5a1f]" />
            Rezerwacje na Twojej stronie
          </h1>
          <p className="mt-3 text-muted-foreground">
            Wklejasz jeden fragment kodu na własnej stronie. Kalendarz, ceny i wolne miejsca są synchronizowane z EnjoyHub automatycznie, a klient przechodzi prosto do rezerwacji i płatności.
          </p>
        </div>

        {!isTicketingCheckoutEnabled && (
          <Alert className="mb-6">
            <AlertTitle>Rezerwacje online nie są jeszcze aktywne</AlertTitle>
            <AlertDescription>
              Kod widgetu możesz już przygotować, ale klienci zaczną rezerwować dopiero po włączeniu sprzedaży biletowej.
            </AlertDescription>
          </Alert>
        )}

        {installable.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <MonitorSmartphone className="mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Najpierw połącz aktywną ofertę z atrakcją</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Widget pojawi się tutaj, gdy obiekt ma aktywną ofertę sprzedażową i jest połączony z publicznym profilem atrakcji.
              </p>
              <Button asChild className="mt-5">
                <Link href="/host/sprzedaz/konfiguracja">Otwórz oferty i terminy</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {installable.map(({ venue, property }) => (
              <BookingWidgetInstallCard
                key={venue.id}
                propertyId={property.id}
                attractionName={property.title}
                siteUrl={siteUrl}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-xl">
        <CardContent className="p-8 text-center text-muted-foreground">{children}</CardContent>
      </Card>
    </main>
  )
}
