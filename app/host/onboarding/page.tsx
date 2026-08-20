import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { OrganizerOnboardingWizard } from "@/components/ticketing/organizer-onboarding-wizard"
import { Card, CardContent } from "@/components/ui/card"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Konfiguracja organizatora",
  description: "Dodaj atrakcję, bilety i terminy krok po kroku.",
}

interface RawCategory {
  id: string
  name: string
  icon: string | null
  description: string | null
}

export default async function OrganizerOnboardingPage() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Połącz Supabase, aby rozpocząć konfigurację.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/sign-up?next=/host/onboarding")

  const [categoriesResult, membershipsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, icon, description")
      .order("name"),
    supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "manager"])
      .limit(1),
  ])

  if (membershipsResult.error || categoriesResult.error) {
    return <CenteredMessage>Nie udało się załadować kreatora. Odśwież stronę i spróbuj ponownie.</CenteredMessage>
  }

  if (membershipsResult.data?.length) {
    redirect("/host/sprzedaz/konfiguracja")
  }

  const categories = ((categoriesResult.data ?? []) as RawCategory[]).map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    description: category.description,
  }))

  if (categories.length === 0) {
    return <CenteredMessage>Brakuje kategorii atrakcji. Administrator EnjoyHub musi dodać co najmniej jedną kategorię.</CenteredMessage>
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/host/start" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Wróć do przygotowania
          </Link>
        </div>
      </header>
      <OrganizerOnboardingWizard
        categories={categories}
        userId={user.id}
        userEmail={user.email ?? ""}
      />
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
