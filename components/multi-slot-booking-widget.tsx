"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Calendar as CalendarIcon, Users } from "lucide-react"
import { format, addDays, startOfMonth, endOfMonth } from "date-fns"
import { cn } from "@/lib/utils"

interface MultiSlotBookingWidgetProps {
  propertyId: string
}

interface TimeSlot {
  time: string
  available: boolean
  capacity: number
  bookedCount: number
  offerId: string
}

interface AvailableSlots {
  date: string
  slots: TimeSlot[]
  price: number
  currency: string
}

export default function MultiSlotBookingWidget({ propertyId }: MultiSlotBookingWidgetProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [availableSlots, setAvailableSlots] = useState<AvailableSlots | null>(null)
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [numberOfPeople, setNumberOfPeople] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [daysWithSlots, setDaysWithSlots] = useState<Set<string>>(new Set())
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Fetch days with available slots for the current month
  useEffect(() => {
    const fetchMonthAvailability = async () => {
      try {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        
        const response = await fetch(
          `/api/properties/${propertyId}/month-availability?start=${format(monthStart, "yyyy-MM-dd")}&end=${format(monthEnd, "yyyy-MM-dd")}`
        )

        if (response.ok) {
          const data = await response.json()
          setDaysWithSlots(new Set(data.daysWithSlots || []))
        }
      } catch (error) {
        console.error("Error fetching month availability:", error)
      }
    }

    fetchMonthAvailability()
  }, [currentMonth, propertyId])

  // Fetch available slots for selected date
  useEffect(() => {
    const fetchSlots = async () => {
      setIsLoading(true)
      setError(null)
      setSelectedSlots([])

      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        const response = await fetch(
          `/api/properties/${propertyId}/day-slots?date=${dateStr}`
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Nie udało się pobrać dostępnych terminów")
        }

        const data: AvailableSlots = await response.json()
        setAvailableSlots(data)
      } catch (error) {
        setError(error instanceof Error ? error.message : "Wystąpił błąd podczas pobierania terminów")
        setAvailableSlots(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSlots()
  }, [selectedDate, propertyId])

  const handleSlotClick = (slotTime: string, isAvailable: boolean) => {
    if (!isAvailable) return

    setSelectedSlots((prev) => {
      if (prev.includes(slotTime)) {
        // Deselect
        return prev.filter((t) => t !== slotTime)
      } else {
        // Select - add in sorted order
        const newSlots = [...prev, slotTime].sort()
        return newSlots
      }
    })
  }

  const isSlotSelected = (slotTime: string) => selectedSlots.includes(slotTime)

  const calculateTotalPrice = () => {
    if (!availableSlots) return 0
    return selectedSlots.length * availableSlots.price
  }

  const handleBooking = () => {
    if (selectedSlots.length === 0 || !availableSlots) return

    const firstSlot = availableSlots.slots.find((s) => s.time === selectedSlots[0])
    if (!firstSlot) return

    // Navigate to booking page with selected slots and people count
    const queryParams = new URLSearchParams({
      date: format(selectedDate, "yyyy-MM-dd"),
      slots: selectedSlots.join(","),
      people: numberOfPeople.toString(),
    })

    router.push(`/offers/${firstSlot.offerId}/book?${queryParams.toString()}`)
  }

  // Check if selected slots are consecutive
  const areSlotConsecutive = () => {
    if (selectedSlots.length <= 1) return true

    const sortedSlots = [...selectedSlots].sort()
    for (let i = 1; i < sortedSlots.length; i++) {
      const prevMinutes = timeToMinutes(sortedSlots[i - 1])
      const currMinutes = timeToMinutes(sortedSlots[i])
      if (currMinutes - prevMinutes !== 30) {
        return false
      }
    }
    return true
  }

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
  }

  const formatTimeRange = () => {
    if (selectedSlots.length === 0) return ""
    const sortedSlots = [...selectedSlots].sort()
    const startTime = sortedSlots[0]
    const lastSlotMinutes = timeToMinutes(sortedSlots[sortedSlots.length - 1])
    const endTime = `${Math.floor((lastSlotMinutes + 30) / 60)
      .toString()
      .padStart(2, "0")}:${((lastSlotMinutes + 30) % 60).toString().padStart(2, "0")}`
    return `${startTime} - ${endTime}`
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Rezerwacja</CardTitle>
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
              onMonthChange={setCurrentMonth}
              modifiers={{
                hasSlots: (date) => {
                  const dateStr = format(date, "yyyy-MM-dd")
                  return daysWithSlots.has(dateStr)
                },
                noSlots: (date) => {
                  const dateStr = format(date, "yyyy-MM-dd")
                  return date >= today && !daysWithSlots.has(dateStr)
                }
              }}
              modifiersClassNames={{
                hasSlots: "bg-green-100 dark:bg-green-900/30 font-semibold",
                noSlots: "opacity-40 line-through"
              }}
              className="rounded-md border"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            <span className="inline-block w-3 h-3 bg-green-100 dark:bg-green-900/30 rounded mr-1"></span>
            Dostępne terminy
          </p>
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

        {/* Available Slots */}
        {!isLoading && !error && availableSlots && (
          <>
            {availableSlots.slots.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Wybierz sloty (kliknij jeden lub więcej)
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableSlots.slots.map((slot) => {
                      const isAvailable = slot.available && slot.capacity > slot.bookedCount
                      const isSelected = isSlotSelected(slot.time)
                      
                      return (
                        <button
                          key={slot.time}
                          onClick={() => handleSlotClick(slot.time, isAvailable)}
                          disabled={!isAvailable}
                          className={cn(
                            "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            isSelected && "bg-primary text-primary-foreground ring-2 ring-primary",
                            !isSelected && isAvailable && "bg-muted hover:bg-muted/80",
                            !isAvailable && "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50"
                          )}
                        >
                          {slot.time}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Każdy slot trwa 30 minut. Możesz wybrać kilka kolejnych slotów.
                  </p>
                </div>

                {selectedSlots.length > 0 && (
                  <>
                    {!areSlotConsecutive() && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Wybrane sloty muszą być kolejne (następujące po sobie)
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="rounded-lg bg-muted p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Wybrane sloty:</span>
                        <span className="font-semibold">{selectedSlots.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Czas:</span>
                        <span className="font-semibold">{formatTimeRange()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Cena:</span>
                        <span className="font-bold text-lg">
                          {calculateTotalPrice()} {availableSlots.currency}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="people">Liczba osób</Label>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Input
                          id="people"
                          type="number"
                          min="1"
                          value={numberOfPeople}
                          onChange={(e) => setNumberOfPeople(parseInt(e.target.value) || 1)}
                          className="max-w-[100px]"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleBooking}
                      className="w-full"
                      size="lg"
                      disabled={!areSlotConsecutive()}
                    >
                      Zarezerwuj {selectedSlots.length} slot(y) na {numberOfPeople} os.
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-muted py-8 text-center">
                <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Brak dostępnych terminów w tym dniu
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
