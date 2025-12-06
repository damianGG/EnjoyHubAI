import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import OfferAvailabilityManager from "@/components/offer-availability-manager"

interface OfferAvailabilityPageProps {
  params: Promise<{ offerId: string }> | { offerId: string }
}

export default async function OfferAvailabilityPage({ params }: OfferAvailabilityPageProps) {
  // Await params if it's a Promise (Next.js 15+)
  const resolvedParams = await Promise.resolve(params)

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is super admin
  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (userData?.role !== "super_admin") {
    redirect("/dashboard")
  }

  // Get offer details
  const { data: offer } = await supabase
    .from("offers")
    .select(`
      id,
      title,
      place_id,
      duration_minutes
    `)
    .eq("id", resolvedParams.offerId)
    .single()

  if (!offer) {
    notFound()
  }

  // Get existing availability configuration
  const { data: availability } = await supabase
    .from("offer_availability")
    .select("*")
    .eq("offer_id", resolvedParams.offerId)
    .order("weekday")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/admin/properties"
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Properties</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Set Availability</h1>
            <p className="text-muted-foreground">
              Configure weekly availability schedule for: {offer.title}
            </p>
          </div>

          <OfferAvailabilityManager 
            offerId={resolvedParams.offerId}
            durationMinutes={offer.duration_minutes}
            initialAvailability={availability || []}
          />
        </div>
      </div>
    </div>
  )
}
