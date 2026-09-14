import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Clock3,
  ExternalLink,
  Landmark,
  ShieldCheck,
  WalletCards,
} from "lucide-react"

import {
  openStripeExpressDashboard,
  requestOrganizerPayout,
  startStripeConnectOnboarding,
} from "@/app/host/rozliczenia/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { organizerVerificationRoles, type OrganizerRole } from "@/lib/organizer/access"
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe"
import { isStripeConnectEnabled, syncStripeConnectAccount } from "@/lib/stripe-connect"
import { formatMoney } from "@/lib/ticketing/format"

export const dynamic = "force-dynamic"

interface Membership {
  organization_id: string
  role: OrganizerRole
}

interface Organization {
  id: string
  name: string
  platform_fee_bps: number
}

interface PaymentAccount {
  organization_id: string
  provider_account_id: string
  details_submitted: boolean
  charges_enabled: boolean
  card_payments_enabled: boolean
  transfers_enabled: boolean
  payouts_enabled: boolean
  payout_schedule_manual: boolean
  requirements_currently_due: string[]
  disabled_reason: string | null
}

interface Settlement {
  organization_id: string
  organizer_amount_minor: number | string
  platform_fee_amount_minor: number | string
  status: string
}

interface Payout {
  id: string
  organization_id: string
  amount_minor: number | string
  currency: string
  status: string
  requested_at: string
}

function moneyMinor(value: number, currency = "PLN") {
  return formatMoney(value / 100, currency)
}

export default async function HostSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string; organization?: string; status?: string; blad?: string; kwota?: string }>
}) {
  if (!isSupabaseConfigured) return <CenteredMessage>Połącz Supabase, aby otworzyć rozliczenia.</CenteredMessage>

  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/rozliczenia")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", [...organizerVerificationRoles])

  if (membershipError) return <CenteredMessage>Nie udało się pobrać uprawnień do rozliczeń.</CenteredMessage>
  const memberships = (membershipData ?? []) as Membership[]
  if (!memberships.length) {
    return <CenteredMessage>Rozliczeniami i wypłatami może zarządzać właściciel lub administrator organizacji.</CenteredMessage>
  }

  if (!isStripeConnectEnabled) {
    return (
      <main className="min-h-screen bg-muted/20">
        <div className="container mx-auto max-w-3xl px-4 py-12">
          <Link href="/host/sprzedaz" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Sprzedaż biletów
          </Link>
          <Card className="mt-8">
            <CardHeader>
              <Badge variant="secondary" className="w-fit">Stripe Connect</Badge>
              <CardTitle className="mt-3">Moduł rozliczeń jest przygotowany</CardTitle>
              <CardDescription>
                Włącz STRIPE_CONNECT_ENABLED dopiero po zastosowaniu migracji i dodaniu webhooka Connect w Stripe.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    )
  }

  const organizationIds = [...new Set(memberships.map((membership) => membership.organization_id))]
  const { data: organizationData, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, platform_fee_bps")
    .in("id", organizationIds)
    .order("name")

  if (organizationError) return <CenteredMessage>Nie udało się pobrać organizacji.</CenteredMessage>
  const organizations = (organizationData ?? []) as Organization[]

  if (
    query.stripe === "powrot" &&
    query.organization &&
    organizationIds.includes(query.organization) &&
    isSupabaseAdminConfigured &&
    isStripeConfigured
  ) {
    const admin = createAdminClient()
    const { data: account } = await admin
      .from("organization_payment_accounts")
      .select("provider_account_id")
      .eq("organization_id", query.organization)
      .maybeSingle()
    if (account?.provider_account_id) {
      try {
        await syncStripeConnectAccount(query.organization, account.provider_account_id)
      } catch (error) {
        console.error("Stripe Connect return sync failed", { organizationId: query.organization, error })
      }
    }
  }

  const [accountsResult, settlementsResult, payoutsResult] = await Promise.all([
    supabase
      .from("organization_payment_accounts")
      .select("organization_id, provider_account_id, details_submitted, charges_enabled, card_payments_enabled, transfers_enabled, payouts_enabled, payout_schedule_manual, requirements_currently_due, disabled_reason")
      .in("organization_id", organizationIds),
    supabase
      .from("marketplace_settlements")
      .select("organization_id, organizer_amount_minor, platform_fee_amount_minor, status")
      .in("organization_id", organizationIds),
    supabase
      .from("marketplace_payouts")
      .select("id, organization_id, amount_minor, currency, status, requested_at")
      .in("organization_id", organizationIds)
      .order("requested_at", { ascending: false })
      .limit(30),
  ])

  if (accountsResult.error || settlementsResult.error || payoutsResult.error) {
    return <CenteredMessage>Moduł rozliczeń czeka na zastosowanie migracji Stripe Connect.</CenteredMessage>
  }

  const accounts = (accountsResult.data ?? []) as PaymentAccount[]
  const settlements = (settlementsResult.data ?? []) as Settlement[]
  const payouts = (payoutsResult.data ?? []) as Payout[]
  const accountByOrganization = new Map(accounts.map((account) => [account.organization_id, account]))

  const liveAvailableByOrganization = new Map<string, number>()
  if (isStripeConfigured) {
    await Promise.all(accounts.map(async (account) => {
      try {
        const balance = await getStripeClient().balance.retrieve({ stripeAccount: account.provider_account_id })
        const available = balance.available
          .filter((item) => item.currency === "pln")
          .reduce((sum, item) => sum + item.amount, 0)
        liveAvailableByOrganization.set(account.organization_id, available)
      } catch (error) {
        console.warn("Could not read connected account balance", { organizationId: account.organization_id, error })
      }
    }))
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/host/sprzedaz" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Sprzedaż biletów
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="max-w-3xl">
          <Badge variant="secondary">Rozliczenia · Stripe Connect</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Pieniądze od rezerwacji do wypłaty</h1>
          <p className="mt-3 text-muted-foreground">
            EnjoyHub trzyma środki do zakończenia usługi. Potem część organizatora trafia na jego saldo Stripe i może zostać wypłacona na rachunek bankowy.
          </p>
        </div>

        {query.status === "wyplata" ? (
          <Alert className="mt-6">
            <BadgeCheck className="h-4 w-4" />
            <AlertTitle>Wypłata została zlecona</AlertTitle>
            <AlertDescription>
              {query.kwota && Number.isFinite(Number(query.kwota))
                ? `${moneyMinor(Number(query.kwota))} zostało przekazane do realizacji przez Stripe.`
                : "Stripe rozpoczął realizację wypłaty."}
            </AlertDescription>
          </Alert>
        ) : null}
        {query.blad ? (
          <Alert variant="destructive" className="mt-6">
            <AlertTitle>Nie udało się wykonać operacji</AlertTitle>
            <AlertDescription>
              {query.blad === "wyplata"
                ? "Sprawdź, czy środki są już dostępne na saldzie Stripe i czy konto bankowe jest aktywne."
                : "Sprawdź konfigurację Stripe Connect lub uprawnienia organizacji."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-8 grid gap-6">
          {organizations.map((organization) => {
            const account = accountByOrganization.get(organization.id)
            const orgSettlements = settlements.filter((item) => item.organization_id === organization.id)
            const pendingService = sumSettlements(orgSettlements, "pending_service")
            const transferred = sumSettlements(orgSettlements, "transferred")
            const payoutPending = sumSettlements(orgSettlements, "payout_pending")
            const paidOut = sumSettlements(orgSettlements, "paid_out")
            const platformFees = orgSettlements.reduce((sum, item) => sum + Number(item.platform_fee_amount_minor), 0)
            const available = liveAvailableByOrganization.get(organization.id) ?? 0
            const ready = Boolean(
              account?.details_submitted &&
              account.charges_enabled &&
              account.card_payments_enabled &&
              account.transfers_enabled &&
              account.payouts_enabled &&
              account.payout_schedule_manual,
            )
            const orgPayouts = payouts.filter((item) => item.organization_id === organization.id).slice(0, 5)

            return (
              <Card key={organization.id} className="surface-3d">
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle>{organization.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Prowizja EnjoyHub: {(organization.platform_fee_bps / 100).toFixed(2).replace(".00", "")}%
                      </CardDescription>
                    </div>
                    <Badge variant={ready ? "default" : "secondary"}>
                      {ready ? "Stripe gotowy" : account ? "Dokończ Stripe" : "Stripe niepołączony"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!account || !ready ? (
                    <div className="rounded-xl border bg-background p-5">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <p className="font-semibold">{account ? "Dokończ weryfikację i rachunek bankowy" : "Połącz firmę ze Stripe Connect"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Stripe zbiera dane KYC i rachunek bankowy na swoim bezpiecznym formularzu. EnjoyHub zapisuje tylko status połączenia.
                          </p>
                          {account?.requirements_currently_due?.length ? (
                            <p className="mt-2 text-xs text-muted-foreground">Pozostałe wymagania Stripe: {account.requirements_currently_due.length}</p>
                          ) : null}
                          <form action={startStripeConnectOnboarding} className="mt-4">
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <Button type="submit">{account ? "Kontynuuj w Stripe" : "Połącz Stripe Connect"}</Button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Metric icon={Clock3} label="Do realizacji" value={moneyMinor(pendingService)} hint="Jeszcze zablokowane" />
                        <Metric icon={WalletCards} label="Po realizacji" value={moneyMinor(transferred)} hint="Na saldzie Stripe" />
                        <Metric icon={Landmark} label="Dostępne teraz" value={moneyMinor(available)} hint="Można zlecić wypłatę" />
                        <Metric icon={Banknote} label="Wypłacone" value={moneyMinor(paidOut)} hint="Potwierdzone przez Stripe" />
                      </div>

                      <div className="flex flex-col gap-3 rounded-xl border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">Saldo dostępne: {moneyMinor(available)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            W trakcie wypłaty: {moneyMinor(payoutPending)} · prowizje EnjoyHub zapisane w ledgerze: {moneyMinor(platformFees)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <form action={requestOrganizerPayout}>
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <Button type="submit" disabled={available <= 0}>Wypłać</Button>
                          </form>
                          <form action={openStripeExpressDashboard}>
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <Button type="submit" variant="outline">Stripe <ExternalLink className="h-4 w-4" /></Button>
                          </form>
                        </div>
                      </div>
                    </>
                  )}

                  {orgPayouts.length ? (
                    <div>
                      <h3 className="font-semibold">Ostatnie wypłaty</h3>
                      <div className="mt-3 divide-y rounded-xl border bg-background px-4">
                        {orgPayouts.map((payout) => (
                          <div key={payout.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                            <div>
                              <p className="font-medium">{moneyMinor(Number(payout.amount_minor), payout.currency)}</p>
                              <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payout.requested_at))}</p>
                            </div>
                            <Badge variant={payout.status === "paid" ? "default" : payout.status === "failed" ? "destructive" : "secondary"}>
                              {payoutLabel(payout.status)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function sumSettlements(settlements: Settlement[], status: string) {
  return settlements
    .filter((item) => item.status === status)
    .reduce((sum, item) => sum + Number(item.organizer_amount_minor), 0)
}

function payoutLabel(status: string) {
  if (status === "paid") return "Wypłacona"
  if (status === "failed") return "Nieudana"
  if (status === "cancelled") return "Anulowana"
  if (status === "requires_review") return "Do sprawdzenia"
  if (status === "creating") return "Przygotowanie"
  return "W realizacji"
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Banknote; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-xl"><CardContent className="p-8 text-center text-muted-foreground">{children}</CardContent></Card>
    </main>
  )
}
