import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { OrganizerOnboardingLite } from "@/components/ticketing/organizer-onboarding-lite"
import { Card, CardContent } from "@/components/ui/card"
import { organizerManagementRoles } from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Dodaj pierwszą atrakcję",
  description: "Dodaj organizację, atrakcję, pierwszą ofertę, rodzaj biletu i regułę dostępności w kilku prostych krokach.",
}

interface RawCategory {
  id: string
  name: string
  icon: string | null
  description: string | null
}

interface RawSubcategory {
  id: string
  parent_category_id: string
  name: string
  icon: string | null
  description: string | null
}

export default async function OrganizerOnboardingPage() {
  if (!isSupabaseConfigured) {
    return <CenteredMessage>Kreator konfiguracji jest chwilowo niedostępny. Spróbuj ponownie za chwilę.</CenteredMessage>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/sign-up?next=/host/onboarding")

  const [categoriesResult, subcategoriesResult, membershipsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, icon, description")
      .order("name"),
    supabase
      .from("subcategories")
      .select("id, parent_category_id, name, icon, description")
      .order("name"),
    supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", user.id)
      .in("role", [...organizerManagementRoles])
      .limit(1),
  ])

  if (membershipsResult.error || categoriesResult.error || subcategoriesResult.error) {
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
  const subcategories = ((subcategoriesResult.data ?? []) as RawSubcategory[]).map((subcategory) => ({
    id: subcategory.id,
    parentCategoryId: subcategory.parent_category_id,
    name: subcategory.name,
    icon: subcategory.icon,
    description: subcategory.description,
  }))

  if (categories.length === 0) {
    return <CenteredMessage>Brakuje kategorii atrakcji. Administrator EnjoyHub musi dodać co najmniej jedną kategorię.</CenteredMessage>
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/host/start" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Wróć
          </Link>
        </div>
      </header>
      <OrganizerOnboardingLite
        categories={categories}
        subcategories={subcategories}
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
