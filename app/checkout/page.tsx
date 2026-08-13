import Link from "next/link"
import { CalendarDays, ChevronRight, MapPin, Ticket } from "lucide-react"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { isTicketingCheckoutEnabled } from "@/lib/ticketing/config"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"
import { listCheckoutSessions } from "@/lib/ticketing/queries"

export const dynamic = "force-dynamic"

export default async function CheckoutSessionsPage() {
  if (!isTicketingCheckoutEnabled) notFound()
  const sessions = await listCheckoutSessions()

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="container mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <Badge variant="secondary" className="mb-4">Nowa sprzedaż EnjoyHub</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Wybierz termin atrakcji</h1>
          <p className="mt-4 text-muted-foreground">
            Dostępność jest liczona na żywo. Po wybraniu biletów zablokujemy miejsca na 15 minut.
          </p>
        </div>

        {sessions.length === 0 ? (
          <Card className="surface-3d border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-16 text-center">
              <Ticket className="mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Brak aktywnych terminów</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Dodaj testową ofertę i termin w Supabase, aby sprawdzić checkout na żywo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Link key={session.id} href={`/checkout/${session.id}`} className="group block">
                <Card className="lift-3d border-primary/10">
                  <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold group-hover:text-primary">{session.productName}</h2>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{session.venueName}{session.city ? `, ${session.city}` : ""}</span>
                        <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatSessionDate(session.startsAt, session.timezone)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <div className="text-right">
                        {session.priceFrom !== null && <p className="font-semibold">od {formatMoney(session.priceFrom, session.currency)}</p>}
                        <p className="text-xs text-emerald-700">{session.availableCapacity} miejsc dostępnych</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
