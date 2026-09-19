import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  CreditCard,
  MapPin,
  PlusCircle,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react"

import { createOrganizerBooking } from "@/app/host/rezerwacje/nowa/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  hasOrganizerRole,
  organizerManagementRoles,
  type OrganizerRole,
} from "@/lib/organizer/access"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/ticketing/format"

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

type TicketType = {
  id: string
  name: string
  description: string | null
  price_amount: number | string
  currency: string
  capacity_units: number
  min_quantity_per_order: number
  max_quantity_per_order: number | null
}

export default async function NewOrganizerBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; blad?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/host")

  const query = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/host/rezerwacje/nowa")

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)

  if (membershipError) {
    return <CenteredMessage>Nie udało się sprawdzić uprawnień organizatora.</CenteredMessage>
  }

  const memberships = (membershipData ?? []) as Membership[]
  const roles = new Set(memberships.map((membership) => membership.role))
  if (!hasOrganizerRole(roles, organizerManagementRoles)) redirect("/host")

  const now = new Date()
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const to = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const { data: calendarData, error: calendarError } = await supabase.rpc(
    "ticketing_get_organizer_calendar",
    { p_from: from.toISOString(), p_to: to.toISOString() },
  )

  if (calendarError) {
    return <CenteredMessage>Nie udało się pobrać wolnych terminów.</CenteredMessage>
  }

  const sessions = ((calendarData ?? []) as CalendarRow[])
    .filter((session) => session.available_capacity_units > 0 && new Date(session.ends_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  const selected = query.session
    ? sessions.find((session) => session.session_id === query.session) ?? null
    : null

  let ticketTypes: TicketType[] = []
  if (selected) {
    const { data: ticketData, error: ticketError } = await supabase
      .from("ticket_types")
      .select("id, name, description, price_amount, currency, capacity_units, min_quantity_per_order, max_quantity_per_order")
      .eq("product_id", selected.product_id)
      .eq("is_active", true)
      .order("sort_order")
      .order("price_amount")

    if (ticketError) {
      return <CenteredMessage>Nie udało się pobrać wariantów biletów.</CenteredMessage>
    }
    ticketTypes = (ticketData ?? []) as TicketType[]
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/host/kalendarz" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Kalendarz
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/host/sprzedaz">Sprzedaż i rezerwacje</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Badge variant="secondary">Nowa rezerwacja</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Dodaj rezerwację ręcznie</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Telefon, recepcja czy klient z ulicy — każda taka sprzedaż od razu zajmuje miejsca w tym samym kalendarzu, który widzą klienci online.
        </p>

        {query.blad && <BookingError code={query.blad} />}

        {!selected ? (
          <Card className="mt-7">
            <CardHeader>
              <CardTitle>1. Wybierz termin</CardTitle>
              <CardDescription>Pokazujemy tylko przyszłe lub trwające terminy, które mają wolne miejsca.</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="py-10 text-center">
                  <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 font-medium">Brak wolnych terminów w najbliższych 60 dniach</p>
                  <p className="mt-1 text-sm text-muted-foreground">Sprawdź reguły dostępności albo dodaj wyjątek w kalendarzu.</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link href="/host/sprzedaz/dostepnosc">Reguły dostępności</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {sessions.slice(0, 120).map((session) => (
                    <div key={session.session_id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold">{session.product_name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {session.venue_name}{session.venue_city ? ` · ${session.venue_city}` : ""}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" /> {formatSession(session)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{session.available_capacity_units} wolnych</Badge>
                        <Button asChild size="sm">
                          <Link href={`/host/rezerwacje/nowa?session=${session.session_id}`}>Wybierz</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            <Card className="surface-3d">
              <CardHeader>
                <CardTitle>2. Dane rezerwacji</CardTitle>
                <CardDescription>Wybierz źródło, bilety i sposób rozliczenia.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createOrganizerBooking} className="space-y-7">
                  <input type="hidden" name="sessionId" value={selected.session_id} />

                  <section className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bookingSource">Źródło rezerwacji</Label>
                      <select id="bookingSource" name="bookingSource" defaultValue="manual" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="manual">Ręczna rezerwacja / telefon</option>
                        <option value="walk_in">Walk-in / klient na miejscu</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentMode">Płatność</Label>
                      <select id="paymentMode" name="paymentMode" defaultValue="on_site_unpaid" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="on_site_unpaid">Na miejscu — nieopłacona</option>
                        <option value="on_site_paid">Na miejscu — opłacona</option>
                        <option value="online_unpaid">Online — oczekuje na płatność</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Płatności online pojawiają się automatycznie dla zamówień z checkoutu i potwierdza je Stripe. Ręczna rezerwacja rozliczana jest na miejscu.
                      </p>
                    </div>
                  </section>

                  <section>
                    <h2 className="font-semibold">Bilety / uczestnicy</h2>
                    <div className="mt-3 space-y-3">
                      {ticketTypes.map((ticket) => (
                        <div key={ticket.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{ticket.name}</p>
                              <Badge variant="outline">{formatMoney(Number(ticket.price_amount), ticket.currency)}</Badge>
                            </div>
                            {ticket.description && <p className="mt-1 text-sm text-muted-foreground">{ticket.description}</p>}
                            <p className="mt-1 text-xs text-muted-foreground">
                              Zajmuje {ticket.capacity_units} {ticket.capacity_units === 1 ? "miejsce" : "miejsca"} · min. {ticket.min_quantity_per_order}{ticket.max_quantity_per_order ? ` · maks. ${ticket.max_quantity_per_order}` : ""}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`ticket-${ticket.id}`} className="text-xs">Liczba</Label>
                            <Input
                              id={`ticket-${ticket.id}`}
                              name={`ticket-${ticket.id}`}
                              type="number"
                              min={0}
                              max={ticket.max_quantity_per_order ?? 100}
                              defaultValue={0}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Imię i nazwisko / nazwa klienta</Label>
                      <Input id="customerName" name="customerName" maxLength={160} placeholder="np. Jan Kowalski" />
                      <p className="text-xs text-muted-foreground">Dla walk-in możesz zostawić puste — wpiszemy „Klient walk-in”.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Telefon</Label>
                      <Input id="customerPhone" name="customerPhone" type="tel" maxLength={40} placeholder="+48 600 000 000" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="customerEmail">E-mail</Label>
                      <Input id="customerEmail" name="customerEmail" type="email" maxLength={254} placeholder="klient@example.com" />
                      <p className="text-xs text-muted-foreground">Opcjonalny przy płatności na miejscu. Wymagany przy płatności online i potrzebny do automatycznych przypomnień.</p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="note">Notatka wewnętrzna</Label>
                      <Input id="note" name="note" maxLength={1000} placeholder="np. urodziny, dodatkowe ustalenia, kontakt telefoniczny" />
                    </div>
                  </section>

                  <Button type="submit" size="lg" className="w-full">
                    <PlusCircle className="h-4 w-4" /> Utwórz rezerwację
                  </Button>
                </form>
              </CardContent>
            </Card>

            <aside className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Wybrany termin</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoLine icon={Store}>{selected.product_name}</InfoLine>
                  <InfoLine icon={MapPin}>{selected.venue_name}{selected.venue_city ? ` · ${selected.venue_city}` : ""}</InfoLine>
                  <InfoLine icon={CalendarClock}>{formatSession(selected)}</InfoLine>
                  <InfoLine icon={Users}>{selected.available_capacity_units} z {selected.capacity} miejsc wolnych</InfoLine>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/host/rezerwacje/nowa">Zmień termin</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-4 w-4" /> Jak to działa</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Po zapisaniu miejsca są natychmiast odejmowane z dostępności online.</p>
                  <p>System wystawi bilety tak samo jak dla normalnego zamówienia.</p>
                  <p>Jeżeli podasz e-mail, klient dostanie automatyczne przypomnienia przed terminem.</p>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

function BookingError({ code }: { code: string }) {
  const message = code === "miejsca"
    ? "Wybrany termin nie ma już wystarczającej liczby wolnych miejsc."
    : code === "email"
      ? "Sprawdź adres e-mail. Dla płatności online e-mail jest wymagany."
      : code === "bilety"
        ? "Wybierz co najmniej jeden bilet / uczestnika."
        : code === "uprawnienia"
          ? "Nie masz uprawnień do dodawania rezerwacji dla tej organizacji."
          : "Nie udało się utworzyć rezerwacji. Sprawdź dane i spróbuj ponownie."

  return (
    <Alert variant="destructive" className="mt-6">
      <AlertTitle>Rezerwacja nie została zapisana</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function InfoLine({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{children}</span></div>
}

function formatSession(session: CalendarRow) {
  const date = new Intl.DateTimeFormat("pl-PL", {
    timeZone: session.venue_timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(session.starts_at))
  const time = new Intl.DateTimeFormat("pl-PL", {
    timeZone: session.venue_timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(session.starts_at))
  return `${date} · ${time}`
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4"><Card><CardContent className="p-8 text-muted-foreground">{children}</CardContent></Card></main>
}
