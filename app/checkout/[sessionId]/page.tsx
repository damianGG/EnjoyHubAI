import Link from "next/link"
import { ArrowLeft, CalendarDays, Check, Clock, MapPin, ShieldCheck, Users } from "lucide-react"
import { notFound } from "next/navigation"

import { CheckoutForm } from "@/components/ticketing/checkout-form"
import { Card, CardContent } from "@/components/ui/card"
import { isTicketingCheckoutEnabled, isTicketingPaymentsEnabled } from "@/lib/ticketing/config"
import { formatSessionDate } from "@/lib/ticketing/format"
import { getCheckoutSession } from "@/lib/ticketing/queries"

export const dynamic = "force-dynamic"

export default async function CheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  if (!isTicketingCheckoutEnabled) notFound()
  const { sessionId } = await params
  const session = await getCheckoutSession(sessionId)
  if (!session || session.ticketTypes.length === 0) notFound()

  return (
    <main className="min-h-screen bg-[#f7f8fa] pb-10">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/attractions" className="text-xl font-black tracking-tight text-[#0b1220]">
            enjoy<span className="text-[#ff5a1f]">hub</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />Bezpieczna rezerwacja
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
        <Link href="/attractions" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Wróć do atrakcji
        </Link>

        <div className="mb-7 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-3 items-center gap-2 text-center text-xs sm:text-sm">
            <div className="flex items-center justify-center gap-2 font-semibold text-emerald-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100"><Check className="h-4 w-4" /></span>
              <span className="hidden sm:inline">Termin</span>
            </div>
            <div className="relative flex items-center justify-center gap-2 font-semibold text-[#ff5a1f] before:absolute before:right-1/2 before:top-1/2 before:-z-0 before:h-px before:w-full before:bg-border after:absolute after:left-1/2 after:top-1/2 after:-z-0 after:h-px after:w-full after:bg-border">
              <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#ff5a1f] text-white">2</span>
              <span className="relative z-10 hidden bg-white px-1 sm:inline">Dane</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">3</span>
              <span className="hidden sm:inline">Płatność</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <section>
            <p className="text-sm font-medium text-[#ff5a1f]">Jeszcze chwila</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Bilety i dane rezerwacji</h1>
            <p className="mt-2 text-sm text-muted-foreground">Wybierz liczbę biletów i podaj dane, na które wyślemy potwierdzenie.</p>
            <div className="mt-6">
              <CheckoutForm session={session} />
            </div>
          </section>

          <aside className="order-first lg:order-last">
            <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-lg ring-1 ring-black/5 lg:sticky lg:top-6">
              <CardContent className="space-y-5 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Twoja rezerwacja</p>
                  <p className="mt-1 text-lg font-bold">{session.product.name}</p>
                  <p className="text-sm text-muted-foreground">{session.venue.name}</p>
                </div>

                <div className="space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
                  <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-[#ff5a1f]" /><span>{formatSessionDate(session.startsAt, session.venue.timezone)}</span></div>
                  <div className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 text-[#ff5a1f]" /><span>{session.product.durationMinutes} minut</span></div>
                  <div className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 text-[#ff5a1f]" /><span>{session.availableCapacity} miejsc dostępnych</span></div>
                  {(session.venue.addressLine1 || session.venue.city) && (
                    <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-[#ff5a1f]" /><span>{[session.venue.addressLine1, session.venue.city].filter(Boolean).join(", ")}</span></div>
                  )}
                </div>

                <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                  {isTicketingPaymentsEnabled
                    ? "Po zatwierdzeniu danych przejdziesz do płatności. Miejsca zostaną zablokowane na 15 minut."
                    : "Płatności są obecnie wyłączone flagą środowiskową; możesz przetestować blokowanie miejsc."}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
