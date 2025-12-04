import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import AvailabilityManager from "@/components/availability-manager"

interface AvailabilityPageProps {
  params: {
    id: string
  }
}

export default async function PropertyAvailabilityPage({ params }: AvailabilityPageProps) {
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

  // Get property details
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", params.id)
    .eq("host_id", user.id)
    .single()

  if (!property) {
    notFound()
  }

  // Get existing availability configuration
  const { data: availability } = await supabase
    .from("attraction_availability")
    .select("*")
    .eq("property_id", params.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href={`/host/properties/${params.id}`} className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Property</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Availability & Pricing</h1>
            <p className="text-muted-foreground">
              Manage booking settings, block dates, and set seasonal pricing for {property.title}
            </p>
          </div>

          <AvailabilityManager 
            propertyId={params.id}
            initialAvailability={availability}
            basePrice={property.price_per_night}
          />
        </div>
      </div>
    </div>
  )
}
