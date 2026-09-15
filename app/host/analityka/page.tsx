import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, BarChart3, Banknote, CalendarDays, Eye, MousePointerClick, Target, Ticket } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

const periodOptions = [7, 30, 90] as const

type Dashboard = {
  days: number
  from: string
  trackedFrom: string | null
  organizations: Array<{ id: string; name: string }>
  finance: { paidOrders: number; gmv: number; averageOrderValue: number; currency: string; ticketsSold: number; refundedMinor: number }
  funnel: { impressions: number; searchClicks: number; views: number; availabilityViews: number; sessionSelections: number; checkoutStarts: number; ordersCreated: number; paidOrders: number; ticketsRedeemed: number; reviewsSubmitted: number }
  capacity: { capacity: number; soldUnits: number; fillRate: number }
  topAttractions: Array<{ attraction_id: string; title: string; impressions: number; views: number; checkout_starts: number; paid_orders: number; gmv: number }>
}

function number(value: unknown) { return Number.isFinite(Number(value)) ? Number(value) : 0 }
function percent(part: unknown, total: unknown) { const p = number(part); const t = number(total); return t > 0 ? `${Math.round((p / t) * 1000) / 10}%` : "—" }

export default async function OrganizerAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!isSupabaseConfigured) redirect("/")
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/analityka")

  const query = await searchParams
  const requested = Number(query.days)
  const days = periodOptions.includes(requested as (typeof periodOptions)[number]) ? requested : 30
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("analytics_organizer_dashboard_v1", { p_actor_user_id: user.id, p_days: days })

  if (error || !data) {
    return <main className="min-h-screen bg-muted/20 px-4 py-12"><Card className="mx-auto max-w-xl"><CardHeader><CardTitle>Brak dostępu do analityki</CardTitle><CardDescription>Analityka jest dostępna dla właściciela, administratora, managera i roli podglądu. Konto kasjera ma tylko obsługę wejścia.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href="/host">Wróć do panelu</Link></Button></CardContent></Card></main>
  }

  const dashboard = data as Dashboard
  const finance = dashboard.finance
  const funnel = dashboard.funnel

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/95"><div className="container mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4"><Button asChild variant="ghost" size="sm"><Link href="/host"><ArrowLeft className="h-4 w-4" />Panel organizatora</Link></Button><Badge variant="secondary"><BarChart3 className="mr-1 h-3.5 w-3.5" />Analityka</Badge></div></header>
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Wyniki Twoich atrakcji</h1><p className="mt-2 text-muted-foreground">{dashboard.organizations.map((item) => item.name).join(" · ")}</p>{dashboard.trackedFrom && <p className="mt-2 text-xs text-muted-foreground">Dane zachowania klientów są mierzone od {new Date(dashboard.trackedFrom).toLocaleString("pl-PL")}.</p>}</div>
          <div className="flex gap-2">{periodOptions.map((option) => <Link key={option} href={`/host/analityka?days=${option}`} className={`rounded-md border px-3 py-2 text-sm font-medium ${days === option ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{option} dni</Link>)}</div>
        </div>

        <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Banknote} label="Sprzedaż" value={formatMoney(number(finance.gmv), finance.currency)} hint={`${number(finance.paidOrders)} opłaconych zamówień`} />
          <Metric icon={Ticket} label="Sprzedane bilety" value={String(number(finance.ticketsSold))} hint={`średni koszyk ${formatMoney(number(finance.averageOrderValue), finance.currency)}`} />
          <Metric icon={Target} label="Konwersja profil → zakup" value={percent(funnel.paidOrders, funnel.views)} hint={`${number(funnel.views)} wejść na profile`} />
          <Metric icon={CalendarDays} label="Wypełnienie terminów" value={`${number(dashboard.capacity.fillRate)}%`} hint={`${number(dashboard.capacity.soldUnits)} / ${number(dashboard.capacity.capacity)} miejsc`} />
        </section>

        <Card className="mb-7"><CardHeader><CardTitle>Lejek klientów</CardTitle><CardDescription>Od pojawienia się Twojej atrakcji w wynikach do wykorzystania biletu.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FunnelStep label="Wyświetlenia w wynikach" value={number(funnel.impressions)} rate="100%" />
          <FunnelStep label="Wejścia na profil" value={number(funnel.views)} rate={percent(funnel.views, funnel.impressions)} />
          <FunnelStep label="Sprawdzenie terminów" value={number(funnel.availabilityViews)} rate={percent(funnel.availabilityViews, funnel.views)} />
          <FunnelStep label="Checkout" value={number(funnel.checkoutStarts)} rate={percent(funnel.checkoutStarts, funnel.views)} />
          <FunnelStep label="Zakup" value={number(funnel.paidOrders)} rate={percent(funnel.paidOrders, funnel.checkoutStarts)} />
        </div><div className="mt-4 grid gap-3 sm:grid-cols-3"><SmallMetric label="Kliknięcia z wyników" value={number(funnel.searchClicks)} hint={`CTR ${percent(funnel.searchClicks, funnel.impressions)}`} /><SmallMetric label="Wykorzystane bilety" value={number(funnel.ticketsRedeemed)} hint="potwierdzone skanerem" /><SmallMetric label="Opinie po wizycie" value={number(funnel.reviewsSubmitted)} hint="zweryfikowane wizyty" /></div></CardContent></Card>

        <Card><CardHeader><CardTitle>Wyniki atrakcji</CardTitle><CardDescription>Porównaj widoczność, zainteresowanie i realną sprzedaż.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="py-2 pr-4">Atrakcja</th><th>Impressions</th><th>Profile</th><th>Checkout</th><th>Zakupy</th><th>Sprzedaż</th></tr></thead><tbody className="divide-y">{dashboard.topAttractions.map((item) => <tr key={item.attraction_id}><td className="py-3 pr-4 font-medium"><Link className="hover:underline" href={`/attractions/${item.attraction_id}`}>{item.title}</Link></td><td>{number(item.impressions)}</td><td>{number(item.views)}</td><td>{number(item.checkout_starts)}</td><td>{number(item.paid_orders)}</td><td>{formatMoney(number(item.gmv), finance.currency)}</td></tr>)}</tbody></table>{!dashboard.topAttractions.length && <div className="flex flex-col items-center py-10 text-center text-muted-foreground"><Eye className="mb-3 h-7 w-7" /><p>Po pierwszych wejściach i sprzedaży pojawi się tu porównanie atrakcji.</p></div>}</CardContent></Card>
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Banknote; label: string; value: string; hint: string }) { return <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card> }
function FunnelStep({ label, value, rate }: { label: string; value: number; rate: string }) { return <div className="rounded-xl border bg-background p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><Badge variant="secondary" className="mt-2">{rate}</Badge></div> }
function SmallMetric({ label, value, hint }: { label: string; value: number; hint: string }) { return <div className="rounded-xl border p-4"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MousePointerClick className="h-3.5 w-3.5" />{label}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div> }
