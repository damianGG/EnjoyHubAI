import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, WalletCards, XCircle } from "lucide-react"

import { submitOrganizerVerification } from "@/app/host/weryfikacja/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type VerificationStatus = "not_started" | "pending" | "verified" | "rejected"
type MembershipRole = "owner" | "admin" | "manager" | "cashier" | "viewer"

interface Membership {
  organization_id: string
  role: MembershipRole
}

interface Organization {
  id: string
  name: string
  legal_name: string | null
  tax_id: string | null
  billing_email: string | null
  verification_status: VerificationStatus
  payments_enabled: boolean
}

const statusMeta: Record<VerificationStatus, { label: string; description: string }> = {
  not_started: { label: "Do uzupełnienia", description: "Atrakcje możesz przygotować już teraz. Dane firmy są potrzebne przed uruchomieniem płatności online." },
  pending: { label: "Weryfikujemy", description: "Dane zostały przesłane. Do czasu akceptacji płatności online pozostają wyłączone." },
  verified: { label: "Zweryfikowana", description: "Firma jest zweryfikowana. Płatności mogą zostać aktywowane dla tej organizacji." },
  rejected: { label: "Wymaga poprawy", description: "Dane wymagają poprawy lub ponownego przesłania." },
}

export default async function OrganizerVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host")

  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/weryfikacja")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) return <CenteredMessage>Nie udało się pobrać organizacji.</CenteredMessage>

  const memberships = (membershipData ?? []) as Membership[]
  const manageable = memberships.filter((item) => ["owner", "admin", "manager"].includes(item.role))
  if (manageable.length === 0) redirect("/host/start")

  const organizationIds = [...new Set(manageable.map((item) => item.organization_id))]
  const { data: organizationData, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, legal_name, tax_id, billing_email, verification_status, payments_enabled")
    .in("id", organizationIds)
    .order("name")

  if (organizationError) return <CenteredMessage>Nie udało się pobrać statusu weryfikacji.</CenteredMessage>

  const organizations = (organizationData ?? []) as Organization[]
  const roleByOrganization = new Map(manageable.map((item) => [item.organization_id, item.role]))

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-5xl px-4 py-4">
          <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Panel organizatora
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="max-w-3xl">
          <Badge variant="secondary">Weryfikacja organizatora</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Najpierw publikacja, potem płatności</h1>
          <p className="mt-3 leading-7 text-muted-foreground">
            Nie blokujemy dodawania atrakcji długim KYC. Stronę atrakcji i ofertę możesz przygotować od razu. Dane prawne są wymagane dopiero przed przyjmowaniem płatności i wypłatami.
          </p>
        </div>

        {query.status === "wyslane" ? (
          <Alert className="mt-6 border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Dane zostały wysłane</AlertTitle>
            <AlertDescription>Status organizacji zmienił się na „Weryfikujemy”.</AlertDescription>
          </Alert>
        ) : null}
        {query.blad ? (
          <Alert variant="destructive" className="mt-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Nie udało się wysłać danych</AlertTitle>
            <AlertDescription>
              {query.blad === "dane" ? "Sprawdź pełną nazwę firmy, 10-cyfrowy NIP i adres e-mail." : "Sprawdź uprawnienia i spróbuj ponownie."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-8 grid gap-6">
          {organizations.map((organization) => {
            const meta = statusMeta[organization.verification_status]
            const role = roleByOrganization.get(organization.id)
            const canSubmit = role === "owner" || role === "admin"

            return (
              <Card key={organization.id} className="surface-3d">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{organization.name}</CardTitle>
                      <CardDescription className="mt-1">{meta.description}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={organization.verification_status === "verified" ? "default" : "outline"}>{meta.label}</Badge>
                      <Badge variant={organization.payments_enabled ? "default" : "secondary"}>
                        {organization.payments_enabled ? "Płatności aktywne" : "Płatności wyłączone"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {organization.verification_status === "verified" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info icon={ShieldCheck} title="Firma zweryfikowana">Dane organizatora są zaakceptowane.</Info>
                      <Info icon={WalletCards} title="Płatności">{organization.payments_enabled ? "Można przyjmować płatności online." : "Oczekuje na aktywację płatności."}</Info>
                    </div>
                  ) : canSubmit ? (
                    <form action={submitOrganizerVerification} className="grid gap-5 sm:grid-cols-2">
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`legalName-${organization.id}`}>Pełna nazwa prawna</Label>
                        <Input id={`legalName-${organization.id}`} name="legalName" defaultValue={organization.legal_name ?? ""} placeholder="Przykład sp. z o.o." required minLength={2} maxLength={240} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`taxId-${organization.id}`}>NIP</Label>
                        <Input id={`taxId-${organization.id}`} name="taxId" defaultValue={organization.tax_id ?? ""} inputMode="numeric" placeholder="1234567890" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`billingEmail-${organization.id}`}>E-mail rozliczeniowy</Label>
                        <Input id={`billingEmail-${organization.id}`} name="billingEmail" type="email" defaultValue={organization.billing_email ?? user.email ?? ""} required />
                      </div>
                      <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">Na tym etapie nie prosimy jeszcze o rachunek bankowy. Podłączymy go razem z operatorem płatności.</p>
                        <Button type="submit" className="shrink-0">Wyślij do weryfikacji</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                      Właściciel lub administrator organizacji może uzupełnić i wysłać dane do weryfikacji.
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function Info({ icon: Icon, title, children }: { icon: typeof ShieldCheck; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-primary" />{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main>
}
