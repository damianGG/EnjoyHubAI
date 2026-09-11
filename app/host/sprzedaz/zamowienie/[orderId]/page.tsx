import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, Mail, Phone, ScanLine, Ticket, UserRound, XCircle } from "lucide-react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

interface LifecycleOrder {
  id: string
  orderNumber: number
  status: string
  paymentStatus: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  currency: string
  subtotalAmount: number | string
  discountAmount: number | string
  totalAmount: number | string
  createdAt: string
  expiresAt: string | null
  confirmedAt: string | null
  cancelledAt: string | null
  source: string
  venue: { id: string; name: string; city: string | null; timezone: string }
}

interface LifecycleItem {
  id: string
  productName: string
  ticketTypeName: string
  quantity: number
  unitPriceAmount: number | string
  totalPriceAmount: number | string
  startsAt: string
  endsAt: string
}

interface LifecycleTicket {
  id: string
  ticketCode: string
  sequenceNumber: number
  status: "valid" | "used" | "void"
  issuedAt: string
  usedAt: string | null
  usedBy: { id: string; name: string } | null
  productName: string
  ticketTypeName: string
}

interface LifecyclePaymentAttempt {
  id: string
  provider: string
  status: string
  failureCode: string | null
  createdAt: string
  updatedAt: string
}

interface OrderLifecycle {
  order: LifecycleOrder
  items: LifecycleItem[]
  tickets: LifecycleTicket[]
  paymentAttempts: LifecyclePaymentAttempt[]
}

export default async function OrganizerOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  if (!isSupabaseConfigured) redirect("/host/sprzedaz")

  const { orderId } = await params
  if (!z.string().uuid().safeParse(orderId).success) notFound()

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/host/sprzedaz/zamowienie/${orderId}`)

  const { data, error } = await supabase.rpc("ticketing_get_organizer_order_lifecycle", {
    p_order_id: orderId,
  })

  if (error) {
    if (error.code === "P0002") notFound()
    if (error.code === "42501") redirect("/host/sprzedaz")
    return <CenteredMessage>Nie udało się pobrać szczegółów zamówienia.</CenteredMessage>
  }

  const lifecycle = data as unknown as OrderLifecycle | null
  if (!lifecycle?.order) notFound()

  const order = lifecycle.order
  const validTickets = lifecycle.tickets.filter((ticket) => ticket.status === "valid").length
  const usedTickets = lifecycle.tickets.filter((ticket) => ticket.status === "used").length
  const voidTickets = lifecycle.tickets.filter((ticket) => ticket.status === "void").length
  const requiresReview = lifecycle.paymentAttempts.some((attempt) => attempt.status === "requires_review")

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/host/sprzedaz" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Sprzedaż biletów
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Zamówienie #{order.orderNumber}</Badge>
              <OrderStatusBadge status={order.status} paymentStatus={order.paymentStatus} requiresReview={requiresReview} />
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{lifecycle.items[0]?.productName ?? order.venue.name}</h1>
            <p className="mt-2 text-muted-foreground">{order.venue.name}{order.venue.city ? ` · ${order.venue.city}` : ""}</p>
          </div>
          <Button asChild>
            <Link href="/host/skaner"><ScanLine className="h-4 w-4" /> Kontrola wejścia</Link>
          </Button>
        </div>

        <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Wartość" value={formatMoney(Number(order.totalAmount), order.currency)} icon={CircleDollarSign} />
          <Metric label="Bilety ważne" value={String(validTickets)} icon={Ticket} />
          <Metric label="Wykorzystane" value={String(usedTickets)} icon={CheckCircle2} />
          <Metric label="Unieważnione" value={String(voidTickets)} icon={XCircle} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bilety i wejścia</CardTitle>
                <CardDescription>Stan każdego biletu po wystawieniu i kontroli przy wejściu.</CardDescription>
              </CardHeader>
              <CardContent>
                {lifecycle.tickets.length === 0 ? (
                  <EmptyState>Po potwierdzeniu płatności wystawione bilety pojawią się tutaj.</EmptyState>
                ) : (
                  <div className="divide-y">
                    {lifecycle.tickets.map((ticket) => (
                      <div key={ticket.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">Bilet #{ticket.sequenceNumber} · {ticket.ticketTypeName}</p>
                            <TicketStatusBadge status={ticket.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Wystawiony {formatDateTime(ticket.issuedAt, order.venue.timezone)}</p>
                          {ticket.usedAt && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              Wejście {formatDateTime(ticket.usedAt, order.venue.timezone)}{ticket.usedBy?.name ? ` · ${ticket.usedBy.name}` : ""}
                            </p>
                          )}
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/bilet/${ticket.ticketCode}`} target="_blank">Otwórz bilet</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Pozycje zamówienia</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {lifecycle.items.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.productName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.ticketTypeName} · {item.quantity} szt.</p>
                        <p className="mt-2 flex items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-primary" /> {formatSessionDate(item.startsAt, order.venue.timezone)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(Number(item.totalPriceAmount), order.currency)}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(Number(item.unitPriceAmount), order.currency)} / szt.</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Razem</span>
                  <span>{formatMoney(Number(order.totalAmount), order.currency)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Płatność</CardTitle>
                <CardDescription>Historia prób płatności powiązanych z tym zamówieniem.</CardDescription>
              </CardHeader>
              <CardContent>
                {lifecycle.paymentAttempts.length === 0 ? (
                  <EmptyState>Nie rozpoczęto jeszcze płatności online.</EmptyState>
                ) : (
                  <div className="divide-y">
                    {lifecycle.paymentAttempts.map((attempt) => (
                      <div key={attempt.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="font-medium">{attempt.provider}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(attempt.createdAt, order.venue.timezone)}</p>
                          {attempt.failureCode && <p className="mt-1 text-xs text-red-700">{attempt.failureCode}</p>}
                        </div>
                        <Badge variant={attempt.status === "paid" ? "default" : attempt.status === "requires_review" ? "destructive" : "outline"}>
                          {paymentAttemptLabel(attempt.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Kupujący</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoLine icon={UserRound}>{order.customerName}</InfoLine>
                <InfoLine icon={Mail}>{order.customerEmail}</InfoLine>
                {order.customerPhone && <InfoLine icon={Phone}>{order.customerPhone}</InfoLine>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Oś zamówienia</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <TimelineItem label="Utworzone" value={formatDateTime(order.createdAt, order.venue.timezone)} done />
                <TimelineItem label="Płatność" value={paymentLabel(order.paymentStatus)} done={order.paymentStatus === "paid"} />
                <TimelineItem label="Potwierdzone" value={order.confirmedAt ? formatDateTime(order.confirmedAt, order.venue.timezone) : "Jeszcze nie"} done={Boolean(order.confirmedAt)} />
                <TimelineItem label="Wejście" value={usedTickets > 0 ? `${usedTickets}/${lifecycle.tickets.length} biletów wykorzystanych` : "Brak wykorzystanych biletów"} done={usedTickets > 0} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Ticket }) {
  return <Card><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>
}

function InfoLine({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="break-all">{children}</span></div>
}

function TimelineItem({ label, value, done }: { label: string; value: string; done: boolean }) {
  return <div className="flex gap-3"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${done ? "bg-emerald-500" : "bg-muted-foreground/30"}`} /><div><p className="font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{value}</p></div></div>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{children}</div>
}

function TicketStatusBadge({ status }: { status: LifecycleTicket["status"] }) {
  if (status === "valid") return <Badge className="bg-emerald-600">Ważny</Badge>
  if (status === "used") return <Badge variant="secondary">Wykorzystany</Badge>
  return <Badge variant="destructive">Unieważniony</Badge>
}

function OrderStatusBadge({ status, paymentStatus, requiresReview }: { status: string; paymentStatus: string; requiresReview: boolean }) {
  if (requiresReview) return <Badge variant="destructive">Wymaga sprawdzenia</Badge>
  if (status === "confirmed" && paymentStatus === "paid") return <Badge className="bg-emerald-600">Opłacone i potwierdzone</Badge>
  if (status === "awaiting_payment") return <Badge variant="secondary">Oczekuje na płatność</Badge>
  if (status === "expired") return <Badge variant="outline">Wygasło</Badge>
  return <Badge variant="destructive">{status === "cancelled" ? "Anulowane" : status}</Badge>
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = { unpaid: "Nieopłacone", pending: "W toku", paid: "Opłacone", failed: "Nieudana", refunded: "Zwrócona", partially_refunded: "Częściowy zwrot", not_required: "Niewymagana" }
  return labels[status] ?? status
}

function paymentAttemptLabel(status: string) {
  const labels: Record<string, string> = { creating: "Tworzenie", open: "Otwarta", paid: "Opłacona", failed: "Nieudana", expired: "Wygasła", requires_review: "Do sprawdzenia" }
  return labels[status] ?? status
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main>
}
