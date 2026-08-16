"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Plus,
  Store,
  Ticket,
  Trash2,
} from "lucide-react"

import {
  createSalesSetup,
  type SalesSetupActionState,
} from "@/app/host/sprzedaz/konfiguracja/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  TicketingSetupOrganization,
  TicketingSetupVenue,
} from "@/lib/ticketing/types"

interface SalesSetupFormProps {
  organizations: TicketingSetupOrganization[]
  venues: TicketingSetupVenue[]
}

interface TicketRow {
  id: string
  name: string
  price: string
  capacityUnits: string
  maxQuantity: string
}

const weekdays = [
  { value: "1", label: "Pon" },
  { value: "2", label: "Wt" },
  { value: "3", label: "Śr" },
  { value: "4", label: "Czw" },
  { value: "5", label: "Pt" },
  { value: "6", label: "Sob" },
  { value: "7", label: "Niedz" },
]

const initialState: SalesSetupActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Uruchamiam sprzedaż…</>
      ) : (
        <><CheckCircle2 className="h-4 w-4" /> Utwórz ofertę i terminy</>
      )}
    </Button>
  )
}

export function SalesSetupForm({ organizations, venues }: SalesSetupFormProps) {
  const [state, formAction] = useActionState(createSalesSetup, initialState)
  const [venueChoice, setVenueChoice] = useState(venues[0]?.id ?? "new")
  const [organizationChoice, setOrganizationChoice] = useState(organizations[0]?.id ?? "new")
  const [ticketRows, setTicketRows] = useState<TicketRow[]>([
    { id: "normal", name: "Bilet normalny", price: "50", capacityUnits: "1", maxQuantity: "10" },
    { id: "reduced", name: "Bilet ulgowy", price: "35", capacityUnits: "1", maxQuantity: "10" },
  ])

  const selectedVenue = venues.find((venue) => venue.id === venueChoice) ?? null
  const createsVenue = venueChoice === "new"

  function addTicketRow() {
    if (ticketRows.length >= 10) return
    setTicketRows((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        name: "",
        price: "",
        capacityUnits: "1",
        maxQuantity: "10",
      },
    ])
  }

  function removeTicketRow(id: string) {
    if (ticketRows.length === 1) return
    setTicketRows((rows) => rows.filter((row) => row.id !== id))
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <Alert variant="destructive">
          <AlertTitle>Nie udało się zapisać konfiguracji</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            1. Obiekt i model sprzedaży
          </CardTitle>
          <CardDescription>
            Wybierz istniejący obiekt albo utwórz nowy bez wychodzenia z kreatora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="existingVenueId">Obiekt</Label>
            <Select name="existingVenueId" value={venueChoice} onValueChange={setVenueChoice}>
              <SelectTrigger id="existingVenueId" className="w-full">
                <SelectValue placeholder="Wybierz obiekt" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name} · {venue.organizationName}
                  </SelectItem>
                ))}
                <SelectItem value="new">+ Utwórz nowy obiekt</SelectItem>
              </SelectContent>
            </Select>
            {selectedVenue && (
              <p className="text-sm text-muted-foreground">
                {selectedVenue.organizationName}
                {selectedVenue.city ? ` · ${selectedVenue.city}` : ""}
                {selectedVenue.salesMode === "allocated_quota"
                  ? " · pula dla EnjoyHub"
                  : " · pełna sprzedaż w EnjoyHub"}
              </p>
            )}
          </div>

          {createsVenue ? (
            <div className="space-y-5 rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="organizationId">Firma / organizacja</Label>
                  <Select name="organizationId" value={organizationChoice} onValueChange={setOrganizationChoice}>
                    <SelectTrigger id="organizationId" className="w-full">
                      <SelectValue placeholder="Wybierz organizację" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((organization) => (
                        <SelectItem key={organization.id} value={organization.id}>
                          {organization.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">+ Utwórz nową organizację</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {organizationChoice === "new" && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="organizationName">Nazwa firmy / organizacji</Label>
                    <Input id="organizationName" name="organizationName" minLength={2} maxLength={160} required />
                  </div>
                )}

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="venueName">Nazwa obiektu</Label>
                  <Input id="venueName" name="venueName" minLength={2} maxLength={160} placeholder="np. Park Przygody Wisła" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="venueDescription">Krótki opis obiektu <span className="text-muted-foreground">(opcjonalnie)</span></Label>
                  <Textarea id="venueDescription" name="venueDescription" maxLength={2000} rows={3} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="addressLine1">Adres</Label>
                  <Input id="addressLine1" name="addressLine1" maxLength={240} placeholder="ul. Przykładowa 1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Kod pocztowy</Label>
                  <Input id="postalCode" name="postalCode" maxLength={20} placeholder="00-001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Miasto</Label>
                  <Input id="city" name="city" maxLength={120} placeholder="Warszawa" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="salesMode">Skąd pochodzi limit miejsc?</Label>
                  <Select name="salesMode" defaultValue="allocated_quota">
                    <SelectTrigger id="salesMode" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allocated_quota">Wydzielona pula dla EnjoyHub — mam już kasę</SelectItem>
                      <SelectItem value="native_enjoyhub">Cała sprzedaż i limit w EnjoyHub</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Dla obiektu z istniejącym systemem kasowym wybierz wydzieloną pulę. Pojemność poniżej będzie dotyczyć tylko biletów EnjoyHub.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <input type="hidden" name="salesMode" value={selectedVenue?.salesMode ?? "allocated_quota"} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            2. Oferta i cennik
          </CardTitle>
          <CardDescription>
            To zobaczy klient na stałej stronie sprzedażowej oraz w checkoutcie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="productName">Nazwa atrakcji / oferty</Label>
              <Input id="productName" name="productName" minLength={2} maxLength={180} placeholder="np. Rodzinny park linowy — wejście 2 godziny" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="productDescription">Opis dla kupującego</Label>
              <Textarea id="productDescription" name="productDescription" maxLength={4000} rows={4} placeholder="Co obejmuje bilet, dla kogo jest atrakcja i jak przygotować się do wizyty?" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Czas trwania (minuty)</Label>
              <Input id="durationMinutes" name="durationMinutes" type="number" min={1} max={1440} defaultValue={60} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Miejsca w jednym terminie</Label>
              <Input id="capacity" name="capacity" type="number" min={1} max={100000} defaultValue={20} required />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Rodzaje biletów</h3>
                <p className="text-sm text-muted-foreground">Cena brutto w PLN. Jeden bilet może zajmować kilka miejsc, np. rodzinny.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTicketRow} disabled={ticketRows.length >= 10}>
                <Plus className="h-4 w-4" /> Dodaj rodzaj
              </Button>
            </div>

            <div className="space-y-3">
              {ticketRows.map((ticket, index) => (
                <div key={ticket.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_8rem_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`ticket-name-${ticket.id}`}>Nazwa</Label>
                    <Input id={`ticket-name-${ticket.id}`} name="ticketName" defaultValue={ticket.name} maxLength={120} placeholder="Bilet normalny" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`ticket-price-${ticket.id}`}>Cena (PLN)</Label>
                    <Input id={`ticket-price-${ticket.id}`} name="ticketPrice" type="number" min="0.01" max="1000000" step="0.01" defaultValue={ticket.price} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`ticket-capacity-${ticket.id}`}>Zajęte miejsca</Label>
                    <Input id={`ticket-capacity-${ticket.id}`} name="ticketCapacityUnits" type="number" min={1} defaultValue={ticket.capacityUnits} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`ticket-limit-${ticket.id}`}>Limit / zakup</Label>
                    <Input id={`ticket-limit-${ticket.id}`} name="ticketMaxQuantity" type="number" min={1} max={100} defaultValue={ticket.maxQuantity} required />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTicketRow(ticket.id)}
                    disabled={ticketRows.length === 1}
                    aria-label={`Usuń rodzaj biletu ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            3. Terminy i dostępność
          </CardTitle>
          <CardDescription>
            Ustaw jeden powtarzalny plan. Kreator od razu wygeneruje 90 dni, a automat będzie codziennie go przedłużał.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Dni sprzedaży</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdays.map((day) => (
                <label key={day.value} className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-2 py-3 text-sm hover:bg-muted">
                  <Checkbox name="weekdays" value={day.value} defaultChecked />
                  {day.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="localStartTime">Pierwsze wejście</Label>
              <Input id="localStartTime" name="localStartTime" type="time" defaultValue="10:00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="localEndTime">Koniec okna</Label>
              <Input id="localEndTime" name="localEndTime" type="time" defaultValue="18:00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slotIntervalMinutes">Nowy termin co (min)</Label>
              <Input id="slotIntervalMinutes" name="slotIntervalMinutes" type="number" min={1} max={1440} defaultValue={60} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salesCutoffMinutes">Zamknij sprzedaż przed (min)</Label>
              <Input id="salesCutoffMinutes" name="salesCutoffMinutes" type="number" min={0} max={10080} defaultValue={60} required />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Po jednym zapisie oferta jest gotowa do sprzedaży</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Powstanie publiczny link, cennik i pierwsze 90 dni terminów. Cała operacja jest atomowa — błąd nie zostawi połowy konfiguracji.
              </p>
            </div>
          </div>
          <SubmitButton />
        </CardContent>
      </Card>

      {organizations.length === 0 && venues.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-4 w-4" />
          Pierwszy zapis automatycznie utworzy Twoją organizację i przypisze Ci rolę właściciela.
        </div>
      )}
    </form>
  )
}
