import Link from "next/link"
import { ArrowLeft, CalendarDays, MapPin, ShoppingBag, Ticket } from "lucide-react"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"
import { listCustomerTicketingOrders } from "@/lib/ticketing/queries"
import type { CustomerTicketingOrder } from "@/lib/ticketing/types"

export const dynamic = "force-dynamic"

export default async function CustomerOrdersPage() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby wyświetlić bilety.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/dashboard/bookings")

  const orders = await listCustomerTicketingOrders(user.id)

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Powrót do panelu
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Ticket className="h-8 w-8" /> Moje bilety i zamówienia
          </h1>
          <p className="mt-2 text-muted-foreground">
            {orders.length === 0 ? "Nie masz jeszcze zamówień." : `Zamówienia łącznie: ${orders.length}`}
          </p>
        </div>

        {orders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ShoppingBag className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Brak zakupionych biletów</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Wybierz atrakcję i termin. Po potwierdzeniu płatności bilety QR pojawią się tutaj.
              </p>
              <Button asChild className="mt-6"><Link href="/">Przeglądaj atrakcje</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => <CustomerOrderCard key={order.id} order={order} />)}
          </div>
        )}
      </div>
    </main>
  )
}

function CustomerOrderCard({ order }: { order: CustomerTicketingOrder }) {
  const firstItem = order.items[0]
  const isPaid = order.paymentStatus === "paid"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle className="text-lg">Zamówienie #{order.orderNumber}</CardTitle>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {[order.venueName, order.venueCity].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isPaid ? "default" : order.status === "cancelled" || order.status === "expired" ? "destructive" : "secondary"}>
              {paymentLabel(order.paymentStatus)}
            </Badge>
            <Badge variant="outline">{orderLabel(order.status)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {firstItem && (
          <p className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatSessionDate(firstItem.startsAt, order.venueTimezone)}
          </p>
        )}

        <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4">
              <span>{item.productName} · {item.ticketTypeName}</span>
              <span className="font-medium">× {item.quantity}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Razem</span>
            <span>{formatMoney(order.totalAmount, order.currency)}</span>
          </div>
        </div>

        {order.tickets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {order.tickets.map((ticket) => (
              <Button key={ticket.id} asChild variant="outline" size="sm">
                <Link href={`/bilet/${ticket.ticketCode}`}>
                  <Ticket className="h-4 w-4" /> Bilet #{ticket.sequenceNumber}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = {
    unpaid: "Nieopłacone",
    pending: "Płatność w toku",
    paid: "Opłacone",
    failed: "Płatność nieudana",
    refunded: "Zwrócone",
    partially_refunded: "Częściowo zwrócone",
    not_required: "Bez płatności",
  }
  return labels[status] ?? status
}

function orderLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "W przygotowaniu",
    awaiting_payment: "Oczekuje na płatność",
    confirmed: "Potwierdzone",
    cancelled: "Anulowane",
    expired: "Wygasło",
    refunded: "Zwrócone",
    partially_refunded: "Częściowo zwrócone",
  }
  return labels[status] ?? status
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4 text-muted-foreground">{children}</main>
}
