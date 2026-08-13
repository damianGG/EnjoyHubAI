import Link from "next/link"
import { ArrowLeft, CalendarDays, Clock, MapPin, Users } from "lucide-react"
import { notFound } from "next/navigation"

import { CheckoutForm } from "@/components/ticketing/checkout-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { isTicketingCheckoutEnabled } from "@/lib/ticketing/config"
import { formatSessionDate } from "@/lib/ticketing/format"
import { getCheckoutSession } from "@/lib/ticketing/queries"

export const dynamic = "force-dynamic"

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  if (!isTicketingCheckoutEnabled) notFound()
  const { sessionId } = await params
  const session = await getCheckoutSession(sessionId)
  if (!session || session.ticketTypes.length === 0) notFound()

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <Link href="/checkout" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Wszystkie terminy
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            <Badge variant="secondary" className="mb-3">Bezpieczny checkout</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{session.product.name}</h1>
            {session.product.description && (
              <p className="mt-4 max-w-2xl text-muted-foreground">{session.product.description}</p>
            )}
            <div className="mt-7">
              <CheckoutForm session={session} />
            </div>
          </div>

          <aside className="lg:order-last">
            <Card className="surface-3d lg:sticky lg:top-8">
              <CardContent className="space-y-5 p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Obiekt</p>
                  <p className="font-semibold">{session.venue.name}</p>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" /><span>{formatSessionDate(session.startsAt, session.venue.timezone)}</span></div>
                  <div className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 text-primary" /><span>{session.product.durationMinutes} minut</span></div>
                  <div className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 text-primary" /><span>{session.availableCapacity} miejsc dostępnych</span></div>
                  {(session.venue.addressLine1 || session.venue.city) && (
                    <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-primary" /><span>{[session.venue.addressLine1, session.venue.city].filter(Boolean).join(", ")}</span></div>
                  )}
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Na tym etapie nie pobieramy jeszcze płatności. Sprawdzamy realne blokowanie miejsc i tworzenie zamówienia.
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
