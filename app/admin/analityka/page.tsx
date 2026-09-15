import Link from "next/link"
import { BarChart3, Banknote, Search, Target, Ticket, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePlatformStaff } from "@/lib/platform-admin/access"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

type Dashboard = {
  role: string
  days: number
  from: string
  trackedFrom: string | null
  permissions: { finance: boolean; funnel: boolean; search: boolean; demand: boolean }
  finance: null | { paidOrders: number; gmv: number; averageOrderValue: number; currency: string; ticketsSold: number; platformFeeMinor: number; refundedMinor: number; pendingSettlementMinor: number }
  funnel: Record<string, number> | null
  search: null | { searches: number; zeroResults: number; topQueries: Array<{ query: string; searches: number; zero_results: number }>; topZeroResultQueries: Array<{ query: string; searches: number }> }
  demand: null | { requests: number; people: number; notified: number; converted: number; open: number }
  topAttractions: Array<{ attraction_id: string; title: string; impressions: number; search_clicks: number; views: number; checkout_starts: number; paid_orders: number; tracked_gmv: number }> | null
}

const periodOptions = [7, 30, 90] as const
function number(value: unknown) { return Number.isFinite(Number(value)) ? Number(value) : 0 }
function percent(part: number, total: number) { return total > 0 ? `${Math.round((part / total) * 1000) / 10}%` : "—" }
function minorMoney(value: unknown, currency = "PLN") { return formatMoney(number(value) / 100, currency) }

export default async function PlatformAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { user } = await requirePlatformStaff(undefined, "/admin/analityka")
  const query = await searchParams
  const requested = Number(query.days)
  const days = periodOptions.includes(requested as (typeof periodOptions)[number]) ? requested : 30
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("analytics_platform_dashboard_v1", { p_actor_user_id: user.id, p_days: days })

  if (error || !data) return <main className="container mx-auto max-w-7xl px-4 py-10"><Card><CardContent className="py-10">Nie udało się pobrać analityki marketplace.</CardContent></Card></main>

  const dashboard = data as Dashboard
  const funnel = dashboard.funnel ?? {}
  const searches = number(funnel.search_performed)
  const views = number(funnel.attraction_viewed)
  const checkouts = number(funnel.checkout_started)
  const paid = number(funnel.payment_completed)

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3"><BarChart3 className="mr-1 h-3.5 w-3.5" />Marketplace analytics</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Analityka EnjoyHub</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Sprzedaż z danych transakcyjnych oraz zachowanie klientów z first-party analytics.</p>
          {dashboard.trackedFrom && <p className="mt-2 text-xs text-muted-foreground">Tracking lejka działa od {new Date(dashboard.trackedFrom).toLocaleString("pl-PL")}.</p>}
        </div>
        <div className="flex gap-2">{periodOptions.map((option) => <Link key={option} href={`/admin/analityka?days=${option}`} className={`rounded-md border px-3 py-2 text-sm font-medium ${days === option ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{option} dni</Link>)}</div>
      </div>

      {dashboard.permissions.finance && dashboard.finance && <section className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Banknote} label="GMV" value={formatMoney(number(dashboard.finance.gmv), dashboard.finance.currency)} hint={`${dashboard.finance.paidOrders} opłaconych zamówień`} />
        <Metric icon={Target} label="Prowizja EnjoyHub" value={minorMoney(dashboard.finance.platformFeeMinor, dashboard.finance.currency)} hint="po uwzględnieniu zwrotów fee" />
        <Metric icon={Ticket} label="Sprzedane bilety" value={String(number(dashboard.finance.ticketsSold))} hint={`średni koszyk ${formatMoney(number(dashboard.finance.averageOrderValue), dashboard.finance.currency)}`} />
        <Metric icon={Banknote} label="Zwroty" value={minorMoney(dashboard.finance.refundedMinor, dashboard.finance.currency)} hint={`oczekujące settlementy ${minorMoney(dashboard.finance.pendingSettlementMinor, dashboard.finance.currency)}`} />
      </section>}

      {dashboard.permissions.funnel && <Card className="mb-7"><CardHeader><CardTitle>Lejek marketplace</CardTitle><CardDescription>Każdy etap jest mierzony first-party; transakcje są potwierdzane po stronie serwera/bazy.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <FunnelStep label="Wyszukiwania" value={searches} rate="100%" />
        <FunnelStep label="Profile" value={views} rate={percent(views, searches)} />
        <FunnelStep label="Checkout" value={checkouts} rate={percent(checkouts, views)} />
        <FunnelStep label="Płatności" value={paid} rate={percent(paid, checkouts)} />
        <FunnelStep label="Wykorzystane bilety" value={number(funnel.ticket_redeemed)} rate={percent(number(funnel.ticket_redeemed), paid)} />
      </div></CardContent></Card>}

      <div className="grid gap-6 xl:grid-cols-2">
        {dashboard.permissions.search && dashboard.search && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Wyszukiwarka</CardTitle><CardDescription>{dashboard.search.searches} wyszukiwań · {dashboard.search.zeroResults} bez wyników ({percent(dashboard.search.zeroResults, dashboard.search.searches)})</CardDescription></CardHeader><CardContent className="space-y-5">
          <div><p className="mb-2 text-sm font-semibold">Najczęstsze zapytania</p><div className="divide-y rounded-lg border">{dashboard.search.topQueries.length ? dashboard.search.topQueries.map((item) => <div key={item.query} className="flex items-center justify-between gap-4 px-3 py-2 text-sm"><span className="truncate">{item.query}</span><span className="shrink-0 text-muted-foreground">{item.searches} · 0 wyników: {item.zero_results}</span></div>) : <Empty />}</div></div>
          <div><p className="mb-2 text-sm font-semibold">Największe braki podaży</p><div className="divide-y rounded-lg border">{dashboard.search.topZeroResultQueries.length ? dashboard.search.topZeroResultQueries.map((item) => <div key={item.query} className="flex items-center justify-between gap-4 px-3 py-2 text-sm"><span className="truncate">{item.query}</span><Badge variant="outline">{item.searches}</Badge></div>) : <Empty />}</div></div>
        </CardContent></Card>}
        {dashboard.permissions.demand && dashboard.demand && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Demand</CardTitle><CardDescription>Popyt zgłaszany przez klientów, gdy brakuje właściwej dostępności.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SmallMetric label="Zgłoszenia" value={dashboard.demand.requests} /><SmallMetric label="Osoby" value={dashboard.demand.people} /><SmallMetric label="Otwarte" value={dashboard.demand.open} /><SmallMetric label="Powiadomione" value={dashboard.demand.notified} /><SmallMetric label="Konwersje" value={dashboard.demand.converted} /><SmallMetric label="Konwersja" value={percent(dashboard.demand.converted, dashboard.demand.requests)} />
        </CardContent></Card>}
      </div>

      {dashboard.permissions.funnel && <Card className="mt-7"><CardHeader><CardTitle>Top atrakcje</CardTitle><CardDescription>Impressions, wejścia na profil i konwersja w śledzonym okresie.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="py-2 pr-4">Atrakcja</th><th>Wyświetlenia</th><th>Kliknięcia</th><th>Profile</th><th>Checkout</th><th>Płatności</th></tr></thead><tbody className="divide-y">{(dashboard.topAttractions ?? []).map((item) => <tr key={item.attraction_id}><td className="py-3 pr-4 font-medium">{item.title}</td><td>{number(item.impressions)}</td><td>{number(item.search_clicks)}</td><td>{number(item.views)}</td><td>{number(item.checkout_starts)}</td><td>{number(item.paid_orders)}</td></tr>)}</tbody></table>{!dashboard.topAttractions?.length && <p className="py-6 text-sm text-muted-foreground">Dane pojawią się po pierwszych zdarzeniach.</p>}</CardContent></Card>}
    </main>
  )
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Banknote; label: string; value: string; hint: string }) { return <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card> }
function FunnelStep({ label, value, rate }: { label: string; value: number; rate: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><Badge variant="secondary" className="mt-2">{rate}</Badge></div> }
function SmallMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div> }
function Empty() { return <p className="px-3 py-4 text-sm text-muted-foreground">Brak danych w tym okresie.</p> }
