import Link from "next/link"
import { ArrowLeft, Camera, Keyboard, LogIn, Smartphone, TicketCheck } from "lucide-react"
import { redirect } from "next/navigation"

import { ManualTicketRedeemer } from "@/components/ticketing/manual-ticket-redeemer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { isTicketingPaymentsEnabled } from "@/lib/ticketing/config"

export const dynamic = "force-dynamic"

export default async function TicketScannerPage() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby kontrolować bilety.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/skaner")

  if (!isTicketingPaymentsEnabled) {
    return (
      <CenteredMessage>
        Kontrola wejścia jest gotowa, ale pozostaje wyłączona do czasu migracji 1D i uruchomienia płatności.
      </CenteredMessage>
    )
  }

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin", "manager", "cashier"])
    .limit(1)

  if (!memberships?.length) {
    return (
      <CenteredMessage>
        Twoje konto nie ma roli właściciela, managera ani kasjera w żadnej organizacji.
      </CenteredMessage>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-background/90">
        <div className="container mx-auto px-4 py-4">
          <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Powrót do panelu
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <TicketCheck className="h-7 w-7 text-primary" />
          </div>
          <Badge variant="secondary">Panel kasjera</Badge>
          <h1 className="mt-3 text-3xl font-bold">Kontrola wejścia</h1>
          <p className="mt-2 text-muted-foreground">
            Bez dodatkowego sprzętu — wystarczy aparat w telefonie zalogowanego pracownika.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <InstructionCard icon={LogIn} step="1" title="Zaloguj kasjera">
            Na tym telefonie konto musi mieć rolę kasjera lub managera.
          </InstructionCard>
          <InstructionCard icon={Camera} step="2" title="Zeskanuj QR">
            Otwórz zwykły aparat telefonu i skieruj go na kod gościa.
          </InstructionCard>
          <InstructionCard icon={Smartphone} step="3" title="Potwierdź wejście">
            Otwórz wykryty link i naciśnij „Wpuść gościa”.
          </InstructionCard>
        </div>

        <Card className="mt-7 surface-3d">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-primary" /> Tryb awaryjny
            </CardTitle>
            <CardDescription>
              Gdy aparat nie odczyta QR, wklej kod UUID lub pełny adres z biletu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManualTicketRedeemer />
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/host/sprzedaz">Przejdź do sprzedaży biletów</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

function InstructionCard({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: typeof Camera
  step: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="mb-2 flex items-center justify-between">
          <Icon className="h-5 w-5 text-primary" />
          <Badge variant="outline">Krok {step}</Badge>
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-xl">
        <CardContent className="space-y-5 p-8 text-center text-muted-foreground">
          <p>{children}</p>
          <Button asChild variant="outline"><Link href="/host">Powrót do panelu</Link></Button>
        </CardContent>
      </Card>
    </main>
  )
}
