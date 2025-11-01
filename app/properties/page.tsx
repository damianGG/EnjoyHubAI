import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import PropertiesView from "@/components/properties-view"

export default async function PropertiesPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-destructive">Błąd konfiguracji</h3>
            <p className="text-muted-foreground">
              Baza danych nie jest skonfigurowana. Skontaktuj się z administratorem.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const supabase = createClient()

  // Get all active properties with user information
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
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-destructive">Błąd pobierania danych</h3>
            <p className="text-muted-foreground">
              Wystąpił błąd podczas pobierania listy nieruchomości. Spróbuj odświeżyć stronę.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Wszystkie obiekty</h1>
      </div>

      <section>
        <PropertiesView properties={data || []} />
      </section>
    </div>
  )
}
