"use client"

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useFormStatus } from "react-dom"
import dynamic from "next/dynamic"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  Store,
  Ticket,
  Trash2,
} from "lucide-react"

import {
  completeOrganizerOnboarding,
  type OrganizerOnboardingActionState,
} from "@/app/host/onboarding/actions"
import { ImageUploadSection } from "@/components/forms/ImageUploadSection"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const LocationPicker = dynamic(() => import("@/components/location-picker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl border bg-muted" />,
})

interface OrganizerCategory {
  id: string
  name: string
  icon: string | null
  description: string | null
}

interface OrganizerOnboardingWizardProps {
  categories: OrganizerCategory[]
  userId: string
  userEmail: string
}

interface FormValues {
  organizationName: string
  legalName: string
  taxId: string
  billingEmail: string
  attractionName: string
  attractionDescription: string
  categoryId: string
  address: string
  postalCode: string
  city: string
  productName: string
  productDescription: string
  durationMinutes: string
  capacity: string
  localStartTime: string
  localEndTime: string
  slotIntervalMinutes: string
  salesCutoffMinutes: string
}

interface TicketRow {
  id: string
  name: string
  price: string
  capacityUnits: string
  maxQuantity: string
}

interface ImageData {
  url: string
  publicId: string
}

interface LocationValue {
  lat: number
  lng: number
}

type SalesMode = "allocated_quota" | "native_enjoyhub"

const stepLabels = ["Firma", "Atrakcja", "Oferta", "Bilety", "Terminy", "Podsumowanie"]
const draftStorageKeyPrefix = "enjoyhub.organizer-onboarding.v1"
const initialActionState: OrganizerOnboardingActionState = {}

const weekdays = [
  { value: 1, short: "Pon", long: "poniedziałek" },
  { value: 2, short: "Wt", long: "wtorek" },
  { value: 3, short: "Śr", long: "środa" },
  { value: 4, short: "Czw", long: "czwartek" },
  { value: 5, short: "Pt", long: "piątek" },
  { value: 6, short: "Sob", long: "sobota" },
  { value: 7, short: "Niedz", long: "niedziela" },
]

function defaultValues(userEmail: string): FormValues {
  return {
    organizationName: "",
    legalName: "",
    taxId: "",
    billingEmail: userEmail,
    attractionName: "",
    attractionDescription: "",
    categoryId: "",
    address: "",
    postalCode: "",
    city: "",
    productName: "",
    productDescription: "",
    durationMinutes: "60",
    capacity: "20",
    localStartTime: "10:00",
    localEndTime: "18:00",
    slotIntervalMinutes: "60",
    salesCutoffMinutes: "60",
  }
}

function defaultTickets(): TicketRow[] {
  return [
    { id: "normal", name: "Bilet normalny", price: "50", capacityUnits: "1", maxQuantity: "10" },
    { id: "reduced", name: "Bilet ulgowy", price: "35", capacityUnits: "1", maxQuantity: "10" },
  ]
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="lg" disabled={disabled || pending} className="h-12 w-full px-7 text-base sm:w-auto">
      {pending ? (
        <><Loader2 className="h-5 w-5 animate-spin" /> Tworzę Twoją sprzedaż…</>
      ) : (
        <><CheckCircle2 className="h-5 w-5" /> Potwierdzam i uruchamiam</>
      )}
    </Button>
  )
}

export function OrganizerOnboardingWizard({
  categories,
  userId,
  userEmail,
}: OrganizerOnboardingWizardProps) {
  const [state, formAction] = useActionState(completeOrganizerOnboarding, initialActionState)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<FormValues>(() => defaultValues(userEmail))
  const [tickets, setTickets] = useState<TicketRow[]>(defaultTickets)
  const [weekdaysValue, setWeekdaysValue] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const [salesMode, setSalesMode] = useState<SalesMode>("allocated_quota")
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const [accepted, setAccepted] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const draftStorageKey = `${draftStorageKeyPrefix}.${userId}`

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === values.categoryId) ?? null,
    [categories, values.categoryId],
  )

  useEffect(() => {
    try {
      const storedDraft = window.localStorage.getItem(draftStorageKey)
      if (storedDraft) {
        const parsed = JSON.parse(storedDraft) as {
          values?: Partial<FormValues>
          tickets?: TicketRow[]
          weekdays?: number[]
          salesMode?: SalesMode
          location?: LocationValue | null
          images?: ImageData[]
        }

        if (parsed.values) setValues((current) => ({ ...current, ...parsed.values, billingEmail: parsed.values?.billingEmail || userEmail }))
        if (Array.isArray(parsed.tickets) && parsed.tickets.length > 0) setTickets(parsed.tickets.slice(0, 10))
        if (Array.isArray(parsed.weekdays) && parsed.weekdays.length > 0) setWeekdaysValue(parsed.weekdays)
        if (parsed.salesMode === "allocated_quota" || parsed.salesMode === "native_enjoyhub") setSalesMode(parsed.salesMode)
        if (parsed.location && Number.isFinite(parsed.location.lat) && Number.isFinite(parsed.location.lng)) setLocation(parsed.location)
        if (Array.isArray(parsed.images)) setImages(parsed.images.slice(0, 8))
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    } finally {
      setDraftReady(true)
    }
  }, [draftStorageKey, userEmail])

  useEffect(() => {
    if (!draftReady) return
    window.localStorage.setItem(draftStorageKey, JSON.stringify({
      values,
      tickets,
      weekdays: weekdaysValue,
      salesMode,
      location,
      images,
    }))
  }, [draftReady, draftStorageKey, images, location, salesMode, tickets, values, weekdaysValue])

  useEffect(() => {
    if (!state.error) return
    document.getElementById("onboarding-error")?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [state.error])

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setLocation({ lat, lng })
    setStepError(null)
  }, [])

  function updateValue(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setStepError(null)
  }

  function validateStep(currentStep: number) {
    if (currentStep === 0) {
      if (values.organizationName.trim().length < 2) return "Podaj nazwę firmy lub organizacji."
      if (!/^\S+@\S+\.\S+$/.test(values.billingEmail.trim())) return "Podaj prawidłowy e-mail rozliczeniowy."
      if (values.taxId && values.taxId.replace(/[^0-9]/g, "").length !== 10) return "Polski NIP powinien zawierać 10 cyfr."
    }

    if (currentStep === 1) {
      if (values.attractionName.trim().length < 2) return "Podaj nazwę atrakcji."
      if (values.attractionDescription.trim().length < 20) return "Napisz co najmniej dwa krótkie zdania o atrakcji."
      if (!values.categoryId) return "Wybierz kategorię atrakcji."
      if (values.address.trim().length < 3 || values.city.trim().length < 2) return "Uzupełnij adres i miejscowość."
      if (!location) return "Zaznacz dokładną lokalizację obiektu na mapie."
    }

    if (currentStep === 2) {
      if (values.productName.trim().length < 2) return "Podaj nazwę pierwszej oferty."
      if (!Number.isInteger(Number(values.durationMinutes)) || Number(values.durationMinutes) < 1) return "Podaj prawidłowy czas trwania."
      if (!Number.isInteger(Number(values.capacity)) || Number(values.capacity) < 1) return "Podaj liczbę miejsc w jednym terminie."
    }

    if (currentStep === 3) {
      if (tickets.length === 0) return "Dodaj co najmniej jeden rodzaj biletu."
      if (tickets.some((ticket) => ticket.name.trim().length === 0 || Number(ticket.price) <= 0)) return "Uzupełnij nazwę i cenę każdego biletu."
      if (tickets.some((ticket) => !Number.isInteger(Number(ticket.capacityUnits)) || Number(ticket.capacityUnits) < 1)) return "Pole „zajęte miejsca” musi być liczbą większą od zera."
      if (tickets.some((ticket) => Number(ticket.capacityUnits) > Number(values.capacity))) return "Bilet nie może zajmować więcej miejsc niż cały termin."
      if (tickets.some((ticket) => !Number.isInteger(Number(ticket.maxQuantity)) || Number(ticket.maxQuantity) < 1)) return "Ustaw limit zakupu dla każdego biletu."
      const names = tickets.map((ticket) => ticket.name.trim().toLocaleLowerCase("pl"))
      if (new Set(names).size !== names.length) return "Każdy rodzaj biletu musi mieć inną nazwę."
    }

    if (currentStep === 4) {
      if (weekdaysValue.length === 0) return "Wybierz co najmniej jeden dzień sprzedaży."
      if (values.localStartTime >= values.localEndTime) return "Godzina zakończenia musi być późniejsza niż pierwsze wejście."
      if (Number(values.slotIntervalMinutes) < 1) return "Podaj, jak często ma rozpoczynać się nowy termin."
      if (Number(values.salesCutoffMinutes) < 0) return "Czas zamknięcia sprzedaży nie może być ujemny."
    }

    return null
  }

  function moveToStep(nextStep: number) {
    setStep(nextStep)
    setStepError(null)
    requestAnimationFrame(() => {
      document.getElementById("onboarding-heading")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  function goNext() {
    const error = validateStep(step)
    if (error) {
      setStepError(error)
      return
    }

    if (step === 1 && !values.productName.trim()) {
      setValues((current) => ({
        ...current,
        productName: `Bilet wstępu — ${current.attractionName.trim()}`,
      }))
    }

    moveToStep(Math.min(step + 1, stepLabels.length - 1))
  }

  function addTicket() {
    if (tickets.length >= 10) return
    setTickets((current) => [...current, {
      id: crypto.randomUUID(),
      name: "",
      price: "",
      capacityUnits: "1",
      maxQuantity: "10",
    }])
  }

  function updateTicket(id: string, field: keyof Omit<TicketRow, "id">, value: string) {
    setTickets((current) => current.map((ticket) => (
      ticket.id === id ? { ...ticket, [field]: value } : ticket
    )))
    setStepError(null)
  }

  function removeTicket(id: string) {
    if (tickets.length === 1) return
    setTickets((current) => current.filter((ticket) => ticket.id !== id))
  }

  function toggleWeekday(day: number) {
    setWeekdaysValue((current) => (
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()
    ))
    setStepError(null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step < stepLabels.length - 1) {
      event.preventDefault()
      goNext()
      return
    }

    if (!accepted) {
      event.preventDefault()
      setStepError("Potwierdź poprawność danych i prawo do sprzedaży biletów.")
    }
  }

  const progress = ((step + 1) / stepLabels.length) * 100

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div id="onboarding-heading" className="mx-auto mb-8 max-w-3xl text-center scroll-mt-6">
        <Badge variant="secondary">Krok {step + 1} z {stepLabels.length}</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Dodaj atrakcję i uruchom bilety</h1>
        <p className="mt-3 text-muted-foreground">W każdej chwili możesz wrócić do poprzedniego kroku. Szkic zapisuje się w tej przeglądarce.</p>
      </div>

      <div className="mx-auto mb-8 max-w-4xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          {stepLabels.map((label, index) => (
            <div
              key={label}
              className={cn(
                "hidden text-xs font-medium sm:block",
                index === step ? "text-primary" : index < step ? "text-foreground" : "text-muted-foreground",
              )}
              aria-current={index === step ? "step" : undefined}
            >
              {index < step ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}{label}
            </div>
          ))}
          <span className="text-sm font-medium sm:hidden">{stepLabels[step]}</span>
          <span className="text-xs text-muted-foreground sm:hidden">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} aria-label={`Postęp konfiguracji: ${Math.round(progress)}%`} />
      </div>

      <form action={formAction} onSubmit={handleSubmit} className="mx-auto max-w-4xl">
        <HiddenFormValues
          values={values}
          tickets={tickets}
          weekdaysValue={weekdaysValue}
          salesMode={salesMode}
          location={location}
          images={images}
          accepted={accepted}
        />

        {state.error ? (
          <Alert id="onboarding-error" variant="destructive" className="mb-6 scroll-mt-6">
            <AlertTitle>Nie udało się zakończyć konfiguracji</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {step === 0 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Twoja firma lub organizacja</CardTitle>
              <CardDescription>Te dane identyfikują sprzedawcę. Nie musisz teraz konfigurować płatności ani konta bankowego.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Nazwa używana w EnjoyHub" htmlFor="organizationName" help="Np. Park Przygody lub nazwa Twojej firmy.">
                <Input id="organizationName" value={values.organizationName} onChange={(event) => updateValue("organizationName", event.target.value)} placeholder="Park Przygody" autoFocus />
              </Field>
              <Field className="sm:col-span-2" label="Pełna nazwa prawna (opcjonalnie)" htmlFor="legalName" help="Możesz uzupełnić ją teraz lub przed uruchomieniem wypłat.">
                <Input id="legalName" value={values.legalName} onChange={(event) => updateValue("legalName", event.target.value)} placeholder="Park Przygody sp. z o.o." />
              </Field>
              <Field label="NIP (opcjonalnie)" htmlFor="taxId">
                <Input id="taxId" value={values.taxId} onChange={(event) => updateValue("taxId", event.target.value)} inputMode="numeric" placeholder="1234567890" />
              </Field>
              <Field label="E-mail rozliczeniowy" htmlFor="billingEmail">
                <Input id="billingEmail" type="email" value={values.billingEmail} onChange={(event) => updateValue("billingEmail", event.target.value)} placeholder="firma@example.pl" />
              </Field>
              <div className="sm:col-span-2 rounded-xl bg-primary/5 p-4 text-sm text-muted-foreground">
                Po zakończeniu zostaniesz właścicielem tej organizacji. Później możesz dodać managera, kasjera lub osobę tylko do podglądu.
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Twoja atrakcja</CardTitle>
              <CardDescription>Te informacje zobaczy klient na publicznej stronie atrakcji.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Field label="Nazwa atrakcji" htmlFor="attractionName" help="Użyj nazwy, którą klienci znają z szyldu lub Google.">
                <Input id="attractionName" value={values.attractionName} onChange={(event) => updateValue("attractionName", event.target.value)} placeholder="Park Linowy Wisła" autoFocus />
              </Field>
              <Field label="Krótki opis" htmlFor="attractionDescription" help="Napisz dla kogo jest atrakcja i co czeka klienta na miejscu.">
                <Textarea id="attractionDescription" value={values.attractionDescription} onChange={(event) => updateValue("attractionDescription", event.target.value)} rows={5} placeholder="Rodzinny park linowy z trasami dla dzieci i dorosłych. Na miejscu zapewniamy sprzęt oraz opiekę instruktora." />
              </Field>
              <Field label="Kategoria" htmlFor="categoryId">
                <select
                  id="categoryId"
                  value={values.categoryId}
                  onChange={(event) => updateValue("categoryId", event.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Wybierz kategorię</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ""}{category.name}</option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="Ulica i numer" htmlFor="address">
                  <Input id="address" value={values.address} onChange={(event) => updateValue("address", event.target.value)} placeholder="ul. Przykładowa 10" />
                </Field>
                <Field label="Kod pocztowy" htmlFor="postalCode">
                  <Input id="postalCode" value={values.postalCode} onChange={(event) => updateValue("postalCode", event.target.value)} placeholder="00-001" />
                </Field>
                <Field label="Miejscowość" htmlFor="city">
                  <Input id="city" value={values.city} onChange={(event) => updateValue("city", event.target.value)} placeholder="Rzeszów" />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>Dokładna lokalizacja</Label>
                {draftReady ? (
                  <LocationPicker
                    onLocationSelect={handleLocationSelect}
                    selectedLat={location?.lat ?? null}
                    selectedLng={location?.lng ?? null}
                  />
                ) : (
                  <div className="h-72 animate-pulse rounded-xl border bg-muted" />
                )}
              </div>
              <ImageUploadSection images={images} onImagesChange={setImages} userId={userId} maxImages={8} />
              <p className="text-xs text-muted-foreground">Zdjęcia są opcjonalne na etapie szkicu, ale pomagają klientowi zdecydować się na zakup.</p>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Pierwsza oferta</CardTitle>
              <CardDescription>Oferta opisuje dokładnie to, co kupuje klient, np. wejście na dwie godziny.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-7">
              <div>
                <Label className="text-base">Jak sprzedajesz bilety na miejscu?</Label>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <SalesModeCard
                    selected={salesMode === "allocated_quota"}
                    icon={Store}
                    title="Mam już kasę lub system"
                    description="EnjoyHub otrzyma własną pulę miejsc. Obecna kasa działa dalej."
                    badge="Najbezpieczniej na start"
                    onClick={() => setSalesMode("allocated_quota")}
                  />
                  <SalesModeCard
                    selected={salesMode === "native_enjoyhub"}
                    icon={Ticket}
                    title="Cała sprzedaż w EnjoyHub"
                    description="EnjoyHub będzie głównym źródłem liczby miejsc i biletów."
                    onClick={() => setSalesMode("native_enjoyhub")}
                  />
                </div>
              </div>
              <Field label="Nazwa oferty" htmlFor="productName" help="Np. Wejście do parku na 2 godziny.">
                <Input id="productName" value={values.productName} onChange={(event) => updateValue("productName", event.target.value)} placeholder="Wejście do parku na 2 godziny" autoFocus />
              </Field>
              <Field label="Co obejmuje bilet? (opcjonalnie)" htmlFor="productDescription">
                <Textarea id="productDescription" value={values.productDescription} onChange={(event) => updateValue("productDescription", event.target.value)} rows={4} placeholder="Bilet obejmuje sprzęt, krótkie szkolenie i dwie godziny korzystania z tras." />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Czas wizyty (minuty)" htmlFor="durationMinutes">
                  <Input id="durationMinutes" type="number" min={1} max={1440} value={values.durationMinutes} onChange={(event) => updateValue("durationMinutes", event.target.value)} />
                </Field>
                <Field label={salesMode === "allocated_quota" ? "Miejsca dla EnjoyHub w jednym terminie" : "Wszystkie miejsca w jednym terminie"} htmlFor="capacity">
                  <Input id="capacity" type="number" min={1} max={100000} value={values.capacity} onChange={(event) => updateValue("capacity", event.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" /> Rodzaje biletów</CardTitle>
              <CardDescription>Dodaj warianty, które klient zobaczy podczas zakupu. Możesz zacząć od jednego.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert>
                <CircleDollarSign className="h-4 w-4" />
                <AlertTitle>Jak rozumieć „zajęte miejsca”?</AlertTitle>
                <AlertDescription>Normalny i ulgowy zwykle zajmują 1 miejsce. Bilet rodzinny dla 4 osób powinien zajmować 4 miejsca.</AlertDescription>
              </Alert>
              <div className="space-y-4">
                {tickets.map((ticket, index) => (
                  <div key={ticket.id} className="grid gap-4 rounded-xl border p-4 md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_8rem_auto] md:items-end">
                    <Field label={`Nazwa biletu ${index + 1}`} htmlFor={`ticket-name-${ticket.id}`}>
                      <Input id={`ticket-name-${ticket.id}`} value={ticket.name} onChange={(event) => updateTicket(ticket.id, "name", event.target.value)} placeholder="Bilet normalny" />
                    </Field>
                    <Field label="Cena (zł)" htmlFor={`ticket-price-${ticket.id}`}>
                      <Input id={`ticket-price-${ticket.id}`} type="number" min="0.01" step="0.01" value={ticket.price} onChange={(event) => updateTicket(ticket.id, "price", event.target.value)} />
                    </Field>
                    <Field label="Zajęte miejsca" htmlFor={`ticket-capacity-${ticket.id}`}>
                      <Input id={`ticket-capacity-${ticket.id}`} type="number" min={1} value={ticket.capacityUnits} onChange={(event) => updateTicket(ticket.id, "capacityUnits", event.target.value)} />
                    </Field>
                    <Field label="Limit / zakup" htmlFor={`ticket-limit-${ticket.id}`}>
                      <Input id={`ticket-limit-${ticket.id}`} type="number" min={1} max={100} value={ticket.maxQuantity} onChange={(event) => updateTicket(ticket.id, "maxQuantity", event.target.value)} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTicket(ticket.id)} disabled={tickets.length === 1} aria-label={`Usuń bilet ${ticket.name || index + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={addTicket} disabled={tickets.length >= 10}>
                <Plus className="h-4 w-4" /> Dodaj kolejny rodzaj biletu
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Dni i godziny wejść</CardTitle>
              <CardDescription>Na tej podstawie utworzymy pierwsze 90 dni terminów i będziemy automatycznie przedłużać kalendarz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-7">
              <fieldset>
                <legend className="text-sm font-medium">W które dni oferta jest dostępna?</legend>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {weekdays.map((day) => {
                    const checked = weekdaysValue.includes(day.value)
                    return (
                      <label key={day.value} className={cn(
                        "flex cursor-pointer items-center justify-center rounded-lg border px-2 py-3 text-sm font-medium transition-colors",
                        checked ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                      )}>
                        <Checkbox checked={checked} onCheckedChange={() => toggleWeekday(day.value)} className="sr-only" aria-label={day.long} />
                        {day.short}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Pierwsze wejście" htmlFor="localStartTime" help="Godzina rozpoczęcia pierwszego terminu.">
                  <Input id="localStartTime" type="time" value={values.localStartTime} onChange={(event) => updateValue("localStartTime", event.target.value)} />
                </Field>
                <Field label="Koniec okna wejść" htmlFor="localEndTime" help="Ostatni termin musi zmieścić się przed tą godziną.">
                  <Input id="localEndTime" type="time" value={values.localEndTime} onChange={(event) => updateValue("localEndTime", event.target.value)} />
                </Field>
                <Field label="Nowy termin co ile minut?" htmlFor="slotIntervalMinutes">
                  <Input id="slotIntervalMinutes" type="number" min={1} max={1440} value={values.slotIntervalMinutes} onChange={(event) => updateValue("slotIntervalMinutes", event.target.value)} />
                </Field>
                <Field label="Zamknij sprzedaż ile minut wcześniej?" htmlFor="salesCutoffMinutes">
                  <Input id="salesCutoffMinutes" type="number" min={0} max={10080} value={values.salesCutoffMinutes} onChange={(event) => updateValue("salesCutoffMinutes", event.target.value)} />
                </Field>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4 text-sm text-muted-foreground">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Przykład: 10:00–18:00, wizyta 60 minut i nowy termin co 60 minut utworzą wejścia od 10:00 do 17:00.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 5 ? (
          <div className="space-y-6">
            <Card className="surface-3d">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Sprawdź przed uruchomieniem</CardTitle>
                <CardDescription>To ostatni krok. Możesz wrócić i poprawić dowolną informację.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <SummaryCard icon={Building2} title="Organizator">
                  <p className="font-medium">{values.organizationName}</p>
                  {values.legalName ? <p>{values.legalName}</p> : null}
                  <p>{values.billingEmail}</p>
                </SummaryCard>
                <SummaryCard icon={MapPin} title="Atrakcja">
                  <p className="font-medium">{values.attractionName}</p>
                  <p>{selectedCategory?.name}</p>
                  <p>{values.address}, {values.postalCode ? `${values.postalCode} ` : ""}{values.city}</p>
                </SummaryCard>
                <SummaryCard icon={Store} title="Oferta">
                  <p className="font-medium">{values.productName}</p>
                  <p>{values.durationMinutes} min · {values.capacity} miejsc na termin</p>
                  <p>{salesMode === "allocated_quota" ? "Wydzielona pula dla EnjoyHub" : "Cała sprzedaż w EnjoyHub"}</p>
                </SummaryCard>
                <SummaryCard icon={Ticket} title="Bilety">
                  {tickets.map((ticket) => (
                    <p key={ticket.id}><span className="font-medium">{ticket.name}</span> · {ticket.price.replace(".", ",")} zł</p>
                  ))}
                </SummaryCard>
                <SummaryCard icon={CalendarClock} title="Terminy" className="sm:col-span-2">
                  <p>{weekdays.filter((day) => weekdaysValue.includes(day.value)).map((day) => day.short).join(", ")}</p>
                  <p>{values.localStartTime}–{values.localEndTime} · nowy termin co {values.slotIntervalMinutes} min</p>
                </SummaryCard>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox checked={accepted} onCheckedChange={(checked) => setAccepted(checked === true)} className="mt-0.5" />
                  <span className="text-sm leading-6">
                    Potwierdzam, że dane są prawidłowe, mam prawo sprzedawać bilety do tego obiektu i akceptuję utworzenie publicznej strony atrakcji.
                  </span>
                </label>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Cała konfiguracja powstanie w jednej operacji. Jeśli wystąpi błąd, system nie pozostawi niepełnej firmy, oferty ani terminów.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {stepError ? (
          <Alert variant="destructive" className="mt-5" role="alert">
            <AlertTitle>Sprawdź ten krok</AlertTitle>
            <AlertDescription>{stepError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => moveToStep(step - 1)} className="h-12">
              <ArrowLeft className="h-5 w-5" /> Wstecz
            </Button>
          ) : <span />}
          {step < stepLabels.length - 1 ? (
            <Button type="button" size="lg" onClick={goNext} className="h-12 px-7 text-base">
              Dalej <ArrowRight className="h-5 w-5" />
            </Button>
          ) : (
            <SubmitButton disabled={!accepted} />
          )}
        </div>
      </form>
    </div>
  )
}

function HiddenFormValues({
  values,
  tickets,
  weekdaysValue,
  salesMode,
  location,
  images,
  accepted,
}: {
  values: FormValues
  tickets: TicketRow[]
  weekdaysValue: number[]
  salesMode: SalesMode
  location: LocationValue | null
  images: ImageData[]
  accepted: boolean
}) {
  return (
    <div aria-hidden="true">
      {Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <input type="hidden" name="salesMode" value={salesMode} />
      <input type="hidden" name="latitude" value={location?.lat ?? ""} />
      <input type="hidden" name="longitude" value={location?.lng ?? ""} />
      <input type="hidden" name="propertyImages" value={JSON.stringify(images)} />
      <input type="hidden" name="accepted" value={accepted ? "yes" : ""} />
      {weekdaysValue.map((day) => <input key={day} type="hidden" name="weekdays" value={day} />)}
      {tickets.map((ticket) => (
        <div key={ticket.id}>
          <input type="hidden" name="ticketName" value={ticket.name} />
          <input type="hidden" name="ticketPrice" value={ticket.price} />
          <input type="hidden" name="ticketCapacityUnits" value={ticket.capacityUnits} />
          <input type="hidden" name="ticketMaxQuantity" value={ticket.maxQuantity} />
        </div>
      ))}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  help,
  className,
  children,
}: {
  label: string
  htmlFor: string
  help?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {help ? <p className="text-xs leading-5 text-muted-foreground">{help}</p> : null}
    </div>
  )
}

function SalesModeCard({
  selected,
  icon: Icon,
  title,
  description,
  badge,
  onClick,
}: {
  selected: boolean
  icon: typeof Store
  title: string
  description: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected ? "border-primary bg-primary/10" : "hover:bg-muted/50",
      )}
    >
      {badge ? <Badge variant="secondary" className="absolute right-3 top-3 text-[10px]">{badge}</Badge> : null}
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <span className={cn(
        "mt-4 inline-flex h-5 w-5 items-center justify-center rounded-full border",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
      )}>
        {selected ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
    </button>
  )
}

function SummaryCard({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon: typeof Store
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("rounded-xl border bg-muted/20 p-4", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}
