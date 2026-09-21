import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Building2, CalendarClock, CheckCircle2, Circle, ExternalLink, QrCode, Settings2, ShieldCheck, ShoppingCart, WalletCards } from "lucide-react"

import { ClearOrganizerOnboardingDraft } from "@/components/ticketing/clear-organizer-onboarding-draft"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { publicAttractionPath } from "@/lib/marketplace/attraction-path"
import { submitIndexNowForAttractionId } from "@/lib/seo/indexnow"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isStripeConnectEnabled } from "@/lib/stripe-connect"
import { isTicketingCheckoutEnabled, isTicketingPaymentsEnabled } from "@/lib/ticketing/config"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Konfiguracja gotowa",
  description: "Atrakcja i pierwsza oferta biletowa zostały przygotowane.",
}

interface OrganizerAttraction { id: string; name: string; city: string; venue_id: string | null }
interface ProductForAttraction { id: string; name: string; attraction_id: string | null }
interface ProductScheduleSummary { valid_from: string; capacity: number }
interface VenueOrganization { organization_id: string }
interface OrganizationReadiness {
  verification_status: "not_started" | "pending" | "verified" | "rejected"
  payments_enabled: boolean
  legal_name: string | null
  tax_id: string | null
  billing_email: string | null
  legal_address: string | null
  contact_phone: string | null
  trader_self_certified_at: string | null
}
interface PaymentAccountReadiness {
  details_submitted: boolean
  charges_enabled: boolean
  card_payments_enabled: boolean
  transfers_enabled: boolean
  payouts_enabled: boolean
  payout_schedule_manual: boolean
}

export default async function OrganizerOnboardingCompletePage({ searchParams }: { searchParams: Promise<{ atrakcja?: string; oferta?: string }> }) {
  if (!isSupabaseConfigured) redirect("/host")
  const query = await searchParams
  if (!query.atrakcja || !query.oferta) redirect("/host")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host")

  const [attractionResult, productResult, scheduleResult] = await Promise.all([
    supabase.from("organizer_attractions").select("id, name, city, venue_id").eq("id", query.atrakcja).single(),
    supabase.from("products").select("id, name, attraction_id").eq("id", query.oferta).single(),
    supabase.from("product_schedules").select("valid_from, capacity").eq("product_id", query.oferta).eq("is_active", true).order("valid_from").limit(1).maybeSingle(),
  ])

  const attraction = attractionResult.data as OrganizerAttraction | null
  const product = productResult.data as ProductForAttraction | null
  const schedule = scheduleResult.data as ProductScheduleSummary | null
  if (attractionResult.error || productResult.error || !attraction || !product || product.attraction_id !== attraction.id || !attraction.venue_id) redirect("/host")

  const { data: venueData } = await supabase.from("venues").select("organization_id").eq("id", attraction.venue_id).single()
  const venue = venueData as VenueOrganization | null
  if (!venue) redirect("/host")

  const [readinessResult, paymentAccountResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("verification_status, payments_enabled, legal_name, tax_id, billing_email, legal_address, contact_phone, trader_self_certified_at")
      .eq("id", venue.organization_id)
      .single(),
    supabase
      .from("organization_payment_accounts")
      .select("details_submitted, charges_enabled, card_payments_enabled, transfers_enabled, payouts_enabled, payout_schedule_manual")
      .eq("organization_id", venue.organization_id)
      .maybeSingle(),
  ])
  const readinessData = readinessResult.data
  const paymentAccountData = paymentAccountResult.data
  const readiness = readinessData as OrganizationReadiness | null
  const paymentAccount = paymentAccountData as PaymentAccountReadiness | null
  const legalDataComplete = Boolean(
    readiness?.legal_name?.trim()
    && readiness.tax_id?.trim()
    && readiness.billing_email?.trim()
    && readiness.legal_address?.trim()
    && readiness.contact_phone?.trim()
    && readiness.trader_self_certified_at,
  )
  const stripeAccountReady = Boolean(
    paymentAccount?.details_submitted
    && paymentAccount.charges_enabled
    && paymentAccount.card_payments_enabled
    && paymentAccount.transfers_enabled
    && paymentAccount.payouts_enabled
    && paymentAccount.payout_schedule_manual,
  )
  const organizerPaymentsReady = readiness?.verification_status === "verified" && readiness.payments_enabled === true
  const publicSalesReady = isTicketingCheckoutEnabled
    && isTicketingPaymentsEnabled
    && legalDataComplete
    && organizerPaymentsReady
    && (!isStripeConnectEnabled || stripeAccountReady)
  const salesStatusDescription = publicSalesReady
    ? "Aktywna — klient może kupić bilet."
    : !legalDataComplete
      ? "Wyłączona — uzupełnij dane firmy."
      : isStripeConnectEnabled && !stripeAccountReady
        ? "Wyłączona — dokończ konfigurację Stripe."
        : !organizerPaymentsReady
          ? "Wyłączona — weryfikacja płatności jeszcze trwa."
          : "Wyłączona w konfiguracji platformy."

  const attractionPath = publicAttractionPath({ id: attraction.id, title: attraction.name, city: attraction.city })

  // Best-effort discovery notification after a successfully created organizer attraction.
  await submitIndexNowForAttractionId(attraction.id)

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-10 sm:py-16">
      <ClearOrganizerOnboardingDraft userId={user.id} />
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
          <Badge variant="secondary" className="mt-5">Atrakcja opublikowana</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">„{attraction.name}” jest już w EnjoyHub</h1>
          <p className="mt-4 text-lg text-muted-foreground">Publiczna strona i oferta „{product.name}” są gotowe. Terminy utworzyliśmy od {schedule ? formatDate(schedule.valid_from) : "wybranej daty"}; sprawdź je przed rozpoczęciem sprzedaży.</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <StatusCard ready title="Strona atrakcji" description="Opublikowana i widoczna dla klientów." />
          <StatusCard ready={publicSalesReady} title="Sprzedaż online" description={salesStatusDescription} />
        </div>

        {!legalDataComplete ? (
          <Alert className="mt-8 border-amber-200 bg-amber-50 text-amber-950">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Następny krok: uzupełnij dane sprzedawcy</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Atrakcja jest już widoczna, ale przed płatnością klient musi poznać pełną nazwę firmy, NIP, adres i dane kontaktowe sprzedawcy.</p>
              <Button asChild size="sm"><Link href="/host/weryfikacja">Uzupełnij dane firmy <ArrowRight className="h-4 w-4" /></Link></Button>
            </AlertDescription>
          </Alert>
        ) : isStripeConnectEnabled && !stripeAccountReady ? (
          <Alert className="mt-8 border-amber-200 bg-amber-50 text-amber-950">
            <WalletCards className="h-4 w-4" />
            <AlertTitle>Następny krok: połącz płatności i rachunek</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Dane sprzedawcy są kompletne. Stripe bezpiecznie potwierdzi tożsamość i rachunek bankowy, na który będziesz wypłacać środki.</p>
              <Button asChild size="sm"><Link href="/host/rozliczenia">Połącz Stripe Connect <ArrowRight className="h-4 w-4" /></Link></Button>
            </AlertDescription>
          </Alert>
        ) : !organizerPaymentsReady ? (
          <Alert className="mt-8 border-amber-200 bg-amber-50 text-amber-950">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Weryfikacja płatności jeszcze trwa</AlertTitle>
            <AlertDescription>Strona atrakcji i terminy są gotowe. Sprzedaż online włączy się po zakończeniu weryfikacji organizatora i płatności.</AlertDescription>
          </Alert>
        ) : !publicSalesReady ? (
          <Alert className="mt-8 border-amber-200 bg-amber-50 text-amber-950"><Settings2 className="h-4 w-4" /><AlertTitle>Firma zweryfikowana</AlertTitle><AlertDescription>Sprzedaż online nie jest jeszcze dostępna. Możesz już sprawdzić ofertę, cennik i dostępność.</AlertDescription></Alert>
        ) : (
          <Alert className="mt-8 border-emerald-200 bg-emerald-50 text-emerald-950"><ShoppingCart className="h-4 w-4" /><AlertTitle>Sprzedaż online jest aktywna</AlertTitle><AlertDescription>Klienci mogą wybrać termin, rodzaj biletu, zapłacić i otrzymać bilet QR.</AlertDescription></Alert>
        )}

        <Card className="surface-3d mt-6">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Uruchom sprzedaż krok po kroku</h2>
            <p className="mt-2 text-sm text-muted-foreground">Zawsze widzisz, co jest gotowe i jaki krok pozostał.</p>
            <div className="mt-5 space-y-3">
              <ReadinessStep complete icon={Building2} title="Strona atrakcji i pierwsza oferta" description="Opublikowane — zobacz je oczami klienta." href={attractionPath} action="Zobacz stronę" />
              <ReadinessStep complete={legalDataComplete} icon={ShieldCheck} title="Dane sprzedawcy" description={legalDataComplete ? "Pełna nazwa firmy, NIP, adres i kontakt są uzupełnione." : "Uzupełnij dane, które klient zobaczy przed zakupem."} href="/host/weryfikacja" action={legalDataComplete ? "Sprawdź dane" : "Uzupełnij"} />
              {isStripeConnectEnabled ? (
                <ReadinessStep complete={stripeAccountReady} icon={WalletCards} title="Płatności i rachunek do wypłat" description={stripeAccountReady ? "Stripe potwierdził konto i rachunek do wypłat." : "Potwierdź tożsamość i rachunek w bezpiecznym formularzu Stripe."} href="/host/rozliczenia" action={stripeAccountReady ? "Rozliczenia" : "Połącz Stripe"} />
              ) : null}
              <ReadinessStep complete icon={CalendarClock} title="Terminy utworzone" description={schedule ? `Kalendarz startuje ${formatDate(schedule.valid_from)} z limitem ${schedule.capacity} miejsc. Zalecamy sprawdzić święta i wyjątki.` : "Automatyczny kalendarz jest utworzony. Zalecamy sprawdzić daty, miejsca i wyjątki."} href="/host/sprzedaz/dostepnosc" action="Sprawdź terminy" />
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="h-12"><Link href={attractionPath}>Zobacz stronę atrakcji <ExternalLink className="h-4 w-4" /></Link></Button>
              {isTicketingCheckoutEnabled ? <Button asChild size="lg" variant="outline" className="h-12"><Link href={`/bilety/${product.id}`}>Zobacz ofertę <ShoppingCart className="h-4 w-4" /></Link></Button> : null}
              <Button asChild size="lg" variant="outline" className="h-12"><Link href="/host/sprzedaz/dostepnosc">Kalendarz i dostępność <CalendarClock className="h-4 w-4" /></Link></Button>
              {publicSalesReady ? <Button asChild size="lg" variant="outline" className="h-12"><Link href="/host/skaner">Otwórz skaner <QrCode className="h-4 w-4" /></Link></Button> : null}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center"><Button asChild variant="ghost"><Link href="/host">Przejdź do panelu organizatora <ArrowRight className="h-4 w-4" /></Link></Button></div>
      </div>
    </main>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "Europe/Warsaw" })
    .format(new Date(`${value}T12:00:00Z`))
}

function StatusCard({ ready, title, description }: { ready: boolean; title: string; description: string }) {
  return (
    <div className={ready ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" : "rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"}>
      <p className="flex items-center gap-2 text-sm font-semibold">{ready ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{title}</p>
      <p className="mt-1 text-xs leading-5">{description}</p>
    </div>
  )
}

function ReadinessStep({ complete, icon: Icon, title, description, href, action }: { complete: boolean; icon: typeof Building2; title: string; description: string; href: string; action: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
      <div className={complete ? "text-emerald-600" : "text-amber-600"}>{complete ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Button asChild size="sm" variant={complete ? "outline" : "default"}><Link href={href}>{action}</Link></Button>
    </div>
  )
}
