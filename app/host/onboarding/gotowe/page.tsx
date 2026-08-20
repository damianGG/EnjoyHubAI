import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Settings2,
  ShoppingCart,
} from "lucide-react"

import { ClearOrganizerOnboardingDraft } from "@/components/ticketing/clear-organizer-onboarding-draft"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  isTicketingCheckoutEnabled,
  isTicketingPaymentsEnabled,
} from "@/lib/ticketing/config"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Konfiguracja gotowa",
  description: "Atrakcja i pierwsza oferta biletowa zostały przygotowane.",
}

interface ProductWithVenue {
  id: string
  name: string
  venues: {
    property_id: string | null
  }
}

export default async function OrganizerOnboardingCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ atrakcja?: string; oferta?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host")

  const query = await searchParams
  if (!query.atrakcja || !query.oferta) redirect("/host")

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host")

  const [propertyResult, productResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title")
      .eq("id", query.atrakcja)
      .eq("host_id", user.id)
      .single(),
    supabase
      .from("products")
      .select("id, name, venues!inner (property_id)")
      .eq("id", query.oferta)
      .single(),
  ])

  const product = productResult.data as ProductWithVenue | null
  if (
    propertyResult.error
    || productResult.error
    || !propertyResult.data
    || !product
    || product.venues.property_id !== propertyResult.data.id
  ) {
    redirect("/host")
  }
  const verifiedProduct = product as ProductWithVenue

  const publicSalesReady = isTicketingCheckoutEnabled && isTicketingPaymentsEnabled

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-10 sm:py-16">
      <ClearOrganizerOnboardingDraft userId={user.id} />
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <Badge variant="secondary" className="mt-5">Konfiguracja gotowa</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Twoja atrakcja i bilety są przygotowane</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            „{propertyResult.data.title}” ma publiczną stronę, ofertę „{verifiedProduct.name}”, cennik oraz pierwsze 90 dni terminów.
          </p>
        </div>

        {!publicSalesReady ? (
          <Alert className="mt-8 border-amber-200 bg-amber-50 text-amber-950">
            <Settings2 className="h-4 w-4" />
            <AlertTitle>Oferta jest gotowa do sprawdzenia</AlertTitle>
            <AlertDescription>
              Płatności online są jeszcze w trybie przygotowania. Administrator EnjoyHub może teraz sprawdzić ceny, terminy i testowy zakup przed pełnym startem.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mt-8 border-emerald-200 bg-emerald-50 text-emerald-950">
            <ShoppingCart className="h-4 w-4" />
            <AlertTitle>Sprzedaż online jest aktywna</AlertTitle>
            <AlertDescription>Klienci mogą wybrać termin, zapłacić i otrzymać bilet QR.</AlertDescription>
          </Alert>
        )}

        <Card className="surface-3d mt-6">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Co warto zrobić teraz?</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <NextStep number="1" title="Sprawdź stronę" description="Przeczytaj opis i zobacz kalendarz." />
              <NextStep number="2" title="Zrób test" description="Przejdź zakup tak jak zwykły klient." />
              <NextStep number="3" title="Sprawdź QR" description="Otwórz skaner w panelu obiektu." />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="h-12">
                <Link href={`/attractions/${propertyResult.data.id}`}>
                  Zobacz stronę atrakcji <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              {isTicketingCheckoutEnabled ? (
                <Button asChild size="lg" variant="outline" className="h-12">
                  <Link href={`/bilety/${verifiedProduct.id}`}>Zobacz ofertę <ShoppingCart className="h-4 w-4" /></Link>
                </Button>
              ) : null}
              <Button asChild size="lg" variant="outline" className="h-12">
                <Link href="/host/skaner">Otwórz skaner <QrCode className="h-4 w-4" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost">
            <Link href="/host">Przejdź do panelu organizatora <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

function NextStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{number}</span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}
