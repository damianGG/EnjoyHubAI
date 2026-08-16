"use client"

import { useEffect, useMemo, useState } from "react"
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns"
import Link from "next/link"
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Loader2,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney } from "@/lib/ticketing/format"
import type { MarketplaceTicketingSession } from "@/lib/ticketing/marketplace"

interface MarketplaceCalendarProps {
  propertyId: string
}

export function MarketplaceCalendar({ propertyId }: MarketplaceCalendarProps) {
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const [selectedDate, setSelectedDate] = useState(today)
  const [displayedMonth, setDisplayedMonth] = useState(today)
  const [sessions, setSessions] = useState<MarketplaceTicketingSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const start = format(startOfMonth(displayedMonth), "yyyy-MM-dd")
    const end = format(endOfMonth(displayedMonth), "yyyy-MM-dd")

    async function loadSessions() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/ticketing/properties/${propertyId}/sessions?start=${start}&end=${end}`,
          { cache: "no-store", signal: controller.signal },
        )
        const result = await response.json() as {
          sessions?: MarketplaceTicketingSession[]
          error?: string
        }

        if (!response.ok) {
          throw new Error(result.error || "Nie udało się pobrać terminów.")
        }

        const nextSessions = result.sessions ?? []
        setSessions(nextSessions)
        setSelectedDate((currentDate) => {
          const currentDateKey = format(currentDate, "yyyy-MM-dd")
          return nextSessions.length > 0
            && !nextSessions.some((session) => session.localDate === currentDateKey)
            ? parseISO(nextSessions[0].localDate)
            : currentDate
        })
      } catch (loadError) {
        if (controller.signal.aborted) return
        setSessions([])
        setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać terminów.")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadSessions()
    return () => controller.abort()
  }, [displayedMonth, propertyId])

  const daysWithSessions = useMemo(
    () => new Set(sessions.map((session) => session.localDate)),
    [sessions],
  )
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd")
  const selectedSessions = sessions.filter((session) => session.localDate === selectedDateKey)

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Ticket className="h-5 w-5 text-primary" />
          Kup bilety
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            onMonthChange={setDisplayedMonth}
            disabled={(date) => date < today}
            modifiers={{
              available: (date) => daysWithSessions.has(format(date, "yyyy-MM-dd")),
              unavailable: (date) => date >= today && !daysWithSessions.has(format(date, "yyyy-MM-dd")),
            }}
            modifiersClassNames={{
              available: "bg-emerald-100 font-semibold text-emerald-950 dark:bg-emerald-900/30 dark:text-emerald-100",
              unavailable: "opacity-40",
            }}
            className="rounded-md border"
          />
        </div>

        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/30" />
          Dzień z biletami dostępnymi w sprzedaży
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Ładowanie terminów…
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : selectedSessions.length === 0 ? (
          <div className="rounded-md bg-muted px-4 py-8 text-center">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Brak biletów na wybrany dzień</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">Dostępne wejścia</p>
            {selectedSessions.map((session) => (
              <Card key={session.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{session.productName}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        {session.localStartTime}–{session.localEndTime}
                      </p>
                    </div>
                    <p className="whitespace-nowrap font-semibold text-primary">
                      od {formatMoney(session.priceFrom, session.currency)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                      <Users className="h-3.5 w-3.5" />
                      {session.availableCapacity} miejsc dostępnych
                    </p>
                    <Button asChild size="sm">
                      <Link href={`/checkout/${session.id}`}>Wybierz bilety</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>Miejsce zostanie atomowo zablokowane w checkoutcie, a po płatności otrzymasz bilet QR.</span>
        </div>
      </CardContent>
    </Card>
  )
}
