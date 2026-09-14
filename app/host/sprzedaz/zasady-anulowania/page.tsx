import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react"

import { updateCancellationPolicy } from "@/app/host/sprzedaz/zasady-anulowania/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { organizerManagementRoles, type OrganizerRole } from "@/lib/organizer/access"
import { buildCancellationPolicy, type CancellationPolicyCode } from "@/lib/legal/marketplace"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface Membership {
  organization_id: string
  role: OrganizerRole
}

interface Venue {
  id: string
  name: string
}

interface Product {
  id: string
  venue_id: string
  name: string
  status: string
  cancellation_policy_code: CancellationPolicyCode
  cancellation_deadline_hours: number
  cancellation_policy_text: string | null
}

export default async function CancellationRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ zapisano?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host/sprzedaz")

  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/sprzedaz/zasady-anulowania")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) return <CenteredMessage>Nie udało się pobrać Twoich organizacji.</CenteredMessage>
  const memberships = ((membershipData ?? []) as Membership[]).filter((membership) =>
    organizerManagementRoles.includes(membership.role as (typeof organizerManagementRoles)[number]),
  )
  const organizationIds = [...new Set(memberships.map((membership) => membership.organization_id))]
  if (organizationIds.length === 0) return <CenteredMessage>Nie masz uprawnień do zmiany zasad anulowania.</CenteredMessage>

  const { data: venueData, error: venueError } = await supabase
    .from("venues")
    .select("id, name")
    .in("organization_id", organizationIds)
  if (venueError) return <CenteredMessage>Nie udało się pobrać obiektów.</CenteredMessage>

  const venues = (venueData ?? []) as Venue[]
  const venueIds = venues.map((venue) => venue.id)
  const { data: productData, error: productError } = venueIds.length
    ? await supabase
        .from("products")
        .select("id, venue_id, name, status, cancellation_policy_code, cancellation_deadline_hours, cancellation_policy_text")
        .in("venue_id", venueIds)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
    : { data: [] as Product[], error: null }

  if (productError) return <CenteredMessage>Nie udało się pobrać ofert.</CenteredMessage>
  const products = (productData ?? []) as Product[]
  const venueById = new Map(venues.map((venue) => [venue.id, venue.name]))

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-5xl px-4 py-4">
          <Link href="/host/sprzedaz" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Sprzedaż biletów
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="max-w-3xl">
          <Badge variant="secondary">Warunki oferty</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Zasady anulowania i zwrotów</h1>
          <p className="mt-3 leading-7 text-muted-foreground">Ustaw zasady osobno dla każdej oferty. Klient zobaczy je przed zakupem, a dokładna wersja zostanie zapisana przy zamówieniu.</p>
        </div>

        {query.zapisano ? (
          <Alert className="mt-6 border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Zasady zostały zapisane</AlertTitle>
            <AlertDescription>Nowe zamówienia będą korzystać z aktualnej polityki. Warunki istniejących zamówień pozostają bez zmian.</AlertDescription>
          </Alert>
        ) : null}
        {query.blad ? (
          <Alert variant="destructive" className="mt-6">
            <AlertTitle>Nie udało się zapisać zasad</AlertTitle>
            <AlertDescription>{query.blad === "dane" ? "Sprawdź wybrany wariant, termin i treść własnych zasad." : "Sprawdź uprawnienia i spróbuj ponownie."}</AlertDescription>
          </Alert>
        ) : null}

        <Alert className="mt-6">
          <RotateCcw className="h-4 w-4" />
          <AlertTitle>Domyślnie: pełny zwrot do 24 godzin przed terminem</AlertTitle>
          <AlertDescription>To bezpieczna i przyjazna klientowi polityka startowa. Możesz ustawić ofertę bezzwrotną albo własne zasady, ale muszą być jasne przed zakupem.</AlertDescription>
        </Alert>

        <div className="mt-8 grid gap-6">
          {products.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-10 text-center text-muted-foreground">Nie masz jeszcze ofert biletowych do skonfigurowania.</CardContent></Card>
          ) : products.map((product) => {
            const current = buildCancellationPolicy({
              code: product.cancellation_policy_code,
              deadlineHours: product.cancellation_deadline_hours,
              customText: product.cancellation_policy_text,
            })

            return (
              <Card key={product.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{product.name}</CardTitle>
                      <CardDescription>{venueById.get(product.venue_id) ?? "Obiekt"} · {product.status === "active" ? "aktywna" : "wersja robocza"}</CardDescription>
                    </div>
                    <Badge variant="outline">{current.title}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">{current.shortSummary}</div>
                  <form action={updateCancellationPolicy} className="grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="productId" value={product.id} />
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`policy-${product.id}`}>Polityka</Label>
                      <select id={`policy-${product.id}`} name="policyCode" defaultValue={product.cancellation_policy_code} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="flexible_24h">Elastyczna — pełny zwrot do wskazanej liczby godzin</option>
                        <option value="non_refundable">Bezzwrotna</option>
                        <option value="custom">Własne zasady</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`deadline-${product.id}`}>Ile godzin przed terminem?</Label>
                      <Input id={`deadline-${product.id}`} name="deadlineHours" type="number" min={0} max={720} defaultValue={product.cancellation_deadline_hours} />
                      <p className="text-xs text-muted-foreground">Dla oferty bezzwrotnej pole jest ignorowane.</p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`custom-${product.id}`}>Własne zasady <span className="text-muted-foreground">(tylko dla wariantu „Własne zasady”)</span></Label>
                      <textarea id={`custom-${product.id}`} name="customText" defaultValue={product.cancellation_policy_text ?? ""} maxLength={2000} rows={5} placeholder="Opisz jednoznacznie, do kiedy klient może anulować, jaki zwrot otrzymuje i co dzieje się po terminie." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit">Zapisz zasady tej oferty</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">Ogólne zasady platformy są dostępne publicznie na stronie <Link className="text-primary underline" href="/zasady-anulowania" target="_blank">Zasady anulowania i zwrotów</Link>.</p>
      </div>
    </main>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card className="max-w-xl"><CardContent className="p-8 text-center text-muted-foreground">{children}</CardContent></Card></main>
}
