import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  ScanLine,
  Settings2,
  Ticket,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  hasOrganizerRole,
  organizerManagementRoles,
  organizerRoleLabels,
  organizerSalesRoles,
  organizerScannerRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface OrganizerMembership {
  organization_id: string
  role: OrganizerRole
}

export default async function HostDashboard() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby otworzyć panel organizatora.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host")

  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (error) {
    return <CenteredMessage>Nie udało się pobrać uprawnień do panelu organizatora.</CenteredMessage>
  }

  const memberships = (data ?? []) as OrganizerMembership[]
  const roles = new Set(memberships.map((membership) => membership.role))
  const canManage = hasOrganizerRole(roles, organizerManagementRoles)
  const canViewSales = hasOrganizerRole(roles, organizerSalesRoles)
  const canScan = hasOrganizerRole(roles, organizerScannerRoles)
  const organizationCount = new Set(memberships.map((membership) => membership.organization_id)).size
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Użytkowniku"

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-background/90">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Strona główna
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">Panel organizatora</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Twoje atrakcje w EnjoyHub</h1>
            <p className="mt-2 text-muted-foreground">
              Witaj, {displayName}. Zarządzaj atrakcjami, ofertami, zamówieniami i kontrolą biletów.
            </p>
          </div>
          {memberships.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...roles].map((role) => <Badge key={role} variant="outline">{organizerRoleLabels[role]}</Badge>)}
              <Badge variant="outline">
                {organizationCount} {organizationCount === 1 ? "organizacja" : "organizacji"}
              </Badge>
            </div>
          )}
        </div>

        {memberships.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Ticket className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Dodaj pierwszą atrakcję</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Kreator utworzy organizację, obiekt, atrakcję, pierwszą ofertę, bilety i terminy.
              </p>
              <Button asChild className="mt-6">
                <Link href="/host/start">
                  Zostań organizatorem <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {canViewSales && (
              <ActionCard
                href="/host/sprzedaz"
                icon={BarChart3}
                title="Sprzedaż i zamówienia"
                description="Sprawdzaj obrót, płatności, zamówienia i wystawione bilety."
              />
            )}
            {canManage && (
              <ActionCard
                href="/host/sprzedaz/konfiguracja"
                icon={Settings2}
                title="Atrakcje, oferty i terminy"
                description="Zarządzaj ofertami, cennikiem, pulą miejsc i harmonogramem sprzedaży."
              />
            )}
            {canScan && (
              <ActionCard
                href="/host/skaner"
                icon={ScanLine}
                title="Kontrola wejścia"
                description="Skanuj kody QR i oznaczaj wykorzystanie biletów przy wejściu."
              />
            )}
          </div>
        )}

        {memberships.length > 0 && !canManage && !canViewSales && canScan && (
          <p className="mt-6 text-sm text-muted-foreground">
            Konto kasjera ma dostęp wyłącznie do kontroli wejścia. Dane klientów i wyniki sprzedaży pozostają ukryte.
          </p>
        )}
      </div>
    </main>
  )
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-between gap-3">
            {title}
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-xl">
        <CardContent className="flex items-start gap-3 p-8 text-muted-foreground">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{children}</p>
        </CardContent>
      </Card>
    </main>
  )
}
