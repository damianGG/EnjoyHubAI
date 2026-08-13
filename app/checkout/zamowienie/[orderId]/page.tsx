import { cookies } from "next/headers"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Mail,
  MapPin,
  ShieldCheck,
  Ticket,
} from "lucide-react"
import { notFound } from "next/navigation"

import { HoldCountdown } from "@/components/ticketing/hold-countdown"
import { PaymentButton } from "@/components/ticketing/payment-button"
import { PaymentStatusWatcher } from "@/components/ticketing/payment-status-watcher"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  checkoutCookieName,
  isTicketingCheckoutEnabled,
  isTicketingPaymentsEnabled,
} from "@/lib/ticketing/config"
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
    <main className={`min-h-screen bg-gradient-to-b ${isPaid ? "from-emerald-50" : "from-primary/5"} via-background to-background`}>
      <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-14">
        <Link href="/checkout" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Powrót do terminów
        </Link>

        <div className="mb-8 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isPaid ? "bg-emerald-100" : isClosed ? "bg-red-100" : "bg-amber-100"}`}>
            {isPaid
              ? <CheckCircle2 className="h-7 w-7 text-emerald-700" />
              : <CircleAlert className={`h-7 w-7 ${isClosed ? "text-red-700" : "text-amber-700"}`} />}
          </div>
          <Badge variant={isPaid ? "default" : isClosed ? "destructive" : "secondary"}>
            Zamówienie #{order.orderNumber}
          </Badge>
          <h1 className="mt-3 text-3xl font-bold">
            {isPaid
              ? "Płatność potwierdzona — bilety są gotowe"
              : isClosed
                ? "To zamówienie zostało zamknięte"
                : "Miejsca zostały zablokowane"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isPaid
              ? "Zapisz bilety lub otwórz je przed wejściem do obiektu."
              : isClosed
                ? "Wybierz termin ponownie, aby utworzyć nowe zamówienie."
                : "Dokończ płatność przed upływem czasu blokady."}
          </p>
        </div>

        {returnedFromStripe && isAwaitingPayment && isTicketingPaymentsEnabled && (
          <div className="mb-6">
            <PaymentStatusWatcher orderId={order.id} />
          </div>
        )}

        {query.platnosc === "anulowana" && isAwaitingPayment && (
          <Alert className="mb-6">
            <AlertDescription>
              Płatność nie została zakończona. Miejsca nadal są zablokowane — możesz wrócić do tej samej bezpiecznej sesji płatności.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr_19rem]">
          <div className="space-y-6">
            <Card className="surface-3d">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-primary" />Twoje zamówienie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-lg font-semibold">{firstItem?.productName}</p>
                  {firstItem && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSessionDate(firstItem.startsAt, order.venueTimezone)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />{order.venueName}
                </div>
                <Separator />
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 text-sm">
                      <span>{item.quantity} × {item.ticketTypeName}</span>
                      <span className="font-medium">{formatMoney(item.totalPriceAmount, order.currency)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-end justify-between">
                  <span className="text-muted-foreground">Razem</span>
                  <span className="text-2xl font-bold">{formatMoney(order.totalAmount, order.currency)}</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  Zamówienie zostało przypisane do adresu {order.customerEmail}.
                </div>
              </CardContent>
            </Card>

            {isPaid && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">Bilety ({order.tickets.length})</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Każdy kupiony bilet ma oddzielny kod wejścia.</p>
                </div>

                {order.tickets.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Płatność jest potwierdzona, a bilety są jeszcze generowane. Odśwież stronę za chwilę.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {order.tickets.map((ticket) => (
                      <Card key={ticket.id} className="overflow-hidden border-emerald-200">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{ticket.ticketTypeName}</p>
                              <p className="text-xs text-muted-foreground">Bilet #{ticket.sequenceNumber}</p>
                            </div>
                            <Badge
                              variant={ticket.status === "void" ? "destructive" : "outline"}
                              className={ticket.status === "valid" ? "border-emerald-300 text-emerald-800" : ""}
                            >
                              {ticket.status === "valid" ? "Ważny" : ticket.status === "used" ? "Wykorzystany" : "Unieważniony"}
                            </Badge>
                          </div>
                          <Link
                            href={`/bilet/${ticket.ticketCode}`}
                            className="mx-auto block w-fit rounded-xl border bg-white p-2"
                          >
                            <Image
                              src={`/api/ticketing/tickets/${ticket.ticketCode}/qr`}
                              alt={`Kod QR: ${ticket.ticketTypeName}`}
                              width={184}
                              height={184}
                              unoptimized
                            />
                          </Link>
                          <Link
                            href={`/bilet/${ticket.ticketCode}`}
                            className="block text-center text-sm font-medium text-primary hover:underline"
                          >
                            Otwórz pełny bilet
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <aside>
            <Card className="surface-3d md:sticky md:top-8">
              <CardContent className="space-y-5 p-5">
                {isPaid ? (
                  <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
                      <ShieldCheck className="h-6 w-6 text-emerald-700" />
                    </div>
                    <div>
                      <p className="font-semibold">Zapłacono bezpiecznie</p>
                      <p className="mt-1 text-xs text-muted-foreground">Miejsca są potwierdzone w systemie obiektu.</p>
                    </div>
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
                    {!isTicketingPaymentsEnabled && (
                      <p className="text-center text-xs text-muted-foreground">
                        Płatność online jest wyłączona flagą środowiskową.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4 text-center">
                    <CircleAlert className="mx-auto h-9 w-9 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Ta blokada nie jest już aktywna.</p>
                    <Link href="/checkout" className="text-sm font-medium text-primary hover:underline">
                      Wybierz bilety ponownie
                    </Link>
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
