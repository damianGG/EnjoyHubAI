import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import AttractionsView from "@/components/attractions-view"
import { DiscoveryChrome } from "@/components/discovery-chrome"

export const revalidate = 60

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function AttractionsPage() {
  let data: any[] = []
  let errorMessage: string | null = null

  if (!isSupabaseConfigured) {
    errorMessage = "Baza danych nie jest skonfigurowana w tym środowisku preview."
  } else {
    try {
      const supabase = createClient()
      const result = await supabase
        .from("properties")
        .select(`
          *,
          users (
            full_name
          ),
          categories (
            slug,
            icon,
            image_url
          ),
          subcategories (
            slug,
            icon,
            image_url
          )
        `)
        .eq("is_active", true)

      if (result.error) {
        errorMessage = "Nie udało się pobrać listy atrakcji w tym środowisku."
      } else {
        data = (result.data || []).map((row: any) => {
          const category = firstRelation(row.categories)
          const subcategory = firstRelation(row.subcategories)

          return {
            ...row,
            category_slug: category?.slug ?? null,
            category_icon: category?.icon ?? null,
            category_image_url: category?.image_url ?? null,
            subcategory_slug: subcategory?.slug ?? null,
            subcategory_icon: subcategory?.icon ?? null,
            subcategory_image_url: subcategory?.image_url ?? null,
          }
        })
      }
    } catch {
      errorMessage = "Nie udało się połączyć z bazą danych w tym środowisku."
    }
  }

  return (
    <DiscoveryChrome>
      <main className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-4 sm:py-7 xl:px-6">
        <div className="mb-5 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Mapa EnjoyHub</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">Odkrywaj atrakcje</h1>
            <p className="mt-1 text-sm text-muted-foreground">Porównuj miejsca, ceny i dostępność bezpośrednio na mapie.</p>
          </div>
        </div>

        {errorMessage ? (
          <Card className="mb-5 border-primary/15 bg-secondary/60 shadow-none">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Podgląd nowego interfejsu jest aktywny</p>
                <p className="mt-0.5 text-muted-foreground">{errorMessage} Połączenie danych można naprawić niezależnie od warstwy wizualnej.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <AttractionsView attractions={data} />
      </main>
    </DiscoveryChrome>
  )
}
