import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CalendarClock, CheckCircle2, ExternalLink, QrCode, Settings2, ShieldCheck, ShoppingCart } from "lucide-react"

import { ClearOrganizerOnboardingDraft } from "@/components/ticketing/clear-organizer-onboarding-draft"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isTicketingCheckoutEnabled, isTicketingPaymentsEnabled } from "@/lib/ticketing/config"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Konfiguracja gotowa",
  description: "Atrakcja i pierwsza oferta biletowa zostały przygotowane.",
}

interface OrganizerAttraction { id: string; name: string; venue_id: string | null }
interface ProductForAttraction { id: string; name: string; attraction_id: string | null }
interface VenueOrganization { organization_id: string }
interface OrganizationReadiness { verification_status: "not_started" | "pending" | "verified" | "rejected"; payments_enabled: boolean }

export default async function OrganizerOnboardingCompletePage({ searchParams }: { searchParams: Promise<{ atrakcja?: string; oferta?: string }> }) {
  if (!isSupabaseConfigured) redirect("/host")
  const query = await searchParams
  if (!query.atrakcja || !query.oferta) redirect("/host")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host")

  const [attractionResult, productResult] = await Promise.all([
    supabase.from("organizer_attractions").select("id, name, venue_id").eq("id", query.atrakcja).single(),
    supabase.from("products").select("id, name, attraction_id").eq("id", query.oferta).single(),
  ])

  const attraction = attractionResult.data as OrganizerAttraction | null
  const product = productResult.data as ProductForAttraction | null
  if (attractionResult.error || productResult.error || !attraction || !product || product.attraction_id !== attraction.id || !attraction.venue_id) redirect("/host")

  const { data: venueData } = await supabase.from("venues").select("organization_id").eq("id", attraction.venue_id).single()
  const venue = venueData as VenueOrganization | null
  if (!venue) redirect("/host")

  const { data: readinessData } = await supabase
    .from("organizations")
    .select("verification_status, payments_enabled")
    .eq("id", venue.organization_id)
    .single()
  const readiness = readinessData as OrganizationReadiness | null
  const organizerPaymentsReady = readiness?.verification_status === "verified" && readiness.payments_enabled === true
  const publicSalesReady = isTicketingCheckoutEnabled && isTicketingPaymentsEnabled && organizerPaymentsReady

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-10 sm:py-16">
      <ClearOrganizerOnboardingDraft userId={user.id} />
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
          <Badge variant="secondary" className="mt-5">Atrakcja opublikowana</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">„{attraction.name}” jest już w EnjoyHub</h1>
          <p className="mt-4 text-lg text-muted-foreground">Strona atrakcji, oferta „{product.name}”, pierwszy rodzaj biletu i reguła dostępności są przygotowane. EnjoyHub automatycznie utrzymuje przyszłe terminy.</p>
        </div>

        {!organizerPaymentsReady ? (
          <Alert className="mt-8 border-amber-200 bg-amber-50 text-amber-950">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Teraz zweryfikuj firmę</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Atrakcja może być widoczna już teraz, ale przyjmowanie płatności jest zablokowane do czasu weryfikacji danych organizatora.</p>
              <Button asChild size="sm"><Link href="/host/weryfikacja">Przejdź do weryfikacji <ArrowRight className="h-4 w-4" /></Link></Button>
            </AlertDescription>
          </Alert>
        ) : !publicSalesReady ? (
          <Alert className="mt-8 border-amber-200 bg-amber-50 text-amber-950"><Settings2 className="h-4 w-4" /><AlertTitle>Firma zweryfikowana</AlertTitle><AlertDescription>Płatności globalne EnjoyHub są jeszcze w trybie przygotowania. Możesz sprawdzić ofertę, cennik i dostępność.</AlertDescription></Alert>
        ) : (
          <Alert className="mt-8 border-emerald-200 bg-emerald-50 text-emerald-950"><ShoppingCart className="h-4 w-4" /><AlertTitle>Sprzedaż online jest aktywna</AlertTitle><AlertDescription>Klienci mogą wybrać termin, rodzaj biletu, zapłacić i otrzymać bilet QR.</AlertDescription></Alert>
        )}

        <Card className="surface-3d mt-6">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Co dalej?</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <NextStep number="1" title="Sprawdź stronę" description="Zobacz atrakcję i ofertę oczami klienta." />
              <NextStep number="2" title={organizerPaymentsReady ? "Sprawdź dostępność" : "Zweryfikuj firmę"} description={organizerPaymentsReady ? "Sprawdź reguły i dodaj wyjątek, jeśli trzeba." : "Uzupełnij dane prawne przed płatnościami."} />
              <NextStep number="3" title="Panel organizatora" description="Dodawaj kolejne atrakcje, oferty i bilety." />
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="h-12"><Link href={`/attractions/${attraction.id}`}>Zobacz stronę atrakcji <ExternalLink className="h-4 w-4" /></Link></Button>
              {isTicketingCheckoutEnabled ? <Button asChild size="lg" variant="outline" className="h-12"><Link href={`/bilety/${product.id}`}>Zobacz ofertę <ShoppingCart className="h-4 w-4" /></Link></Button> : null}
              <Button asChild size="lg" variant="outline" className="h-12"><Link href="/host/sprzedaz/dostepnosc">Kalendarz i dostępność <CalendarClock className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12"><Link href="/host/skaner">Otwórz skaner <QrCode className="h-4 w-4" /></Link></Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center"><Button asChild variant="ghost"><Link href="/host">Przejdź do panelu organizatora <ArrowRight className="h-4 w-4" /></Link></Button></div>
      </div>
    </main>
  )
}

function NextStep({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{number}</span><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
}
