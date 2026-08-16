import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isTicketingCheckoutEnabled } from "@/lib/ticketing/config"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"
import { getTicketingProductSalesPage } from "@/lib/ticketing/queries"

export const dynamic = "force-dynamic"

interface ProductPageProps {
  params: Promise<{ productId: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  if (!isTicketingCheckoutEnabled) return { title: "Bilety | EnjoyHub" }

  const { productId } = await params
  const product = await getTicketingProductSalesPage(productId)
  if (!product) return { title: "Oferta biletowa | EnjoyHub" }

  return {
    title: `${product.name} — bilety | EnjoyHub`,
    description: product.description ?? `Kup bilety online do ${product.venue.name}.`,
  }
}

export default async function TicketingProductPage({ params }: ProductPageProps) {
  if (!isTicketingCheckoutEnabled) notFound()

  const { productId } = await params
  const product = await getTicketingProductSalesPage(productId)
  if (!product || product.ticketTypes.length === 0) notFound()

  const priceFrom = Math.min(...product.ticketTypes.map((ticketType) => ticketType.priceAmount))
  const currency = product.ticketTypes[0]?.currency ?? "PLN"

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background/95">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Wróć do EnjoyHub
          </Link>
        </div>
      </header>

      <section className="border-b bg-primary/5">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_20rem] lg:items-start lg:py-16">
          <div>
            <Badge variant="secondary" className="mb-4">Bilety online</Badge>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">{product.name}</h1>
            {product.description && (
              <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-relaxed text-muted-foreground sm:text-lg">
                {product.description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{product.venue.name}{product.venue.city ? `, ${product.venue.city}` : ""}</span>
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{product.durationMinutes} min</span>
              <span className="inline-flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" />od {formatMoney(priceFrom, currency)}</span>
            </div>
          </div>

          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="text-lg">Bezpieczny zakup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>Płatność online i bilet QR po potwierdzeniu zamówienia.</span></div>
              <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Dostępność każdego terminu jest liczona na żywo.</span></div>
              {(product.venue.addressLine1 || product.venue.city) && (
                <div className="rounded-md bg-muted p-3 text-xs">
                  {[product.venue.addressLine1, product.venue.city].filter(Boolean).join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="container mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[18rem_1fr] lg:py-14">
        <aside>
          <h2 className="text-lg font-semibold">Cennik</h2>
          <div className="mt-4 space-y-3">
            {product.ticketTypes.map((ticketType) => (
              <Card key={ticketType.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{ticketType.name}</p>
                      {ticketType.description && <p className="mt-1 text-xs text-muted-foreground">{ticketType.description}</p>}
                    </div>
                    <p className="whitespace-nowrap font-semibold">{formatMoney(ticketType.priceAmount, ticketType.currency)}</p>
                  </div>
                  {ticketType.capacityUnits > 1 && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> obejmuje {ticketType.capacityUnits} miejsca
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </aside>

        <section aria-labelledby="sessions-heading">
          <div className="mb-5">
            <h2 id="sessions-heading" className="text-2xl font-semibold">Wybierz termin</h2>
            <p className="mt-1 text-sm text-muted-foreground">Po przejściu dalej wybierzesz liczbę i rodzaj biletów.</p>
          </div>

          {product.sessions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CalendarDays className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                <h3 className="font-semibold">Brak dostępnych terminów</h3>
                <p className="mt-2 text-sm text-muted-foreground">Nowe daty pojawią się tutaj po uzupełnieniu kalendarza przez organizatora.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {product.sessions.map((session) => (
                <Link key={session.id} href={`/checkout/${session.id}`} className="group block">
                  <Card className="h-full transition-colors group-hover:border-primary/50">
                    <CardContent className="flex h-full items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-medium capitalize">{formatSessionDate(session.startsAt, product.venue.timezone)}</p>
                        <p className="mt-1 text-xs text-emerald-700">{session.availableCapacity} miejsc dostępnych</p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {product.sessions.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Button asChild variant="outline">
                <Link href="/checkout">Zobacz także wszystkie aktywne terminy</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
