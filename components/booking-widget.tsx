"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle, AlertCircle, Clock, Users, Calendar as CalendarIcon } from "lucide-react"
import type { Slot, SlotsResponse, Offer } from "@/lib/types/dynamic-fields"

interface BookingWidgetProps {
  offer: Offer
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

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${day}.${month}.${year}`
}

export default function BookingWidget({ offer }: BookingWidgetProps) {
  // Date selection
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  
  // Slots state
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  
  // Selected slot
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  
  // Booking form
  const [formData, setFormData] = useState<BookingFormData>({
    persons: 1,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  })
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState<BookingResponse | null>(null)

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate) {
      setSlots([])
      setSelectedSlot(null)
      return
    }

    const fetchSlots = async () => {
      setIsLoadingSlots(true)
      setSlotsError(null)
      setSelectedSlot(null)

      try {
        const dateStr = formatDate(selectedDate)
        const response = await fetch(`/api/offers/${offer.id}/slots?date=${dateStr}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Nie udało się pobrać dostępnych terminów")
        }

        const data: SlotsResponse = await response.json()
        setSlots(data.slots)
      } catch (error) {
        setSlotsError(error instanceof Error ? error.message : "Wystąpił błąd podczas pobierania terminów")
        setSlots([])
      } finally {
        setIsLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [selectedDate, offer.id])

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseInt(value, 10) || 1 : value,
    }))
  }

  // Handle slot selection
  const handleSlotSelect = (slot: Slot) => {
    if (slot.available) {
      setSelectedSlot(slot)
      setSubmitError(null)
    }
  }

  // Handle booking submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedDate || !selectedSlot) {
      setSubmitError("Wybierz datę i godzinę")
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
          offerId: offer.id,
          date: formatDate(selectedDate),
          startTime: selectedSlot.startTime,
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
      setBookingSuccess(booking)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Wystąpił błąd podczas rezerwacji")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form after successful booking
  const handleResetForm = () => {
    setBookingSuccess(null)
    setSelectedSlot(null)
    setFormData({
      persons: 1,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
    })
    setSelectedDate(new Date())
  }

  // Calculate final price
  const finalPrice = formData.persons * offer.base_price

  // If booking was successful, show confirmation
  if (bookingSuccess) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-xl text-green-600">Rezerwacja przyjęta!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatDisplayDate(bookingSuccess.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{bookingSuccess.startTime} - {bookingSuccess.endTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{bookingSuccess.persons} {bookingSuccess.persons === 1 ? "osoba" : bookingSuccess.persons < 5 ? "osoby" : "osób"}</span>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Informacja o płatności</AlertTitle>
            <AlertDescription>
              Płatność na miejscu. Prosimy o przybycie 10 minut przed zarezerwowaną godziną.
            </AlertDescription>
          </Alert>

          <Button onClick={handleResetForm} variant="outline" className="w-full">
            Dokonaj kolejnej rezerwacji
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Zarezerwuj termin</span>
          <div className="text-right">
            <span className="text-2xl font-bold">{offer.base_price} {offer.currency}</span>
            <span className="text-sm text-muted-foreground"> / os.</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Date Picker */}
        <div>
          <Label className="mb-2 block text-sm font-medium">Wybierz datę</Label>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border"
            />
          </div>
        </div>

        {/* Time Slots */}
        <div>
          <Label className="mb-2 block text-sm font-medium">
            Dostępne godziny {selectedDate && `(${formatDisplayDate(formatDate(selectedDate))})`}
          </Label>

          {isLoadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Ładowanie terminów...</span>
            </div>
          ) : slotsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{slotsError}</AlertDescription>
            </Alert>
          ) : slots.length === 0 ? (
            <div className="rounded-md bg-muted py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Brak dostępnych terminów w wybranym dniu
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <Button
                  key={slot.startTime}
                  type="button"
                  variant={selectedSlot?.startTime === slot.startTime ? "default" : "outline"}
                  disabled={!slot.available}
                  onClick={() => handleSlotSelect(slot)}
                  className={`relative ${!slot.available ? "opacity-50" : ""}`}
                >
                  <span>{slot.startTime}</span>
                  {!slot.available && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-destructive text-white px-1 rounded">
                      pełne
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Booking Form - visible when date and slot are selected */}
        {selectedDate && selectedSlot && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-4">Dane rezerwacji</h3>

              {/* Number of persons */}
              <div className="mb-4">
                <Label htmlFor="persons" className="text-sm">
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
                  className="mt-1"
                />
              </div>

              {/* Customer name */}
              <div className="mb-4">
                <Label htmlFor="customerName" className="text-sm">
                  Imię i nazwisko
                </Label>
                <Input
                  id="customerName"
                  name="customerName"
                  type="text"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Jan Kowalski"
                  className="mt-1"
                  required
                />
              </div>

              {/* Customer email */}
              <div className="mb-4">
                <Label htmlFor="customerEmail" className="text-sm">
                  E-mail
                </Label>
                <Input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={handleInputChange}
                  placeholder="jan@example.com"
                  className="mt-1"
                  required
                />
              </div>

              {/* Customer phone */}
              <div className="mb-4">
                <Label htmlFor="customerPhone" className="text-sm">
                  Telefon
                </Label>
                <Input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  placeholder="+48 123 456 789"
                  className="mt-1"
                  required
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium text-sm">Podsumowanie</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Oferta:</span>
                  <span>{offer.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span>{formatDisplayDate(formatDate(selectedDate))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Godzina:</span>
                  <span>{selectedSlot.startTime} - {selectedSlot.endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Osoby:</span>
                  <span>{formData.persons}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2 font-medium">
                  <span>Do zapłaty:</span>
                  <span>{finalPrice} {offer.currency}</span>
                </div>
              </div>
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
        )}
      </CardContent>
    </Card>
  )
}
