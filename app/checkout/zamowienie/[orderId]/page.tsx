import { cookies } from "next/headers"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Check, CheckCircle2, CircleAlert, Mail, MapPin, ShieldCheck, Ticket } from "lucide-react"
import { notFound } from "next/navigation"

import { HoldCountdown } from "@/components/ticketing/hold-countdown"
import { PaymentButton } from "@/components/ticketing/payment-button"
import { PaymentStatusWatcher } from "@/components/ticketing/payment-status-watcher"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { checkoutCookieName, isTicketingCheckoutEnabled, isTicketingPaymentsEnabled } from "@/lib/ticketing/config"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"
import { getCheckoutOrderSummary } from "@/lib/ticketing/queries"
import { checkoutCookieMatches, parseCheckoutCookie } from "@/lib/ticketing/security"

export const dynamic = "force-dynamic"

export default async function CheckoutOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ platnosc?: string }>
}) {
  if (!isTicketingCheckoutEnabled) notFound()
  const [{ orderId }, query] = await Promise.all([params, searchParams])
  const cookieStore = await cookies()
  const checkoutCookie = parseCheckoutCookie(cookieStore.get(checkoutCookieName)?.value)
  if (!checkoutCookieMatches(checkoutCookie, orderId)) notFound()

  const order = await getCheckoutOrderSummary(orderId, checkoutCookie!.holdToken)
  if (!order) notFound()

  const firstItem = order.items[0]
  const isPaid = order.status === "confirmed" && order.paymentStatus === "paid"
  const isAwaitingPayment = order.status === "awaiting_payment"
  const isClosed = ["cancelled", "expired"].includes(order.status) || order.paymentStatus === "failed"
  const returnedFromStripe = query.platnosc === "powrot"

  return (
    <main className="min-h-screen bg-[#f7f8fa] pb-12">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/attractions" className="text-xl font-black tracking-tight text-[#0b1220]">
            enjoy<span className="text-[#ff5a1f]">hub</span>
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />Bezpieczny checkout
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-9">
        <Link href="/attractions" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Wróć do atrakcji
        </Link>

        <div className="mb-7 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-3 items-center text-center text-xs sm:text-sm">
            {[
              { label: "Termin", complete: true },
              { label: "Dane", complete: true },
              { label: isPaid ? "Gotowe" : "Płatność", complete: isPaid },
            ].map((step, index) => (
              <div key={step.label} className={`flex items-center justify-center gap-2 ${index < 2 ? "text-emerald-700" : isPaid ? "text-emerald-700" : "font-semibold text-[#ff5a1f]"}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${step.complete ? "bg-emerald-100" : "bg-[#ff5a1f] text-white"}`}>
                  {step.complete ? <Check className="h-4 w-4" /> : "3"}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-7 text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isPaid ? "bg-emerald-100" : isClosed ? "bg-red-100" : "bg-[#fff1eb]"}`}>
            {isPaid
              ? <CheckCircle2 className="h-8 w-8 text-emerald-700" />
              : <CircleAlert className={`h-8 w-8 ${isClosed ? "text-red-700" : "text-[#ff5a1f]"}`} />}
          </div>
          <Badge variant={isPaid ? "default" : isClosed ? "destructive" : "secondary"}>Rezerwacja #{order.orderNumber}</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {isPaid ? "Rezerwacja potwierdzona!" : isClosed ? "Ta rezerwacja wygasła" : "Ostatni krok — płatność"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {isPaid
              ? "Bilety są gotowe. Otwórz kod QR przy wejściu lub wróć do nich z wiadomości e-mail."
              : isClosed
                ? "Wybierz termin ponownie, aby utworzyć nową rezerwację."
                : "Twoje miejsca są tymczasowo zablokowane. Dokończ płatność przed końcem odliczania."}
          </p>
        </div>

        {returnedFromStripe && isAwaitingPayment && isTicketingPaymentsEnabled && (
          <div className="mb-6"><PaymentStatusWatcher orderId={order.id} /></div>
        )}

        {query.platnosc === "anulowana" && isAwaitingPayment && (
          <Alert className="mb-6 rounded-2xl">
            <AlertDescription>Płatność nie została zakończona. Miejsca nadal są zablokowane — możesz spróbować ponownie.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="rounded-3xl border-0 bg-white shadow-sm ring-1 ring-black/5">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1eb] text-[#ff5a1f]"><Ticket className="h-5 w-5" /></span>
                  <div>
                    <p className="text-lg font-bold">{firstItem?.productName}</p>
                    {firstItem && <p className="mt-1 text-sm text-muted-foreground">{formatSessionDate(firstItem.startsAt, order.venueTimezone)}</p>}
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{order.venueName}</p>
                  </div>
                </div>

                <Separator />
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 text-sm">
                      <span>{item.quantity} × {item.ticketTypeName}</span>
                      <span className="font-semibold">{formatMoney(item.totalPriceAmount, order.currency)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-end justify-between">
                  <span className="text-muted-foreground">Razem</span>
                  <span className="text-2xl font-black">{formatMoney(order.totalAmount, order.currency)}</span>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />Potwierdzenie wyślemy na {order.customerEmail}.
                </div>
              </CardContent>
            </Card>

            {isPaid && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">Twoje bilety ({order.tickets.length})</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Każdy bilet ma osobny kod wejścia.</p>
                </div>

                {order.tickets.length === 0 ? (
                  <Alert className="rounded-2xl"><AlertDescription>Płatność jest potwierdzona, a bilety są jeszcze generowane.</AlertDescription></Alert>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {order.tickets.map((ticket) => (
                      <Card key={ticket.id} className="overflow-hidden rounded-3xl border-emerald-200 bg-white">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{ticket.ticketTypeName}</p>
                              <p className="text-xs text-muted-foreground">Bilet #{ticket.sequenceNumber}</p>
                            </div>
                            <Badge variant={ticket.status === "void" ? "destructive" : "outline"} className={ticket.status === "valid" ? "border-emerald-300 text-emerald-800" : ""}>
                              {ticket.status === "valid" ? "Ważny" : ticket.status === "used" ? "Wykorzystany" : "Unieważniony"}
                            </Badge>
                          </div>
                          <Link href={`/bilet/${ticket.ticketCode}`} className="mx-auto block w-fit rounded-2xl border bg-white p-2">
                            <Image src={`/api/ticketing/tickets/${ticket.ticketCode}/qr`} alt={`Kod QR: ${ticket.ticketTypeName}`} width={184} height={184} unoptimized />
                          </Link>
                          <Link href={`/bilet/${ticket.ticketCode}`} className="block text-center text-sm font-semibold text-[#ff5a1f] hover:underline">Otwórz pełny bilet</Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="order-first md:order-last">
            <Card className="rounded-3xl border-0 bg-white shadow-lg ring-1 ring-black/5 md:sticky md:top-6">
              <CardContent className="space-y-5 p-5">
                {isPaid ? (
                  <div className="space-y-3 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100"><ShieldCheck className="h-6 w-6 text-emerald-700" /></div>
                    <p className="font-semibold">Zapłacono i potwierdzono</p>
                    <p className="text-xs text-muted-foreground">Miejsca są zapisane w systemie obiektu.</p>
                  </div>
                ) : isAwaitingPayment ? (
                  <>
                    {isTicketingPaymentsEnabled && <PaymentButton orderId={order.id} />}
                    <HoldCountdown
                      orderId={order.id}
                      expiresAt={order.holdExpiresAt}
                      initialStatus={order.holdStatus}
                      initialNow={Date.now()}
                      canRelease={order.paymentStatus !== "pending"}
                    />
                    {!isTicketingPaymentsEnabled && <p className="text-center text-xs text-muted-foreground">Płatność online jest wyłączona flagą środowiskową.</p>}
                  </>
                ) : (
                  <div className="space-y-4 text-center">
                    <CircleAlert className="mx-auto h-9 w-9 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Ta blokada nie jest już aktywna.</p>
                    <Link href="/attractions" className="text-sm font-semibold text-[#ff5a1f] hover:underline">Wybierz termin ponownie</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
