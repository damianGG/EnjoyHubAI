"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Clock, Calendar as CalendarIcon } from "lucide-react"
import { format, addDays } from "date-fns"

interface SlotAvailabilityWidgetProps {
  propertyId: string
}

interface SlotResponse {
  next_available_slot: {
    date: string
    startTime: string
  } | null
  price_from: number | null
  offerId: string | null
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${day}.${month}.${year}`
}

export default function SlotAvailabilityWidget({ propertyId }: SlotAvailabilityWidgetProps) {
  const router = useRouter()
  
  // Date selection - initialize as undefined to avoid hydration mismatch
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  
  // Set default date after mount to avoid hydration issues
  useEffect(() => {
    setSelectedDate(new Date())
  }, [])
  
  // Memoize today's date for calendar disabled check
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  
  // Slot data state
  const [slotData, setSlotData] = useState<SlotResponse | null>(null)
  const [isLoadingSlot, setIsLoadingSlot] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)

  // Fetch slot when date changes
  useEffect(() => {
    if (!selectedDate) {
      setSlotData(null)
      return
    }

    const fetchSlot = async () => {
      setIsLoadingSlot(true)
      setSlotError(null)

      try {
        const dateStart = format(selectedDate, "yyyy-MM-dd")
        const dateEnd = format(addDays(selectedDate, 90), "yyyy-MM-dd")
        
        const response = await fetch(
          `/api/properties/${propertyId}/slots?date_start=${dateStart}&date_end=${dateEnd}`
        )
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Nie udało się pobrać dostępnych terminów")
        }

        const data: SlotResponse = await response.json()
        setSlotData(data)
      } catch (error) {
        setSlotError(error instanceof Error ? error.message : "Wystąpił błąd podczas pobierania terminów")
        setSlotData(null)
      } finally {
        setIsLoadingSlot(false)
      }
    }

    fetchSlot()
  }, [selectedDate, propertyId])

  const handleReserve = () => {
    if (slotData?.offerId) {
      router.push(`/offers/${slotData.offerId}`)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Dostępne terminy wizyt</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date Picker */}
        <div>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < today}
              className="rounded-md border"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoadingSlot && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Sprawdzanie dostępności...</span>
          </div>
        )}

        {/* Error State */}
        {slotError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{slotError}</AlertDescription>
          </Alert>
        )}

        {/* Slot Information */}
        {!isLoadingSlot && !slotError && slotData && (
          <>
            {slotData.next_available_slot ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      Najbliższy dostępny termin:
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {formatDisplayDate(slotData.next_available_slot.date)} - {slotData.next_available_slot.startTime}
                      </span>
                    </div>
                    {slotData.price_from && (
                      <span className="font-bold text-primary">
                        od {slotData.price_from} zł
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleReserve}
                  className="w-full"
                  size="lg"
                >
                  Zarezerwuj
                </Button>
              </div>
            ) : (
              <div className="rounded-md bg-muted py-6 text-center">
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
