"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Clock, Users, Calendar as CalendarIcon, MapPin, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { Offer } from "@/lib/types/dynamic-fields"
import { timeToMinutes, minutesToTime, formatDisplayDate } from "@/lib/utils"

interface OfferWithPlace extends Offer {
  properties?: {
    title: string
    city: string
    country: string
  } | null
}

interface BookingFormData {
  persons: number
  customerName: string
  customerEmail: string
  customerPhone: string
}

interface BookingResponse {
  id: string
  status: string
  paymentStatus: string
  date: string
  startTime: string
  endTime: string
  persons: number
  offerId: string
  placeId: string
}

export default function BookOfferPage({ params }: { params: Promise<{ offerId: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [offerId, setOfferId] = useState<string>("")
  const [offer, setOffer] = useState<OfferWithPlace | null>(null)
  const [isLoadingOffer, setIsLoadingOffer] = useState(true)
  const [offerError, setOfferError] = useState<string | null>(null)

  // Get query params
  const dateParam = searchParams.get("date")
  const timeParam = searchParams.get("time")

  // Form state
  const [formData, setFormData] = useState<BookingFormData>({
    persons: 1,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  })

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Resolve params
  useEffect(() => {
    params.then((p) => setOfferId(p.offerId))
  }, [params])

  // Fetch offer details
  useEffect(() => {
    if (!offerId) return

    const fetchOffer = async () => {
      setIsLoadingOffer(true)
      setOfferError(null)

      try {
        const response = await fetch(`/api/offers/${offerId}`)
        
        if (!response.ok) {
          throw new Error("Nie udało się pobrać danych oferty")
        }

        const data: OfferWithPlace = await response.json()
        setOffer(data)
      } catch (error) {
        setOfferError(error instanceof Error ? error.message : "Wystąpił błąd podczas pobierania oferty")
      } finally {
        setIsLoadingOffer(false)
      }
    }

    fetchOffer()
  }, [offerId])

  // Calculate end time
  const endTime = offer && timeParam 
    ? minutesToTime(timeToMinutes(timeParam) + offer.duration_minutes)
    : ""

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Math.max(1, parseInt(value, 10) || 1) : value,
    }))
  }

  // Handle booking submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dateParam || !timeParam) {
      setSubmitError("Brak wymaganej daty lub godziny")
      return
    }

    if (!formData.customerName.trim() || !formData.customerEmail.trim() || !formData.customerPhone.trim()) {
      setSubmitError("Wypełnij wszystkie pola formularza")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offerId: offerId,
          date: dateParam,
          startTime: timeParam,
          persons: formData.persons,
          customerName: formData.customerName.trim(),
          customerEmail: formData.customerEmail.trim(),
          customerPhone: formData.customerPhone.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Nie udało się dokonać rezerwacji")
      }

      const booking: BookingResponse = await response.json()
      // Redirect to confirmation page
      router.push(`/offers/bookings/${booking.id}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Wystąpił błąd podczas rezerwacji")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate final price
  const finalPrice = offer ? formData.persons * offer.base_price : 0

  // Validation: check if date and time params exist
  if (!dateParam || !timeParam) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/attractions" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm sm:text-base">Powrót</span>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Brak wymaganej daty lub godziny. Proszę wybrać slot z dostępnych terminów.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoadingOffer) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/attractions" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm sm:text-base">Powrót</span>
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Error state
  if (offerError || !offer) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/attractions" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm sm:text-base">Powrót</span>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {offerError || "Nie znaleziono oferty"}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/offers/${offerId}`} className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm sm:text-base">Powrót do oferty</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-3xl">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Rezerwacja</h1>
          <p className="text-muted-foreground">{offer.title}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Szczegóły rezerwacji</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Selected Date and Time - Display Only */}
                  <div className="rounded-lg bg-muted p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{formatDisplayDate(dateParam)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{timeParam} - {endTime}</span>
                    </div>
                    {offer.properties && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{offer.properties.city}, {offer.properties.country}</span>
                      </div>
                    )}
                  </div>

                  {/* Number of persons */}
                  <div>
                    <Label htmlFor="persons" className="text-sm font-medium">
                      Liczba osób
                    </Label>
                    <Input
                      id="persons"
                      name="persons"
                      type="number"
                      min={1}
                      max={offer.max_participants || 99}
                      value={formData.persons}
                      onChange={handleInputChange}
                      className="mt-2"
                    />
                  </div>

                  {/* Customer name */}
                  <div>
                    <Label htmlFor="customerName" className="text-sm font-medium">
                      Imię i nazwisko
                    </Label>
                    <Input
                      id="customerName"
                      name="customerName"
                      type="text"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="Jan Kowalski"
                      className="mt-2"
                      required
                    />
                  </div>

                  {/* Customer email */}
                  <div>
                    <Label htmlFor="customerEmail" className="text-sm font-medium">
                      E-mail
                    </Label>
                    <Input
                      id="customerEmail"
                      name="customerEmail"
                      type="email"
                      value={formData.customerEmail}
                      onChange={handleInputChange}
                      placeholder="jan@example.com"
                      className="mt-2"
                      required
                    />
                  </div>

                  {/* Customer phone */}
                  <div>
                    <Label htmlFor="customerPhone" className="text-sm font-medium">
                      Telefon
                    </Label>
                    <Input
                      id="customerPhone"
                      name="customerPhone"
                      type="tel"
                      value={formData.customerPhone}
                      onChange={handleInputChange}
                      placeholder="+48 123 456 789"
                      className="mt-2"
                      required
                    />
                  </div>

                  {/* Error message */}
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Submit button */}
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Przetwarzanie...
                      </>
                    ) : (
                      "Potwierdź rezerwację"
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Płatność na miejscu • Możliwość bezpłatnego odwołania do 24h przed terminem
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg">Podsumowanie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Oferta:</span>
                    <span className="font-medium text-right">{offer.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium">{formatDisplayDate(dateParam)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Godzina:</span>
                    <span className="font-medium">{timeParam} - {endTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Czas trwania:</span>
                    <span className="font-medium">{offer.duration_minutes} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Osoby:</span>
                    <span className="font-medium">{formData.persons}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2 mt-2">
                    <span className="font-medium">Do zapłaty:</span>
                    <span className="font-bold text-lg">{finalPrice} {offer.currency}</span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{offer.base_price} {offer.currency} / os.</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
