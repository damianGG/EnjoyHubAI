import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import EditAttractionForm from "@/components/edit-attraction-form"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Verify the property belongs to the user
  const { data: property } = await supabase
    .from("properties")
    .select("id, title")
    .eq("id", params.id)
    .eq("host_id", user.id)
    .single()

  if (!property) {
    redirect("/host/properties")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/host/properties" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Powrót do listy obiektów
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Edytuj obiekt</h1>
          <p className="text-muted-foreground">Zaktualizuj szczegóły swojego obiektu rozrywkowego</p>
        </div>

        <EditAttractionForm propertyId={params.id} userId={user.id} />
      </div>
    </div>
  )
}
