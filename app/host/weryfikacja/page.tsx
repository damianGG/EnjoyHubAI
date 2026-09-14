import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CheckCircle2, ShieldCheck, WalletCards, XCircle } from "lucide-react"

import { submitOrganizerVerification } from "@/app/host/weryfikacja/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { organizerVerificationRoles, type OrganizerRole } from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type VerificationStatus = "not_started" | "pending" | "verified" | "rejected"

interface Membership {
  organization_id: string
  role: OrganizerRole
}

interface Organization {
  id: string
  name: string
  legal_name: string | null
  tax_id: string | null
  billing_email: string | null
  legal_address: string | null
  contact_phone: string | null
  registry_name: string | null
  registry_number: string | null
  trader_self_certified_at: string | null
  verification_status: VerificationStatus
  payments_enabled: boolean
}

const statusMeta: Record<VerificationStatus, { label: string; description: string }> = {
  not_started: { label: "Do uzupełnienia", description: "Atrakcje możesz przygotować już teraz. Kompletne dane sprzedawcy są potrzebne przed uruchomieniem płatności online." },
  pending: { label: "Weryfikujemy", description: "Dane zostały przesłane. Do czasu akceptacji płatności online pozostają wyłączone." },
  verified: { label: "Zweryfikowana", description: "Firma jest zweryfikowana. Dane sprzedawcy mogą być pokazane klientowi przed zakupem." },
  rejected: { label: "Wymaga poprawy", description: "Dane wymagają poprawy lub ponownego przesłania." },
}

function hasCompleteLegalData(organization: Organization) {
  return Boolean(
    organization.legal_name?.trim() &&
    organization.tax_id?.trim() &&
    organization.billing_email?.trim() &&
    organization.legal_address?.trim() &&
    organization.contact_phone?.trim() &&
    organization.trader_self_certified_at,
  )
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
    .in("role", [...organizerVerificationRoles])

  if (membershipError) return <CenteredMessage>Nie udało się pobrać organizacji.</CenteredMessage>

  const memberships = (membershipData ?? []) as Membership[]
  if (memberships.length === 0) {
    return <CenteredMessage>Dane prawne i płatności może konfigurować wyłącznie właściciel lub administrator organizacji.</CenteredMessage>
  }

  const organizationIds = [...new Set(memberships.map((item) => item.organization_id))]
  const { data: organizationData, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, legal_name, tax_id, billing_email, legal_address, contact_phone, registry_name, registry_number, trader_self_certified_at, verification_status, payments_enabled")
    .in("id", organizationIds)
    .order("name")

  if (organizationError) return <CenteredMessage>Nie udało się pobrać statusu weryfikacji.</CenteredMessage>

  const organizations = (organizationData ?? []) as Organization[]

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Panel organizatora
            </Link>
            <Button asChild variant="outline" size="sm"><Link href="/host/zespol">Zespół i uprawnienia</Link></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="max-w-3xl">
          <Badge variant="secondary">Weryfikacja organizatora</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Dane sprzedawcy widoczne przed płatnością</h1>
          <p className="mt-3 leading-7 text-muted-foreground">
            Klient przed zakupem zobaczy pełną nazwę firmy, NIP, adres oraz dane kontaktowe. Dane te są następnie zapisywane przy zamówieniu, dlatego muszą być aktualne i zgodne z danymi przedsiębiorcy.
          </p>
        </div>

        {query.status === "wyslane" ? (
          <Alert className="mt-6 border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Dane zostały wysłane</AlertTitle>
            <AlertDescription>Status organizacji zmienił się na „Weryfikujemy”. Potwierdzenie prawdziwości danych sprzedawcy zostało zapisane.</AlertDescription>
          </Alert>
        ) : null}
        {query.blad ? (
          <Alert variant="destructive" className="mt-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Nie udało się wysłać danych</AlertTitle>
            <AlertDescription>{query.blad === "dane" ? "Sprawdź nazwę firmy, 10-cyfrowy NIP, e-mail, adres, telefon oraz zaznacz potwierdzenie prawdziwości danych." : "Sprawdź uprawnienia i spróbuj ponownie."}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-8 grid gap-6">
          {organizations.map((organization) => {
            const meta = statusMeta[organization.verification_status]
            const complete = hasCompleteLegalData(organization)
            const verifiedAndComplete = organization.verification_status === "verified" && complete

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
                      <Badge variant={organization.payments_enabled && complete ? "default" : "secondary"}>{organization.payments_enabled && complete ? "Płatności aktywne" : "Płatności wyłączone"}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {organization.verification_status === "verified" && !complete ? (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                      <AlertTitle>Uzupełnij nowe dane wymagane w checkoutcie</AlertTitle>
                      <AlertDescription>Firma była wcześniej zweryfikowana, ale brakuje adresu, telefonu lub potwierdzenia prawdziwości danych. Do czasu uzupełnienia nowych informacji płatności online będą zablokowane.</AlertDescription>
                    </Alert>
                  ) : null}

                  {verifiedAndComplete ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info icon={ShieldCheck} title="Firma zweryfikowana">
                        {organization.legal_name}<br />NIP {organization.tax_id}<br />{organization.legal_address}
                      </Info>
                      <Info icon={WalletCards} title="Płatności">
                        {organization.payments_enabled ? "Dane sprzedawcy są kompletne i można przyjmować płatności online." : "Dane są kompletne; oczekuje na aktywację płatności."}
                      </Info>
                    </div>
                  ) : null}

                  {verifiedAndComplete ? (
                    <details className="rounded-xl border bg-muted/10 p-4">
                      <summary className="cursor-pointer text-sm font-semibold">Zmień dane firmy</summary>
                      <p className="mt-2 text-xs text-muted-foreground">Zmiana danych uruchomi ponowną weryfikację i czasowo wyłączy płatności.</p>
                      <div className="mt-5"><VerificationForm organization={organization} fallbackEmail={user.email ?? ""} submitLabel="Zapisz i wyślij ponownie" /></div>
                    </details>
                  ) : (
                    <VerificationForm organization={organization} fallbackEmail={user.email ?? ""} submitLabel={organization.verification_status === "pending" ? "Wyślij zaktualizowane dane" : "Wyślij do weryfikacji"} />
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

function VerificationForm({ organization, fallbackEmail, submitLabel }: { organization: Organization; fallbackEmail: string; submitLabel: string }) {
  return (
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
        <Label htmlFor={`billingEmail-${organization.id}`}>E-mail kontaktowy / rozliczeniowy</Label>
        <Input id={`billingEmail-${organization.id}`} name="billingEmail" type="email" defaultValue={organization.billing_email ?? fallbackEmail} required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`legalAddress-${organization.id}`}>Adres przedsiębiorcy</Label>
        <Input id={`legalAddress-${organization.id}`} name="legalAddress" defaultValue={organization.legal_address ?? ""} placeholder="ul. Przykładowa 1, 00-001 Miasto" required minLength={8} maxLength={320} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`contactPhone-${organization.id}`}>Telefon kontaktowy</Label>
        <Input id={`contactPhone-${organization.id}`} name="contactPhone" type="tel" defaultValue={organization.contact_phone ?? ""} placeholder="+48 500 000 000" required minLength={7} maxLength={40} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`registryName-${organization.id}`}>Rejestr <span className="text-muted-foreground">(opcjonalnie)</span></Label>
        <Input id={`registryName-${organization.id}`} name="registryName" defaultValue={organization.registry_name ?? ""} placeholder="KRS lub CEIDG" maxLength={40} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`registryNumber-${organization.id}`}>Numer w rejestrze <span className="text-muted-foreground">(opcjonalnie)</span></Label>
        <Input id={`registryNumber-${organization.id}`} name="registryNumber" defaultValue={organization.registry_number ?? ""} placeholder="np. 0000123456" maxLength={80} />
      </div>
      <label htmlFor={`certifyTrader-${organization.id}`} className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/20 p-4">
        <Checkbox id={`certifyTrader-${organization.id}`} name="certifyTrader" required className="mt-0.5" />
        <span className="text-sm leading-6">Potwierdzam, że podane dane przedsiębiorcy są prawdziwe, kompletne i aktualne oraz że organizacja jest uprawniona do oferowania wskazanych usług w EnjoyHub.</span>
      </label>
      <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Te dane będą pokazane kupującemu jako dane sprzedawcy usługi. Rachunek bankowy pozostaje obsługiwany osobno przez operatora płatności.</p>
        <Button type="submit" className="shrink-0">{submitLabel}</Button>
      </div>
    </form>
  )
}

function Info({ icon: Icon, title, children }: { icon: typeof ShieldCheck; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-primary" />{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
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
