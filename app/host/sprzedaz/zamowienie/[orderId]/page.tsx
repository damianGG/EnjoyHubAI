import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  ArrowRightLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Mail,
  Phone,
  ScanLine,
  Ticket,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { z } from "zod"

import {
  markOrderPaidOnSite,
  rescheduleOrganizerBooking,
} from "@/app/host/sprzedaz/zamowienie/[orderId]/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { OrganizerRefundCard } from "@/components/ticketing/organizer-refund-card"
import {
  organizerManagementRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

interface LifecycleOrder {
  id: string
  orderNumber: number
  organizationId: string
  status: string
  paymentStatus: string
  paymentMethod: "online" | "on_site" | null
  bookingSource: "marketplace" | "widget" | "manual" | "walk_in" | "phone" | "integration"
  customerName: string
  customerEmail: string | null
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
  productId: string
  sessionId: string
  productName: string
  ticketTypeName: string
  quantity: number
  capacityUnitsEach: number
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

interface LifecycleReschedule {
  id: string
  fromSessionId: string
  toSessionId: string
  reason: string | null
  createdAt: string
}

interface OrderLifecycle {
  order: LifecycleOrder
  items: LifecycleItem[]
  tickets: LifecycleTicket[]
  paymentAttempts: LifecyclePaymentAttempt[]
  reschedules: LifecycleReschedule[]
}

interface CalendarRow {
  session_id: string
  product_id: string
  product_name: string
  venue_name: string
  venue_timezone: string
  starts_at: string
  ends_at: string
  available_capacity_units: number
  session_status: string
}

export default async function OrganizerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ status?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host/sprzedaz")

  const [{ orderId }, feedback] = await Promise.all([params, searchParams])
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
  const firstItem = lifecycle.items[0]
  const requiredCapacity = lifecycle.items.reduce(
    (sum, item) => sum + item.quantity * item.capacityUnitsEach,
    0,
  )

  const { data: membershipData } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", order.organizationId)
    .eq("user_id", user.id)
    .maybeSingle()

  const role = (membershipData?.role ?? null) as OrganizerRole | null
  const canManage = Boolean(role && organizerManagementRoles.includes(role as (typeof organizerManagementRoles)[number]))

  let alternativeSessions: CalendarRow[] = []
  if (canManage && firstItem && order.status === "confirmed" && usedTickets === 0) {
    const now = new Date()
    const { data: calendarData } = await supabase.rpc("ticketing_get_organizer_calendar", {
      p_from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      p_to: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    })

    alternativeSessions = ((calendarData ?? []) as CalendarRow[])
      .filter((session) =>
        session.product_id === firstItem.productId
        && session.session_id !== firstItem.sessionId
        && session.session_status === "scheduled"
        && session.available_capacity_units >= requiredCapacity
        && new Date(session.ends_at) > now
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/host/sprzedaz" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Sprzedaż i rezerwacje
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/host/kalendarz"><CalendarClock className="h-4 w-4" /> Kalendarz</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {feedback.status && <SuccessNotice status={feedback.status} />}
        {feedback.blad && <OperationError code={feedback.blad} />}

        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Rezerwacja #{order.orderNumber}</Badge>
              <OrderStatusBadge status={order.status} paymentStatus={order.paymentStatus} requiresReview={requiresReview} />
              <Badge variant="outline">{bookingSourceLabel(order.bookingSource)}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{firstItem?.productName ?? order.venue.name}</h1>
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
                  <EmptyState>Po potwierdzeniu rezerwacji bilety pojawią się tutaj.</EmptyState>
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
              <CardHeader><CardTitle>Pozycje rezerwacji</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {lifecycle.items.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.productName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.ticketTypeName} · {item.quantity} szt.</p>
                        <p className="mt-2 flex items-center gap-2 text-sm">
                          <CalendarClock className="h-4 w-4 text-primary" /> {formatSessionDate(item.startsAt, order.venue.timezone)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(Number(item.totalPriceAmount), order.currency)}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(Number(item.unitPriceAmount), order.currency)} / szt.</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Separator />
                {Number(order.discountAmount) > 0 && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Wartość przed rabatem</span>
                      <span>{formatMoney(Number(order.subtotalAmount), order.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold text-emerald-700">
                      <span>Rabat / voucher</span>
                      <span>−{formatMoney(Number(order.discountAmount), order.currency)}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Razem</span>
                  <span>{formatMoney(Number(order.totalAmount), order.currency)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Płatność</CardTitle>
                <CardDescription>
                  {order.paymentMethod === "on_site"
                    ? "Płatność rozliczana na miejscu przez organizatora."
                    : "Historia płatności online powiązanych z rezerwacją."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{paymentMethodLabel(order.paymentMethod)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Status: {paymentLabel(order.paymentStatus)}</p>
                  </div>
                  <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"}>{paymentLabel(order.paymentStatus)}</Badge>
                </div>

                {canManage && order.paymentMethod === "on_site" && order.paymentStatus === "unpaid" && order.status === "confirmed" && (
                  <form action={markOrderPaidOnSite}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <Button type="submit" className="w-full">
                      <Banknote className="h-4 w-4" /> Oznacz płatność na miejscu jako opłaconą
                    </Button>
                  </form>
                )}

                {lifecycle.paymentAttempts.length > 0 && (
                  <div className="divide-y rounded-xl border px-4">
                    {lifecycle.paymentAttempts.map((attempt) => (
                      <div key={attempt.id} className="flex items-center justify-between gap-4 py-3">
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

            {Number(order.totalAmount) > 0 && (order.paymentMethod === "online" || lifecycle.paymentAttempts.length > 0) && (
              <OrganizerRefundCard
                orderId={order.id}
                paymentStatus={order.paymentStatus}
                orderTotal={Number(order.totalAmount)}
                currency={order.currency}
                timezone={order.venue.timezone}
                feedback={feedback}
              />
            )}
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Klient</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoLine icon={UserRound}>{order.customerName}</InfoLine>
                {order.customerEmail && <InfoLine icon={Mail}>{order.customerEmail}</InfoLine>}
                {order.customerPhone && <InfoLine icon={Phone}>{order.customerPhone}</InfoLine>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-4 w-4" /> Rezerwacja</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <KeyValue label="Źródło" value={bookingSourceLabel(order.bookingSource)} />
                <KeyValue label="Płatność" value={paymentMethodLabel(order.paymentMethod)} />
                <KeyValue label="Status" value={paymentLabel(order.paymentStatus)} />
                <KeyValue label="Zmiany terminu" value={String(lifecycle.reschedules.length)} />
              </CardContent>
            </Card>

            {canManage && firstItem && order.status === "confirmed" && usedTickets === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><ArrowRightLeft className="h-4 w-4" /> Zmień termin</CardTitle>
                  <CardDescription>Przeniesienie automatycznie zwalnia stare miejsca i zajmuje nowe.</CardDescription>
                </CardHeader>
                <CardContent>
                  {alternativeSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Brak innych terminów z wystarczającą liczbą wolnych miejsc w ciągu 180 dni.</p>
                  ) : (
                    <form action={rescheduleOrganizerBooking} className="space-y-4">
                      <input type="hidden" name="orderId" value={order.id} />
                      <div className="space-y-2">
                        <Label htmlFor="targetSessionId">Nowy termin</Label>
                        <select id="targetSessionId" name="targetSessionId" required className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                          {alternativeSessions.slice(0, 100).map((session) => (
                            <option key={session.session_id} value={session.session_id}>
                              {formatSessionOption(session.starts_at, session.venue_timezone)} · {session.available_capacity_units} wolnych
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rescheduleReason">Powód / notatka</Label>
                        <Input id="rescheduleReason" name="reason" maxLength={500} placeholder="opcjonalnie" />
                      </div>
                      <Button type="submit" variant="outline" className="w-full">
                        <ArrowRightLeft className="h-4 w-4" /> Przenieś rezerwację
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-lg">Oś rezerwacji</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <TimelineItem label="Utworzona" value={formatDateTime(order.createdAt, order.venue.timezone)} done />
                <TimelineItem label="Płatność" value={paymentLabel(order.paymentStatus)} done={["paid", "partially_refunded", "refunded"].includes(order.paymentStatus)} />
                <TimelineItem label="Potwierdzona" value={order.confirmedAt ? formatDateTime(order.confirmedAt, order.venue.timezone) : "Jeszcze nie"} done={Boolean(order.confirmedAt)} />
                <TimelineItem label="Wejście" value={usedTickets > 0 ? `${usedTickets}/${lifecycle.tickets.length} biletów wykorzystanych` : "Brak wykorzystanych biletów"} done={usedTickets > 0} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}

function SuccessNotice({ status }: { status: string }) {
  const text = status === "utworzona"
    ? "Rezerwacja została utworzona i miejsca są już odjęte z dostępności."
    : status === "przeniesiona"
      ? "Termin rezerwacji został zmieniony, a dostępność obu terminów przeliczona."
      : status === "oplacona"
        ? "Płatność na miejscu została oznaczona jako opłacona."
        : status === "zwrot"
          ? "Zwrot został przekazany do obsługi."
          : "Zmiana została zapisana."

  return <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{text}</div>
}

function OperationError({ code }: { code: string }) {
  if (["dane-zwrotu", "stripe", "provider", "zwrot"].includes(code)) return null
  const text = code === "miejsca"
    ? "Wybrany nowy termin nie ma już wystarczającej liczby wolnych miejsc."
    : code === "uprawnienia"
      ? "Nie masz uprawnień do wykonania tej operacji."
      : code === "platnosc"
        ? "Nie udało się zmienić statusu płatności."
        : "Nie udało się zmienić terminu rezerwacji."
  return <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">{text}</div>
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return <Card><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>
}

function InfoLine({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="break-all">{children}</span></div>
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>
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
  if (paymentStatus === "refunded" || status === "refunded") return <Badge variant="outline">Zwrócono w całości</Badge>
  if (paymentStatus === "partially_refunded" || status === "partially_refunded") return <Badge variant="secondary">Częściowy zwrot</Badge>
  if (status === "confirmed" && paymentStatus === "paid") return <Badge className="bg-emerald-600">Opłacona i potwierdzona</Badge>
  if (status === "confirmed" && paymentStatus === "unpaid") return <Badge variant="secondary">Potwierdzona · nieopłacona</Badge>
  if (status === "confirmed" && paymentStatus === "not_required") return <Badge className="bg-emerald-600">Potwierdzona · bez płatności</Badge>
  if (status === "awaiting_payment") return <Badge variant="secondary">Oczekuje na płatność</Badge>
  if (status === "expired") return <Badge variant="outline">Wygasła</Badge>
  return <Badge variant="destructive">{status === "cancelled" ? "Anulowana" : status}</Badge>
}

function bookingSourceLabel(source: LifecycleOrder["bookingSource"]) {
  const labels: Record<LifecycleOrder["bookingSource"], string> = {
    marketplace: "EnjoyHub",
    widget: "Widget",
    manual: "Ręczna",
    walk_in: "Walk-in",
    phone: "Telefon",
    integration: "Integracja",
  }
  return labels[source]
}

function paymentMethodLabel(method: LifecycleOrder["paymentMethod"]) {
  if (method === "online") return "Online"
  if (method === "on_site") return "Na miejscu"
  return "Nie wybrano"
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = { unpaid: "Nieopłacona", pending: "W toku", paid: "Opłacona", failed: "Nieudana", refunded: "Zwrócona", partially_refunded: "Częściowy zwrot", not_required: "Niewymagana" }
  return labels[status] ?? status
}

function paymentAttemptLabel(status: string) {
  const labels: Record<string, string> = { creating: "Tworzenie", open: "Otwarta", paid: "Opłacona", failed: "Nieudana", expired: "Wygasła", requires_review: "Do sprawdzenia" }
  return labels[status] ?? status
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function formatSessionOption(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main>
}
