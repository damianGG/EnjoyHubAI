"use client"

import { useState, useEffect, useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Calendar as CalendarIcon, CheckCircle2, XCircle, Info } from "lucide-react"

interface DayAvailability {
  date: string
  isAvailable: boolean
  hasAvailability: boolean
  totalSlots: number
  bookedSlots: number
}

interface AvailabilityResponse {
  days: DayAvailability[]
}

interface AvailabilityCalendarProps {
  offerId: string
  className?: string
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

export default function AvailabilityCalendar({ offerId, className }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [availability, setAvailability] = useState<Map<string, DayAvailability>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // Memoize today's date
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Fetch availability data when month changes
  useEffect(() => {
    const fetchAvailability = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { start, end } = getMonthRange(currentMonth)
        const startDate = formatDate(start)
        const endDate = formatDate(end)

        const response = await fetch(
          `/api/offers/${offerId}/availability?startDate=${startDate}&endDate=${endDate}`
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Nie udało się pobrać dostępności")
        }

        const data: AvailabilityResponse = await response.json()
        
        // Convert array to map for quick lookup
        const availMap = new Map<string, DayAvailability>()
        data.days.forEach((day) => {
          availMap.set(day.date, day)
        })
        
        setAvailability(availMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wystąpił błąd podczas pobierania dostępności")
        setAvailability(new Map())
      } finally {
        setIsLoading(false)
      }
    }

    fetchAvailability()
  }, [currentMonth, offerId])

  // Custom modifiers for calendar styling
  const modifiers = useMemo(() => {
    const available: Date[] = []
    const fullyBooked: Date[] = []
    const noAvailability: Date[] = []

    availability.forEach((dayData) => {
      const [year, month, day] = dayData.date.split("-").map(Number)
      const date = new Date(year, month - 1, day)
      
      if (!dayData.hasAvailability) {
        noAvailability.push(date)
      } else if (dayData.isAvailable) {
        available.push(date)
      } else {
        fullyBooked.push(date)
      }
    })

    return {
      available,
      fullyBooked,
      noAvailability,
    }
  }, [availability])

  // Custom modifiers classnames
  const modifiersClassNames = {
    available: "bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-800",
    fullyBooked: "bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-800 line-through",
    noAvailability: "opacity-40",
  }

  // Get selected date info
  const selectedDateInfo = selectedDate ? availability.get(formatDate(selectedDate)) : null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Kalendarz dostępności
        </CardTitle>
        <CardDescription>
          Sprawdź dostępność oferty w wybranym terminie
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700" />
            <span>Dostępne</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700" />
            <span>Zarezerwowane</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted opacity-40 border" />
            <span>Brak oferty</span>
          </div>
        </div>

        {/* Calendar */}
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-md">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              disabled={(date) => date < today}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className="rounded-md border"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Selected date info */}
        {selectedDate && selectedDateInfo && (
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Info className="h-4 w-4" />
              Informacje o wybranym dniu
            </h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">{selectedDate.toLocaleDateString("pl-PL")}</span>
              </div>
              
              {selectedDateInfo.hasAvailability ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    {selectedDateInfo.isAvailable ? (
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Dostępne
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 border-red-300">
                        <XCircle className="h-3 w-3 mr-1" />
                        Zarezerwowane
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Rezerwacje:</span>
                    <span className="font-medium">
                      {selectedDateInfo.bookedSlots} / {selectedDateInfo.totalSlots}
                    </span>
                  </div>
                  {selectedDateInfo.isAvailable && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Wolne miejsca:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {selectedDateInfo.totalSlots - selectedDateInfo.bookedSlots}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">Oferta niedostępna</Badge>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
