import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, Users, MapPin } from "lucide-react"
import Link from "next/link"
import BookingWidget from "@/components/booking-widget"
import type { Offer } from "@/lib/types/dynamic-fields"

// Enable ISR - revalidate every 120 seconds
export const revalidate = 120

interface OfferPageProps {
  params: Promise<{
    id: string
  }>
}

interface OfferWithPlace extends Offer {
  properties?: {
    title: string
    city: string
    country: string
    address?: string
  } | null
}

export default async function OfferPage({ params }: OfferPageProps) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()

  // Get offer details with place info
  const { data: offer } = await supabase
    .from("offers")
    .select(`
      *,
      properties!offers_place_id_fkey (
        title,
        city,
        country,
        address
      )
    `)
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if (!offer) {
    notFound()
  }

  const offerData = offer as OfferWithPlace

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/attractions" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm sm:text-base">Powrót</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Offer Title and Info */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{offerData.title}</h1>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-muted-foreground">
            {offerData.properties && (
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{offerData.properties.city}, {offerData.properties.country}</span>
              </div>
            )}
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{offerData.duration_minutes} min</span>
            </div>
            {offerData.max_participants && (
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                <span>maks. {offerData.max_participants} os.</span>
              </div>
            )}
            <Badge variant="secondary">{offerData.base_price} {offerData.currency}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Opis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {offerData.description || "Brak opisu oferty."}
                </p>
              </CardContent>
            </Card>

            {/* Offer Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Szczegóły oferty</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm sm:text-base">
                  <div>
                    <span className="text-muted-foreground">Cena bazowa:</span>
                    <p className="font-medium">{offerData.base_price} {offerData.currency} / os.</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Czas trwania:</span>
                    <p className="font-medium">{offerData.duration_minutes} minut</p>
                  </div>
                  {offerData.min_participants && (
                    <div>
                      <span className="text-muted-foreground">Min. osób:</span>
                      <p className="font-medium">{offerData.min_participants}</p>
                    </div>
                  )}
                  {offerData.max_participants && (
                    <div>
                      <span className="text-muted-foreground">Maks. osób:</span>
                      <p className="font-medium">{offerData.max_participants}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            {offerData.properties && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Lokalizacja</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{offerData.properties.title}</p>
                      {offerData.properties.address && (
                        <p className="text-sm text-muted-foreground">{offerData.properties.address}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {offerData.properties.city}, {offerData.properties.country}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Booking Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <BookingWidget offer={offerData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
