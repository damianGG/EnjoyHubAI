import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import HostOffersManager from "@/components/host-offers-manager"

interface OffersPageProps {
  params: Promise<{ id: string }> | { id: string }
}

export default async function PropertyOffersPage({ params }: OffersPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const resolvedParams = await Promise.resolve(params)
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get property details
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", resolvedParams.id)
    .eq("host_id", user.id)
    .single()

  if (!property) {
    notFound()
  }

  // Get all offers for this property
  const { data: offers } = await supabase
    .from("offers")
    .select("*")
    .eq("place_id", resolvedParams.id)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link
            href={`/host/properties/${resolvedParams.id}`}
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Powrót do obiektu</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Zarządzaj ofertami i dostępnością</h1>
            <p className="text-muted-foreground">
              Dodaj oferty usług oraz skonfiguruj dostępność dla: {property.title}
            </p>
          </div>

          <HostOffersManager propertyId={resolvedParams.id} initialOffers={offers || []} />
        </div>
      </div>
    </div>
  )
}
