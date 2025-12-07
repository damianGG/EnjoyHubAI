"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HostCreateOfferDialog from "./host-create-offer-dialog"
import HostOfferAvailabilityManager from "./host-offer-availability-manager"
import { Clock, Users, DollarSign } from "lucide-react"
import type { Offer, OfferAvailability } from "@/lib/types/dynamic-fields"

interface HostOffersManagerProps {
  propertyId: string
  initialOffers: Offer[]
}

export default function HostOffersManager({ propertyId, initialOffers }: HostOffersManagerProps) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(
    offers.length > 0 ? offers[0].id : null
  )
  const [availabilityData, setAvailabilityData] = useState<Record<string, OfferAvailability[]>>({})
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)

  const fetchOffers = async () => {
    try {
      const response = await fetch("/api/host/offers")
      if (response.ok) {
        const data = await response.json()
        const propertyOffers = data.filter((o: Offer) => o.place_id === propertyId)
        setOffers(propertyOffers)
        if (propertyOffers.length > 0 && !selectedOfferId) {
          setSelectedOfferId(propertyOffers[0].id)
        }
      }
    } catch (error) {
      console.error("Error fetching offers:", error)
    }
  }

  const fetchAvailability = async (offerId: string) => {
    if (availabilityData[offerId]) return // Already loaded

    setIsLoadingAvailability(true)
    try {
      const response = await fetch(`/api/host/offers/${offerId}/availability`)
      if (response.ok) {
        const data = await response.json()
        setAvailabilityData(prev => ({ ...prev, [offerId]: data }))
      }
    } catch (error) {
      console.error("Error fetching availability:", error)
    } finally {
      setIsLoadingAvailability(false)
    }
  }

  useEffect(() => {
    if (selectedOfferId) {
      fetchAvailability(selectedOfferId)
    }
  }, [selectedOfferId])

  const handleOfferCreated = () => {
    fetchOffers()
  }

  const handleAvailabilitySaved = () => {
    if (selectedOfferId) {
      // Refresh availability data
      setAvailabilityData(prev => {
        const newData = { ...prev }
        delete newData[selectedOfferId]
        return newData
      })
      fetchAvailability(selectedOfferId)
    }
  }

  const selectedOffer = offers.find(o => o.id === selectedOfferId)

  return (
    <div className="space-y-6">
      {/* Create Offer Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Oferty usług</CardTitle>
              <CardDescription>
                Zarządzaj ofertami aktywności i usług dla gości
              </CardDescription>
            </div>
            <HostCreateOfferDialog propertyId={propertyId} onOfferCreated={handleOfferCreated} />
          </div>
        </CardHeader>
        {offers.length > 0 && (
          <CardContent>
            <Tabs value={selectedOfferId || undefined} onValueChange={setSelectedOfferId}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {offers.map((offer) => (
                  <TabsTrigger key={offer.id} value={offer.id} className="flex-shrink-0">
                    {offer.title}
                    {offer.is_active && (
                      <Badge variant="default" className="ml-2">
                        Aktywna
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {offers.map((offer) => (
                <TabsContent key={offer.id} value={offer.id} className="mt-6 space-y-6">
                  {/* Offer Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Szczegóły oferty</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {offer.description && (
                        <p className="text-sm text-muted-foreground">{offer.description}</p>
                      )}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Cena bazowa</p>
                            <p className="text-lg font-bold">
                              {offer.base_price} {offer.currency}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Czas trwania</p>
                            <p className="text-lg font-bold">{offer.duration_minutes} min</p>
                          </div>
                        </div>
                        {offer.max_participants && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Maks. uczestników</p>
                              <p className="text-lg font-bold">{offer.max_participants}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Availability Configuration */}
                  {!isLoadingAvailability && (
                    <HostOfferAvailabilityManager
                      offerId={offer.id}
                      durationMinutes={offer.duration_minutes}
                      initialAvailability={availabilityData[offer.id] || []}
                      onSaved={handleAvailabilitySaved}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        )}
      </Card>

      {offers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nie masz jeszcze żadnych ofert. Utwórz pierwszą ofertę, aby móc konfigurować dostępność i przyjmować rezerwacje.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
