import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListFilter,
  MapPin,
  PlusCircle,
  Settings2,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  hasOrganizerRole,
  organizerManagementRoles,
  organizerSalesRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type Membership = {
  organization_id: string
  role: OrganizerRole
}

type CalendarRow = {
  session_id: string
  product_id: string
  product_name: string
  venue_id: string
  venue_name: string
  venue_city: string | null
  venue_timezone: string
  starts_at: string
  ends_at: string
  capacity: number
  reserved_capacity_units: number
  available_capacity_units: number
  booking_count: number
  session_status: string
}

const polishTimezone = "Europe/Warsaw"
const weekdays = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"]

export default async function OrganizerCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host")

  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/kalendarz")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) {
    return <CenteredMessage>Nie udało się pobrać uprawnień organizatora.</CenteredMessage>
  }

  const memberships = (membershipData ?? []) as Membership[]
  const roles = new Set(memberships.map((membership) => membership.role))
  const canView = hasOrganizerRole(roles, organizerSalesRoles)
  const canManage = hasOrganizerRole(roles, organizerManagementRoles)
  if (!canView) redirect("/host")

  const currentMonth = monthFromQuery(query.month)
  const year = currentMonth.getUTCFullYear()
  const monthIndex = currentMonth.getUTCMonth()
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
  const queryFrom = new Date(Date.UTC(year, monthIndex, 1) - 24 * 60 * 60 * 1000)
  const queryTo = new Date(Date.UTC(year, monthIndex + 1, 1) + 24 * 60 * 60 * 1000)

  const { data, error } = await supabase.rpc("ticketing_get_organizer_calendar", {
    p_from: queryFrom.toISOString(),
    p_to: queryTo.toISOString(),
  })

  if (error) {
    return <CenteredMessage>Nie udało się pobrać kalendarza terminów.</CenteredMessage>
  }

  const rows = ((data ?? []) as CalendarRow[])
    .filter((row) => localDateKey(row.starts_at, row.venue_timezone).startsWith(monthKey))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  const byDate = new Map<string, CalendarRow[]>()
  for (const row of rows) {
    const key = localDateKey(row.starts_at, row.venue_timezone)
    const existing = byDate.get(key) ?? []
    existing.push(row)
    byDate.set(key, existing)
  }

  const todayKey = localDateKey(new Date().toISOString(), polishTimezone)
  const defaultDate = todayKey.startsWith(monthKey)
    ? todayKey
    : [...byDate.keys()].sort()[0] ?? `${monthKey}-01`
  const selectedDate = query.date?.startsWith(monthKey) ? query.date : defaultDate
  const selectedRows = byDate.get(selectedDate) ?? []
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const leadingEmptyDays = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7
  const previousMonth = shiftMonth(currentMonth, -1)
  const nextMonth = shiftMonth(currentMonth, 1)
  const totalAvailable = rows.reduce((sum, row) => sum + row.available_capacity_units, 0)
  const totalReserved = rows.reduce((sum, row) => sum + row.reserved_capacity_units, 0)

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Panel organizatora
          </Link>
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/host/sprzedaz/dostepnosc"><Settings2 className="h-4 w-4" /> Reguły dostępności</Link>
            </Button>
            {canManage && (
              <Button asChild size="sm">
                <Link href="/host/rezerwacje/nowa"><PlusCircle className="h-4 w-4" /> Nowa rezerwacja</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-7 sm:py-10">
        <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="secondary">Organizer Operating System</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Kalendarz rezerwacji</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              W jednym miejscu widzisz terminy, zajętość i liczbę wolnych miejsc. Rezerwacje online, ręczne i walk-in korzystają z tej samej pojemności.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[28rem]">
            <SummaryMetric label="Terminy" value={rows.length} />
            <SummaryMetric label="Wolne miejsca" value={totalAvailable} />
            <SummaryMetric label="Zajęte miejsca" value={totalReserved} />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
          <Card className="surface-3d overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <Button asChild variant="outline" size="icon" aria-label="Poprzedni miesiąc">
                  <Link href={`/host/kalendarz?month=${monthParam(previousMonth)}`}><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="text-center">
                  <CardTitle className="capitalize">{formatMonth(currentMonth)}</CardTitle>
                  <CardDescription>Kliknij dzień, aby zobaczyć konkretne wejścia.</CardDescription>
                </div>
                <Button asChild variant="outline" size="icon" aria-label="Następny miesiąc">
                  <Link href={`/host/kalendarz?month=${monthParam(nextMonth)}`}><ChevronRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5">
              <div className="grid grid-cols-7 gap-1.5">
                {weekdays.map((weekday) => (
                  <div key={weekday} className="py-2 text-center text-xs font-semibold text-muted-foreground">{weekday}</div>
                ))}
                {Array.from({ length: leadingEmptyDays }).map((_, index) => (
                  <div key={`empty-${index}`} className="min-h-24 rounded-lg bg-muted/10" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1
                  const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`
                  const dayRows = byDate.get(dateKey) ?? []
                  const available = dayRows.reduce((sum, row) => sum + row.available_capacity_units, 0)
                  const reserved = dayRows.reduce((sum, row) => sum + row.reserved_capacity_units, 0)
                  const selected = dateKey === selectedDate
                  const isToday = dateKey === todayKey

                  return (
                    <Link
                      key={dateKey}
                      href={`/host/kalendarz?month=${monthKey}&date=${dateKey}`}
                      className={`min-h-24 rounded-lg border p-2 transition-colors hover:border-primary/50 hover:bg-primary/5 sm:min-h-28 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-background"}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm font-semibold ${isToday ? "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}`}>{day}</span>
                        {dayRows.length > 0 && <span className="text-[10px] text-muted-foreground">{dayRows.length} term.</span>}
                      </div>
                      {dayRows.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-semibold text-emerald-700">{available} wolnych</div>
                          <div className="text-[11px] text-muted-foreground">{reserved} zajętych</div>
                        </div>
                      ) : (
                        <div className="mt-3 text-[11px] text-muted-foreground">Brak terminów</div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{formatSelectedDate(selectedDate)}</CardTitle>
              <CardDescription>
                {selectedRows.length
                  ? `${selectedRows.length} ${selectedRows.length === 1 ? "termin" : "terminów"} tego dnia`
                  : "Brak zaplanowanych wejść"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedRows.length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">Ten dzień jest wolny od zaplanowanych sesji.</p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href="/host/sprzedaz/dostepnosc"><Settings2 className="h-4 w-4" /> Zmień dostępność</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedRows.map((row) => (
                    <div key={row.session_id} className="rounded-xl border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{row.product_name}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" /> {row.venue_name}{row.venue_city ? ` · ${row.venue_city}` : ""}
                          </p>
                        </div>
                        <Badge variant={row.available_capacity_units > 0 ? "secondary" : "outline"}>
                          {row.available_capacity_units > 0 ? `${row.available_capacity_units} wolnych` : "Pełny"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <InfoPill icon={Clock3}>{formatTimeRange(row.starts_at, row.ends_at, row.venue_timezone)}</InfoPill>
                        <InfoPill icon={Users}>{row.reserved_capacity_units}/{row.capacity}</InfoPill>
                        <InfoPill icon={ListFilter}>{row.booking_count} rez.</InfoPill>
                      </div>
                      {canManage && row.available_capacity_units > 0 && (
                        <Button asChild size="sm" className="mt-3 w-full">
                          <Link href={`/host/rezerwacje/nowa?session=${row.session_id}`}>
                            <PlusCircle className="h-4 w-4" /> Dodaj rezerwację
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

function InfoPill({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1 rounded-md bg-muted px-2 py-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </div>
  )
}

function monthFromQuery(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number)
    if (year >= 2020 && year <= 2100 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1))
    }
  }
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function shiftMonth(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

function monthParam(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
}

function localDateKey(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

function formatSelectedDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatTimeRange(startsAt: string, endsAt: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("pl-PL", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main>
}
