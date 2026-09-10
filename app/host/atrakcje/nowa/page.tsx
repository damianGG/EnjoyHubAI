import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { AddAttractionForm } from "@/components/organizer/add-attraction-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { organizerManagementRoles } from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type Membership = { organization_id: string; role: string }
type Organization = { id: string; name: string }
type Category = { id: string; name: string; icon: string | null }

export default async function NewOrganizerAttractionPage({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  if (!isSupabaseConfigured) redirect("/host")
  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/atrakcje/nowa")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", [...organizerManagementRoles])

  if (membershipError) return <CenteredMessage>Nie udało się pobrać Twoich organizacji.</CenteredMessage>
  const memberships = (membershipData ?? []) as Membership[]
  if (!memberships.length) redirect("/host/start")

  const organizationIds = [...new Set(memberships.map((item) => item.organization_id))]
  const [organizationsResult, categoriesResult] = await Promise.all([
    supabase.from("organizations").select("id, name").in("id", organizationIds).eq("status", "active").order("name"),
    supabase.from("categories").select("id, name, icon").order("name"),
  ])

  if (organizationsResult.error || categoriesResult.error) return <CenteredMessage>Nie udało się przygotować formularza atrakcji.</CenteredMessage>
  const organizations = (organizationsResult.data ?? []) as Organization[]
  const categories = (categoriesResult.data ?? []) as Category[]
  if (!organizations.length || !categories.length) return <CenteredMessage>Brakuje aktywnej organizacji lub kategorii atrakcji.</CenteredMessage>

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background"><div className="container mx-auto max-w-5xl px-4 py-4"><Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Panel organizatora</Link></div></header>
      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-8 max-w-3xl"><Badge variant="secondary">Nowa atrakcja</Badge><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Dodaj kolejną atrakcję</h1><p className="mt-3 text-muted-foreground">Nie przechodzisz drugi raz onboardingu firmy. Wybierasz organizację, dodajesz atrakcję i jej pierwszą ofertę.</p></div>
        {query.blad ? <Alert variant="destructive" className="mb-6"><AlertTitle>Nie udało się dodać atrakcji</AlertTitle><AlertDescription>{query.blad === "dane" ? "Sprawdź wymagane pola, mapę, cenę i godziny." : "Sprawdź uprawnienia i spróbuj ponownie."}</AlertDescription></Alert> : null}
        <AddAttractionForm organizations={organizations} categories={categories} userId={user.id} />
      </div>
    </main>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) { return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main> }
