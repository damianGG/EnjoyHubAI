"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, Users, MapPin } from "lucide-react"
import Link from "next/link"
import BookingWidgetDemo from "@/components/booking-widget-demo"
import type { Offer } from "@/lib/types/dynamic-fields"

// Mock offer data for demo purposes
const mockOffer: Offer = {
  id: "demo-offer-123",
  place_id: "demo-place-456",
  title: "Escape Room - Tajemnica Zamku",
  description: "Wciągająca przygoda dla całej rodziny! Rozwiąż zagadki i ucieknij z zamku w 60 minut. Gra wymaga współpracy zespołowej i logicznego myślenia. Idealna na urodziny, integrację firmową lub spotkanie ze znajomymi.",
  base_price: 89,
  currency: "PLN",
  duration_minutes: 60,
  min_participants: 2,
  max_participants: 6,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export default function BookingDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm sm:text-base">Powrót</span>
          </Link>
          <Badge variant="outline" className="text-amber-600 border-amber-600">Demo</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Page Title */}
        <div className="mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
              <strong>Tryb Demo:</strong> Ta strona pokazuje jak wygląda formularz rezerwacji. 
              Wysyłanie rezerwacji wymaga podłączenia Supabase i API.
            </p>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{mockOffer.title}</h1>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-muted-foreground">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              <span>Warszawa, Polska</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{mockOffer.duration_minutes} min</span>
            </div>
            {mockOffer.max_participants && (
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                <span>maks. {mockOffer.max_participants} os.</span>
              </div>
            )}
            <Badge variant="secondary">{mockOffer.base_price} {mockOffer.currency}</Badge>
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
                  {mockOffer.description}
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
                    <p className="font-medium">{mockOffer.base_price} {mockOffer.currency} / os.</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Czas trwania:</span>
                    <p className="font-medium">{mockOffer.duration_minutes} minut</p>
                  </div>
                  {mockOffer.min_participants && (
                    <div>
                      <span className="text-muted-foreground">Min. osób:</span>
                      <p className="font-medium">{mockOffer.min_participants}</p>
                    </div>
                  )}
                  {mockOffer.max_participants && (
                    <div>
                      <span className="text-muted-foreground">Maks. osób:</span>
                      <p className="font-medium">{mockOffer.max_participants}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Lokalizacja</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Escape Room Warszawa</p>
                    <p className="text-sm text-muted-foreground">ul. Przykładowa 123</p>
                    <p className="text-sm text-muted-foreground">Warszawa, Polska</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <BookingWidgetDemo offer={mockOffer} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
