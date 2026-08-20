import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, MapPin, Ticket } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Zostań organizatorem",
  description: "Przygotuj swój obiekt i pierwszą ofertę biletową w EnjoyHub.",
}

const preparationItems = [
  { icon: Building2, label: "nazwa firmy lub organizacji" },
  { icon: MapPin, label: "adres i krótki opis atrakcji" },
  { icon: Ticket, label: "rodzaje biletów i ceny" },
  { icon: CalendarDays, label: "dni, godziny i liczba miejsc" },
]

export default async function OrganizerStartPage() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby rozpocząć konfigurację organizatora.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/sign-up?next=/host/start")

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin", "manager"])
    .limit(1)

  if (error) {
    return <CenteredMessage>Nie udało się sprawdzić Twojego panelu. Spróbuj ponownie za chwilę.</CenteredMessage>
  }

  const alreadyOrganizer = Boolean(memberships?.length)
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Cześć"

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      <header className="border-b bg-background/90">
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/dla-organizatorow" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Jak działa EnjoyHub
          </Link>
          <Link href="/" aria-label="EnjoyHub — strona główna">
            <Image src="/placeholder-logo.svg" alt="" width={36} height={36} />
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary">Zostań organizatorem</Badge>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {alreadyOrganizer ? "Twój panel jest już gotowy" : `${displayName}, przygotujmy Twoją pierwszą sprzedaż`}
          </h1>
          <p className="mt-4 leading-7 text-muted-foreground">
            {alreadyOrganizer
              ? "Masz już uprawnienia organizatora. Możesz przejść do panelu albo dodać kolejną ofertę dla istniejącego obiektu."
              : "Przejdziesz przez krótkie kroki. Na końcu pokażemy całe podsumowanie i dopiero po Twoim potwierdzeniu utworzymy ofertę."}
          </p>
        </div>

        {alreadyOrganizer ? (
          <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
            <Button asChild size="lg" className="h-12">
              <Link href="/host">Otwórz panel <ArrowRight className="h-5 w-5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12">
              <Link href="/host/sprzedaz/konfiguracja">Dodaj kolejną ofertę</Link>
            </Button>
          </div>
        ) : (
          <>
            <Card className="surface-3d mx-auto mt-10 max-w-3xl">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-lg font-semibold">Dobrze mieć pod ręką:</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {preparationItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="flex items-center gap-3 rounded-xl border bg-muted/25 p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p className="flex items-start gap-2 font-medium">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    Jeśli korzystasz z własnej kasy, nie musisz jej zmieniać. Wybierzesz po prostu pulę miejsc przeznaczoną dla EnjoyHub.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-3 text-center">
              <Button asChild size="lg" className="h-12 w-full px-8 text-base sm:w-auto">
                <Link href="/host/onboarding">Zaczynamy <ArrowRight className="h-5 w-5" /></Link>
              </Button>
              <p className="text-xs text-muted-foreground">Nic nie zostanie opublikowane bez końcowego potwierdzenia.</p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-xl">
        <CardContent className="p-8 text-muted-foreground">{children}</CardContent>
      </Card>
    </main>
  )
}
