import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import AttractionsView from "@/components/attractions-view"
import { TopNav } from "@/components/top-nav"
import { BottomNav } from "@/components/bottom-nav"

export const revalidate = 60

export default async function AttractionsPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-destructive">Błąd konfiguracji</h3>
            <p className="text-muted-foreground">Baza danych nie jest skonfigurowana. Skontaktuj się z administratorem.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("properties")
    .select(`
      *,
      users (
        full_name
      )
    `)
    .eq("is_active", true)

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold text-destructive">Błąd pobierania danych</h3>
            <p className="text-muted-foreground">Nie udało się pobrać listy atrakcji. Spróbuj odświeżyć stronę.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="hidden md:block">
        <TopNav />
      </div>

      <main className="mx-auto w-full max-w-[1800px] px-3 py-3 sm:px-4 sm:py-5 xl:px-6">
        <div className="mb-4 px-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Odkrywaj atrakcje</h1>
          <p className="mt-1 text-sm text-muted-foreground">Porównuj miejsca na mapie i rezerwuj bez zbędnych kroków.</p>
        </div>
        <AttractionsView attractions={data || []} />
      </main>

      <BottomNav />
    </div>
  )
}
