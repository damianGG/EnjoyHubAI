import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ArrowRight, Banknote, Clock3, ReceiptText, ScanLine, Settings2, TicketCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  organizerManagementRoles,
  organizerSalesRoles,
  organizerScannerRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server"
import { isTicketingPaymentsEnabled } from "@/lib/ticketing/config"
import { formatMoney, formatSessionDate } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

interface HostOrder {
  id: string
  order_number: number
  status: string
  payment_status: string
  customer_name: string
  customer_email: string
  total_amount: number | string
  currency: string
  created_at: string
  venues: { name: string; timezone: string }
  order_items: Array<{
    product_name: string
    quantity: number
    sessions: { starts_at: string }
  }>
  payment_attempts: Array<{
    status: string
    failure_code: string | null
  }>
}

interface HostMembership {
  organization_id: string
  role: OrganizerRole
}

interface HostTicket {
  id: string
  order_id: string
  status: string
}

export default async function HostTicketingSalesPage() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby zobaczyć sprzedaż.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/sprzedaz")

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) {
    return <CenteredMessage>Nie udało się pobrać organizacji użytkownika.</CenteredMessage>
  }

  const typedMemberships = (memberships ?? []) as HostMembership[]
  if (typedMemberships.length === 0) {
    return (
      <CenteredMessage>
        <div className="space-y-4">
          <p>Nie masz jeszcze organizacji sprzedażowej. Kreator utworzy ją automatycznie i przypisze Ci rolę właściciela.</p>
          <Button asChild>
            <Link href="/host/sprzedaz/konfiguracja"><Settings2 className="h-4 w-4" /> Uruchom pierwszą sprzedaż</Link>
          </Button>
        </div>
      </CenteredMessage>
    )
  }

  const salesMemberships = typedMemberships.filter((membership) => organizerSalesRoles.includes(membership.role as (typeof organizerSalesRoles)[number]))
  if (salesMemberships.length === 0) {
    return (
      <CenteredMessage>
        <div className="space-y-4">
          <p>Obsługa wejścia nie ma dostępu do danych klientów ani wyników sprzedaży.</p>
          <Button asChild>
            <Link href="/host/skaner"><ScanLine className="h-4 w-4" /> Otwórz kontrolę wejścia</Link>
          </Button>
        </div>
      </CenteredMessage>
    )
  }

  const canManageSales = salesMemberships.some((membership) => organizerManagementRoles.includes(membership.role as (typeof organizerManagementRoles)[number]))
  const canScanTickets = typedMemberships.some((membership) => organizerScannerRoles.includes(membership.role as (typeof organizerScannerRoles)[number]))
  const organizationIds = [...new Set(salesMemberships.map((membership) => membership.organization_id))]

  if (!isTicketingPaymentsEnabled) {
    return (
      <CenteredMessage>
        <div className="space-y-4">
          <p>Panel zamówień czeka na aktywację płatności. Oferty i terminy mogą być przygotowane wcześniej.</p>
          {canManageSales && (
            <Button asChild>
              <Link href="/host/sprzedaz/konfiguracja"><Settings2 className="h-4 w-4" /> Otwórz konfigurator sprzedaży</Link>
            </Button>
          )}
        </div>
      </CenteredMessage>
    )
  }

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      payment_status,
      customer_name,
      customer_email,
      total_amount,
      currency,
      created_at,
      venues!inner (name, timezone),
      order_items (
        product_name,
        quantity,
        sessions!inner (starts_at)
      ),
      payment_attempts (
        status,
        failure_code
      )
    `)
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return <CenteredMessage>Nie udało się pobrać zamówień sprzedażowych.</CenteredMessage>
  }

  const orders = (data ?? []) as unknown as HostOrder[]
  const orderIds = orders.map((order) => order.id)
  const { data: ticketData } = orderIds.length
    ? await supabase.from("tickets").select("id, order_id, status").in("order_id", orderIds)
    : { data: [] as HostTicket[] }

  const tickets = (ticketData ?? []) as HostTicket[]
  const ticketsByOrder = new Map<string, HostTicket[]>()
  for (const ticket of tickets) {
    const current = ticketsByOrder.get(ticket.order_id) ?? []
    current.push(ticket)
    ticketsByOrder.set(ticket.order_id, current)
  }

  const confirmedOrders = orders.filter((order) => order.status === "confirmed" && order.payment_status === "paid")
  const confirmedRevenue = confirmedOrders.reduce((sum, order) => sum + Number(order.total_amount), 0)
  const pendingOrders = orders.filter((order) => order.status === "awaiting_payment").length
  const requiresReview = orders.filter((order) => order.payment_attempts.some((attempt) => attempt.status === "requires_review")).length
  const validTickets = tickets.filter((ticket) => ticket.status === "valid").length
  const usedTickets = tickets.filter((ticket) => ticket.status === "used").length

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Powrót do panelu
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">Panel sprzedaży</Badge>
            <h1 className="text-3xl font-bold">Sprzedaż biletów</h1>
            <p className="mt-2 text-muted-foreground">Od płatności po wejście gościa — każde zamówienie ma pełną historię biletu.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageSales && (
              <Button asChild variant="outline">
                <Link href="/host/sprzedaz/konfiguracja"><Settings2 className="h-4 w-4" /> Oferty i terminy</Link>
              </Button>
            )}
            {canScanTickets && (
              <Button asChild>
                <Link href="/host/skaner"><ScanLine className="h-4 w-4" /> Kontrola wejścia</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard icon={Banknote} label="Potwierdzony obrót" value={formatMoney(confirmedRevenue, "PLN")} />
          <MetricCard icon={ReceiptText} label="Opłacone" value={String(confirmedOrders.length)} />
          <MetricCard icon={Clock3} label="Oczekujące" value={String(pendingOrders)} />
          <MetricCard icon={Clock3} label="Do sprawdzenia" value={String(requiresReview)} />
          <MetricCard icon={TicketCheck} label="Ważne bilety" value={String(validTickets)} />
          <MetricCard icon={TicketCheck} label="Wykorzystane" value={String(usedTickets)} />
        </div>

        <Card>
          <CardHeader><CardTitle>Ostatnie zamówienia</CardTitle></CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Zamówienia pojawią się tutaj po pierwszym checkoutcie.
              </div>
            ) : (
              <div className="divide-y">
                {orders.map((order) => {
                  const firstItem = order.order_items[0]
                  const orderTickets = ticketsByOrder.get(order.id) ?? []
                  const usedCount = orderTickets.filter((ticket) => ticket.status === "used").length
                  return (
                    <div key={order.id} className="grid gap-3 py-5 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] lg:items-center">
                      <div className="font-mono text-sm font-semibold">#{order.order_number}</div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{firstItem?.product_name ?? order.venues.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{order.customer_name} · {order.customer_email}</p>
                        {firstItem && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatSessionDate(firstItem.sessions.starts_at, order.venues.timezone)}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {orderTickets.length > 0 ? `${usedCount}/${orderTickets.length} użytych` : "Brak biletów"}
                      </div>
                      <StatusBadge
                        status={order.status}
                        paymentStatus={order.payment_status}
                        requiresReview={order.payment_attempts.some((attempt) => attempt.status === "requires_review")}
                      />
                      <div className="flex items-center justify-between gap-3 lg:justify-end">
                        <span className="font-semibold">{formatMoney(Number(order.total_amount), order.currency)}</span>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/host/sprzedaz/zamowienie/${order.id}`}>Szczegóły <ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  )
}

function StatusBadge({ status, paymentStatus, requiresReview }: { status: string; paymentStatus: string; requiresReview: boolean }) {
  if (requiresReview) return <Badge variant="destructive" className="w-fit">Sprawdź ręcznie</Badge>
  if (status === "confirmed" && paymentStatus === "paid") return <Badge className="w-fit">Opłacone</Badge>
  if (status === "awaiting_payment") return <Badge variant="secondary" className="w-fit">Oczekuje</Badge>
  if (status === "expired") return <Badge variant="outline" className="w-fit">Wygasło</Badge>
  if (paymentStatus === "refunded") return <Badge variant="outline" className="w-fit">Zwrócone</Badge>
  return <Badge variant="destructive" className="w-fit">Anulowane</Badge>
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-xl">
        <CardContent className="p-8 text-center text-muted-foreground">{children}</CardContent>
      </Card>
    </main>
  )
}
