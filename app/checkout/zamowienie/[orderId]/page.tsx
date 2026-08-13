import { cookies } from "next/headers"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Mail, MapPin, Ticket } from "lucide-react"
import { notFound } from "next/navigation"

import { HoldCountdown } from "@/components/ticketing/hold-countdown"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { checkoutCookieName, isTicketingCheckoutEnabled } from "@/lib/ticketing/config"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"
import { getCheckoutOrderSummary } from "@/lib/ticketing/queries"
import { checkoutCookieMatches, parseCheckoutCookie } from "@/lib/ticketing/security"

export const dynamic = "force-dynamic"

export default async function CheckoutOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  if (!isTicketingCheckoutEnabled) notFound()
  const { orderId } = await params
  const cookieStore = await cookies()
  const checkoutCookie = parseCheckoutCookie(cookieStore.get(checkoutCookieName)?.value)
  if (!checkoutCookieMatches(checkoutCookie, orderId)) notFound()

  const order = await getCheckoutOrderSummary(orderId, checkoutCookie!.holdToken)
  if (!order) notFound()
  const firstItem = order.items[0]

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background">
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-14">
        <Link href="/checkout" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Powrót do terminów
        </Link>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-700" />
          </div>
          <Badge variant="secondary">Zamówienie #{order.orderNumber}</Badge>
          <h1 className="mt-3 text-3xl font-bold">Miejsca zostały zablokowane</h1>
          <p className="mt-2 text-muted-foreground">Sprawdź szczegóły testowego zamówienia.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
          <Card className="surface-3d">
            <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" />Twoje bilety</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-lg font-semibold">{firstItem?.productName}</p>
                {firstItem && <p className="mt-1 text-sm text-muted-foreground">{formatSessionDate(firstItem.startsAt, order.venueTimezone)}</p>}
              </div>
              <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" />{order.venueName}</div>
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
                Po podłączeniu płatności potwierdzenie i bilety wyślemy na {order.customerEmail}.
              </div>
            </CardContent>
          </Card>

          <aside>
            <Card className="surface-3d">
              <CardContent className="space-y-4 p-5">
                <HoldCountdown
                  orderId={order.id}
                  expiresAt={order.holdExpiresAt}
                  initialStatus={order.holdStatus}
                  initialNow={Date.now()}
                />
                <p className="text-center text-xs text-muted-foreground">
                  Płatność online zostanie podłączona w następnym etapie.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
