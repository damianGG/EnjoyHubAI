"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Clock, Calendar as CalendarIcon } from "lucide-react"
import { format, addDays } from "date-fns"
import { formatDisplayDate } from "@/lib/utils"

const SLOT_SEARCH_RANGE_DAYS = 30

interface SlotAvailabilityWidgetProps {
  propertyId: string
}

interface SlotData {
  next_available_slot: {
    date: string
    startTime: string
  } | null
  price_from: number | null
  offerId: string | null
}

export default function SlotAvailabilityWidget({ propertyId }: SlotAvailabilityWidgetProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [slotData, setSlotData] = useState<SlotData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Memoize today's date for calendar disabled check
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Fetch slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const dateStart = format(selectedDate, "yyyy-MM-dd")
        // Query for a configurable range from selected date
        const dateEnd = format(addDays(selectedDate, SLOT_SEARCH_RANGE_DAYS), "yyyy-MM-dd")
        
        const response = await fetch(
          `/api/properties/${propertyId}/slots?date_start=${dateStart}&date_end=${dateEnd}`
        )

        if (!response.ok) {
          let errorMessage = "Nie udało się pobrać dostępnych terminów"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // If JSON parsing fails, use default error message
          }
          throw new Error(errorMessage)
        }

        const data: SlotData = await response.json()
        setSlotData(data)
      } catch (error) {
        setError(error instanceof Error ? error.message : "Wystąpił błąd podczas pobierania terminów")
        setSlotData(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSlots()
  }, [selectedDate, propertyId])

  const handleBooking = () => {
    if (slotData?.offerId && slotData.next_available_slot) {
      const { date, startTime } = slotData.next_available_slot
      router.push(`/offers/${slotData.offerId}/book?date=${date}&time=${startTime}`)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg sm:text-xl">Dostępne terminy</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date Picker */}
        <div>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < today}
              className="rounded-md border"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Ładowanie terminów...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Slot Information */}
        {!isLoading && !error && slotData && (
          <>
            {slotData.next_available_slot ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {formatDisplayDate(slotData.next_available_slot.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{slotData.next_available_slot.startTime}</span>
                  </div>
                  {slotData.price_from && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <span className="text-muted-foreground text-sm">Cena od:</span>
                      <span className="font-bold text-lg">{slotData.price_from} PLN</span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleBooking}
                  className="w-full"
                  size="lg"
                  disabled={!slotData.offerId}
                >
                  Zarezerwuj
                </Button>
              </div>
            ) : (
              <div className="rounded-md bg-muted py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Brak dostępnych terminów w wybranym okresie
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
