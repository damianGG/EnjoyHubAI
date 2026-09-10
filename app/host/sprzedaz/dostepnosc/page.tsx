import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Ban, CalendarClock, Clock3, Info, RotateCcw, Users } from "lucide-react"

import { clearAvailabilityException, setAvailabilityException } from "@/app/host/sprzedaz/dostepnosc/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { organizerManagementRoles } from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type Membership = { organization_id: string; role: string }
type Venue = { id: string; organization_id: string; name: string; timezone: string }
type ExceptionRow = {
  id: string
  local_date: string
  is_closed: boolean
  local_start_time: string | null
  local_end_time: string | null
  capacity: number | null
  reason: string | null
}
type Schedule = {
  id: string
  weekday: number
  local_start_time: string
  local_end_time: string
  slot_interval_minutes: number
  capacity: number
  sales_cutoff_minutes: number
  is_active: boolean
  product_schedule_exceptions: ExceptionRow[]
}
type Product = {
  id: string
  name: string
  duration_minutes: number
  status: string
  venue_id: string
  product_schedules: Schedule[]
}

const weekdayName: Record<number, string> = {
  1: "Poniedziałek",
  2: "Wtorek",
  3: "Środa",
  4: "Czwartek",
  5: "Piątek",
  6: "Sobota",
  7: "Niedziela",
}

function shortTime(value: string | null) {
  return value ? value.slice(0, 5) : "—"
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host")

  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/sprzedaz/dostepnosc")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", [...organizerManagementRoles])

  if (membershipError) return <CenteredMessage>Nie udało się pobrać uprawnień organizatora.</CenteredMessage>

  const memberships = (membershipData ?? []) as Membership[]
  if (!memberships.length) redirect("/host")

  const organizationIds = [...new Set(memberships.map((item) => item.organization_id))]
  const { data: venueData, error: venueError } = await supabase
    .from("venues")
    .select("id, organization_id, name, timezone")
    .in("organization_id", organizationIds)
    .order("name")

  if (venueError) return <CenteredMessage>Nie udało się pobrać obiektów.</CenteredMessage>

  const venues = (venueData ?? []) as Venue[]
  const venueIds = venues.map((venue) => venue.id)
  const venueById = new Map(venues.map((venue) => [venue.id, venue]))

  const products = venueIds.length
    ? await supabase
        .from("products")
        .select(`
          id,
          name,
          duration_minutes,
          status,
          venue_id,
          product_schedules (
            id,
            weekday,
            local_start_time,
            local_end_time,
            slot_interval_minutes,
            capacity,
            sales_cutoff_minutes,
            is_active,
            product_schedule_exceptions (
              id,
              local_date,
              is_closed,
              local_start_time,
              local_end_time,
              capacity,
              reason
            )
          )
        `)
        .in("venue_id", venueIds)
        .neq("status", "archived")
        .order("name")
    : { data: [], error: null }

  if (products.error) return <CenteredMessage>Nie udało się pobrać reguł dostępności.</CenteredMessage>

  const rows = (products.data ?? []) as unknown as Product[]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <Link href="/host" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Panel organizatora
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <Badge variant="secondary">Dostępność</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Reguły tygodniowe i wyjątki</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Nie układasz ręcznie 90 dni kalendarza. Ustalasz stałą regułę tygodniową, a EnjoyHub automatycznie utrzymuje przyszłe terminy. Tu dodajesz tylko wyjątki: zamknięty dzień, inne godziny albo inną liczbę miejsc.
        </p>

        <Alert className="mt-6 max-w-3xl">
          <Info className="h-4 w-4" />
          <AlertTitle>Terminy są tylko techniczną materializacją</AlertTitle>
          <AlertDescription>
            Źródłem prawdy jest reguła tygodniowa. System codziennie przedłuża horyzont przyszłych terminów. Wyjątek przebudowuje tylko wybraną datę i nie zmienia stałej reguły.
          </AlertDescription>
        </Alert>

        {query.ok ? (
          <Alert className="mt-6 max-w-3xl border-emerald-200 bg-emerald-50 text-emerald-950">
            <CalendarClock className="h-4 w-4" />
            <AlertTitle>Zapisano dostępność</AlertTitle>
            <AlertDescription>{query.ok === "przywrocono" ? "Przywrócono standardową regułę dla wybranego dnia." : "Wyjątek został zapisany i terminy dla tej daty odświeżone."}</AlertDescription>
          </Alert>
        ) : null}

        {query.blad ? (
          <Alert variant="destructive" className="mt-6 max-w-3xl">
            <AlertTitle>Nie udało się zmienić dostępności</AlertTitle>
            <AlertDescription>
              {query.blad === "rezerwacje"
                ? "Dla tej daty istnieje już aktywność checkoutu lub rezerwacja. Dla bezpieczeństwa nie przebudowujemy automatycznie terminów powiązanych z zamówieniami."
                : query.blad === "uprawnienia"
                  ? "Nie masz uprawnień owner/admin/manager do tej oferty."
                  : "Sprawdź datę, godziny i pojemność, a następnie spróbuj ponownie."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-8 space-y-6">
          {rows.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">Nie masz jeszcze oferty z harmonogramem.</CardContent>
            </Card>
          ) : rows.map((product) => {
            const venue = venueById.get(product.venue_id)
            const schedules = [...(product.product_schedules ?? [])].filter((schedule) => schedule.is_active).sort((a, b) => a.weekday - b.weekday)
            const exceptions = schedules.flatMap((schedule) => (schedule.product_schedule_exceptions ?? []).map((exception) => ({ schedule, exception }))).sort((a, b) => a.exception.local_date.localeCompare(b.exception.local_date))

            return (
              <Card key={product.id} className="surface-3d">
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{product.name}</CardTitle>
                      <CardDescription>{venue?.name ?? "Obiekt"} · wizyta {product.duration_minutes} min · {venue?.timezone ?? "Europe/Warsaw"}</CardDescription>
                    </div>
                    <Badge variant="outline">{product.status === "active" ? "Aktywna oferta" : "Szkic"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-7">
                  <section>
                    <h2 className="text-sm font-semibold">Stała reguła tygodniowa</h2>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {schedules.map((schedule) => (
                        <div key={schedule.id} className="rounded-xl border bg-muted/20 p-4 text-sm">
                          <p className="font-medium">{weekdayName[schedule.weekday] ?? `Dzień ${schedule.weekday}`}</p>
                          <p className="mt-2 flex items-center gap-2 text-muted-foreground"><Clock3 className="h-4 w-4" /> {shortTime(schedule.local_start_time)}–{shortTime(schedule.local_end_time)} · co {schedule.slot_interval_minutes} min</p>
                          <p className="mt-1 flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> {schedule.capacity} miejsc · sprzedaż do {schedule.sales_cutoff_minutes} min przed</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                    <h2 className="font-semibold">Dodaj wyjątek dla konkretnego dnia</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Tryb „zamknięte” usuwa sprzedaż tego dnia. Tryb „specjalne ustawienia” pozwala zmienić godziny i/lub pojemność tylko na tę datę.</p>
                    <form action={setAvailabilityException} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`schedule-${product.id}`}>Reguła / dzień tygodnia</Label>
                        <select id={`schedule-${product.id}`} name="scheduleId" required className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                          {schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{weekdayName[schedule.weekday]} · {shortTime(schedule.local_start_time)}–{shortTime(schedule.local_end_time)}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`date-${product.id}`}>Data</Label>
                        <Input id={`date-${product.id}`} name="localDate" type="date" min={today} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`mode-${product.id}`}>Co ma się wydarzyć?</Label>
                        <select id={`mode-${product.id}`} name="mode" defaultValue="closed" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                          <option value="closed">Zamknięte tego dnia</option>
                          <option value="override">Specjalne godziny / liczba miejsc</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`start-${product.id}`}>Specjalnie od</Label>
                        <Input id={`start-${product.id}`} name="localStartTime" type="time" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`end-${product.id}`}>Specjalnie do</Label>
                        <Input id={`end-${product.id}`} name="localEndTime" type="time" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`capacity-${product.id}`}>Specjalna liczba miejsc</Label>
                        <Input id={`capacity-${product.id}`} name="capacity" type="number" min={1} placeholder="bez zmian" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`reason-${product.id}`}>Powód / notatka (opcjonalnie)</Label>
                        <Input id={`reason-${product.id}`} name="reason" maxLength={240} placeholder="np. święto, impreza zamknięta" />
                      </div>
                      <div className="flex items-end">
                        <Button type="submit" className="w-full"><CalendarClock className="h-4 w-4" /> Zapisz wyjątek</Button>
                      </div>
                    </form>
                  </section>

                  <section>
                    <h2 className="text-sm font-semibold">Najbliższe wyjątki</h2>
                    {exceptions.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">Brak wyjątków — obowiązuje standardowy tydzień.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {exceptions.map(({ schedule, exception }) => (
                          <div key={exception.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm">
                              <div className="flex items-center gap-2 font-medium">
                                {exception.is_closed ? <Ban className="h-4 w-4 text-destructive" /> : <CalendarClock className="h-4 w-4 text-primary" />}
                                {exception.local_date} · {weekdayName[schedule.weekday]}
                              </div>
                              <p className="mt-1 text-muted-foreground">
                                {exception.is_closed
                                  ? "Zamknięte"
                                  : `${exception.local_start_time ? `${shortTime(exception.local_start_time)}–${shortTime(exception.local_end_time)}` : "standardowe godziny"}${exception.capacity ? ` · ${exception.capacity} miejsc` : ""}`}
                                {exception.reason ? ` · ${exception.reason}` : ""}
                              </p>
                            </div>
                            <form action={clearAvailabilityException}>
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <input type="hidden" name="localDate" value={exception.local_date} />
                              <Button type="submit" variant="outline" size="sm"><RotateCcw className="h-4 w-4" /> Przywróć regułę</Button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main>
}
