"use client"

import { useEffect, useMemo, useState } from "react"
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns"
import Link from "next/link"
import { AlertCircle, CalendarDays, Clock3, Loader2, ShieldCheck, Ticket, Users } from "lucide-react"

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
        const result = await response.json() as { sessions?: MarketplaceTicketingSession[]; error?: string }

        if (!response.ok) throw new Error(result.error || "Nie udało się pobrać terminów.")

        const nextSessions = result.sessions ?? []
        setSessions(nextSessions)
        setSelectedDate((currentDate) => {
          const currentDateKey = format(currentDate, "yyyy-MM-dd")
          return nextSessions.length > 0 && !nextSessions.some((session) => session.localDate === currentDateKey)
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

  const daysWithSessions = useMemo(() => new Set(sessions.map((session) => session.localDate)), [sessions])
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd")
  const selectedSessions = sessions.filter((session) => session.localDate === selectedDateKey)

  return (
    <Card className="surface-3d overflow-hidden rounded-3xl border-0 shadow-xl ring-1 ring-black/5">
      <CardHeader className="border-b bg-[#fff7f3] pb-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Ticket className="h-5 w-5 text-[#ff5a1f]" />
            Wybierz termin
          </CardTitle>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#ff5a1f] shadow-sm">Rezerwacja online</span>
        </div>
        <p className="text-sm text-muted-foreground">Data, godzina i bilety — bez dzwonienia do obiektu.</p>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex justify-center overflow-hidden rounded-2xl border bg-background p-1">
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
              available: "font-semibold after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-[#ff5a1f] relative",
              unavailable: "opacity-35",
            }}
            className="w-full border-0"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-[#ff5a1f]" />
          Pomarańczowa kropka oznacza dostępne wejścia
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl bg-muted/50 py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />Ładowanie terminów…
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : selectedSessions.length === 0 ? (
          <div className="rounded-2xl bg-muted/50 px-4 py-8 text-center">
            <CalendarDays className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="font-medium">Brak wejść w tym dniu</p>
            <p className="mt-1 text-xs text-muted-foreground">Wybierz dzień oznaczony pomarańczową kropką.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Dostępne godziny</p>
              <p className="text-xs text-muted-foreground">{format(selectedDate, "dd.MM.yyyy")}</p>
            </div>

            {selectedSessions.map((session) => (
              <div key={session.id} className="rounded-2xl border p-4 transition-colors hover:border-[#ff5a1f]/50 hover:bg-[#fffaf7]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{session.productName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />{session.localStartTime}–{session.localEndTime}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
                      <Users className="h-3.5 w-3.5" />{session.availableCapacity} miejsc
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-right">
                    <span className="text-xs text-muted-foreground">od </span>
                    <span className="font-bold">{formatMoney(session.priceFrom, session.currency)}</span>
                  </p>
                </div>
                <Button asChild className="mt-4 h-11 w-full rounded-xl bg-[#ff5a1f] font-semibold text-white hover:bg-[#e94f18]">
                  <Link href={`/checkout/${session.id}`}>Wybierz i przejdź dalej</Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Miejsca są blokowane dopiero w checkoutcie. Po płatności dostaniesz bilet z kodem QR.
        </div>
      </CardContent>
    </Card>
  )
}
