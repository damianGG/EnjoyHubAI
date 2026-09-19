"use client"

import { useActionState, useCallback, useEffect, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import dynamic from "next/dynamic"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Store,
  Ticket,
} from "lucide-react"

import {
  completeOrganizerOnboarding,
  type OrganizerOnboardingActionState,
} from "@/app/host/onboarding/actions"
import { ImageUploadSection } from "@/components/forms/ImageUploadSection"
import { LocationAutocomplete } from "@/components/location-autocomplete"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import type { LocationReverseResponse, LocationSuggestion } from "@/lib/locations/types"
import { cn } from "@/lib/utils"

const LocationPicker = dynamic(() => import("@/components/location-picker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl border bg-muted" />,
})

type Category = { id: string; name: string; icon: string | null; description: string | null }
type ImageData = { url: string; publicId: string }
type LocationValue = { lat: number; lng: number }
type SalesMode = "allocated_quota" | "native_enjoyhub"

interface Props {
  categories: Category[]
  userId: string
  userEmail: string
}

interface Values {
  organizationName: string
  attractionName: string
  attractionDescription: string
  categoryId: string
  address: string
  postalCode: string
  city: string
  offerName: string
  offerDescription: string
  ticketName: string
  ticketDescription: string
  ticketPrice: string
  durationMinutes: string
  capacity: string
  localStartTime: string
  localEndTime: string
}

const initialState: OrganizerOnboardingActionState = {}
const stepLabels = ["Firma", "Atrakcja", "Oferta", "Podsumowanie"]
const weekdays = [
  { value: 1, label: "Pon" },
  { value: 2, label: "Wt" },
  { value: 3, label: "Śr" },
  { value: 4, label: "Czw" },
  { value: 5, label: "Pt" },
  { value: 6, label: "Sob" },
  { value: 7, label: "Niedz" },
]

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="h-12" disabled={disabled || pending}>
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Tworzę atrakcję…</>
      ) : (
        <><CheckCircle2 className="h-4 w-4" /> Opublikuj atrakcję</>
      )}
    </Button>
  )
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

function clean(value: string, maximum: number) {
  return value.trim().slice(0, maximum)
}

export function OrganizerOnboardingLite({ categories, userId, userEmail }: Props) {
  const [state, formAction] = useActionState(completeOrganizerOnboarding, initialState)
  const [step, setStep] = useState(0)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const [salesMode, setSalesMode] = useState<SalesMode>("allocated_quota")
  const [values, setValues] = useState<Values>({
    organizationName: "",
    attractionName: "",
    attractionDescription: "",
    categoryId: "",
    address: "",
    postalCode: "",
    city: "",
    offerName: "Wejście standardowe",
    offerDescription: "",
    ticketName: "Bilet wstępu",
    ticketDescription: "",
    ticketPrice: "50",
    durationMinutes: "60",
    capacity: "20",
    localStartTime: "10:00",
    localEndTime: "18:00",
  })

  const storageKey = `enjoyhub.organizer-onboarding-lite.v2.${userId}`
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === values.categoryId),
    [categories, values.categoryId],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.values) setValues((current) => ({ ...current, ...saved.values }))
      if (Array.isArray(saved.days) && saved.days.length) setDays(saved.days)
      if (saved.location) setLocation(saved.location)
      if (Array.isArray(saved.images)) setImages(saved.images.slice(0, 8))
      if (saved.salesMode === "native_enjoyhub" || saved.salesMode === "allocated_quota") {
        setSalesMode(saved.salesMode)
      }
    } catch {
      localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ values, days, location, images, salesMode }))
  }, [days, images, location, salesMode, storageKey, values])

  const applyAddressSuggestion = useCallback((item: LocationSuggestion) => {
    setValues((current) => ({
      ...current,
      address: clean(item.addressLine || item.label, 240),
      postalCode: clean(item.postcode, 20),
      city: clean(item.city, 120),
    }))
    setLocation({ lat: item.latitude, lng: item.longitude })
    setError(null)
  }, [])

  const onLocation = useCallback((lat: number, lng: number) => {
    setLocation({ lat, lng })
    setError(null)

    void (async () => {
      try {
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
        const response = await fetch(`/api/locations/reverse?${params.toString()}`)
        if (!response.ok) return
        const payload = await response.json() as LocationReverseResponse
        if (!payload.item) return

        setValues((current) => ({
          ...current,
          address: clean(payload.item.addressLine || payload.item.label, 240),
          postalCode: clean(payload.item.postcode, 20),
          city: clean(payload.item.city, 120),
        }))
      } catch {
        // Keep the chosen coordinates when reverse geocoding is temporarily unavailable.
      }
    })()
  }, [])

  function setValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  function validate() {
    if (step === 0 && values.organizationName.trim().length < 2) {
      return "Podaj nazwę firmy lub marki."
    }

    if (step === 1) {
      if (values.attractionName.trim().length < 2) return "Podaj nazwę atrakcji."
      if (values.attractionDescription.trim().length < 20) return "Dodaj krótki opis atrakcji — minimum 20 znaków."
      if (!values.categoryId) return "Wybierz kategorię."
      if (values.address.trim().length < 3 || values.city.trim().length < 2) return "Uzupełnij adres i miejscowość."
      if (!location) return "Wybierz adres z podpowiedzi albo zaznacz lokalizację na mapie."
    }

    if (step === 2) {
      if (values.offerName.trim().length < 2) return "Podaj nazwę oferty, czyli tego, co klient kupuje."
      if (!values.ticketName.trim() || Number(values.ticketPrice) <= 0) return "Podaj nazwę i cenę pierwszego rodzaju biletu."
      if (Number(values.durationMinutes) < 1 || Number(values.capacity) < 1) return "Czas wizyty i liczba miejsc muszą być większe od zera."
      if (!days.length) return "Wybierz przynajmniej jeden dzień dostępności."
      if (values.localStartTime >= values.localEndTime) return "Godzina końcowa musi być późniejsza niż początkowa."
      if (timeToMinutes(values.localEndTime) - timeToMinutes(values.localStartTime) < Number(values.durationMinutes)) {
        return "Godziny dostępności muszą mieścić co najmniej jedną pełną wizytę."
      }
    }

    return null
  }

  function next() {
    const message = validate()
    if (message) return setError(message)
    setError(null)
    setStep((current) => Math.min(current + 1, stepLabels.length - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function toggleDay(day: number) {
    setDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day].sort())
    setError(null)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step < stepLabels.length - 1) {
      event.preventDefault()
      next()
      return
    }
    if (!accepted) {
      event.preventDefault()
      setError("Potwierdź dane i prawo do publikacji atrakcji.")
    }
  }

  const progress = ((step + 1) / stepLabels.length) * 100

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <Badge variant="secondary">Krok {step + 1} z {stepLabels.length}</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Dodaj pierwszą atrakcję</h1>
        <p className="mt-3 text-muted-foreground">
          Na start potrzebujemy tylko minimum. Dane prawne, kolejne oferty, dodatkowe rodzaje biletów i wyjątki w kalendarzu uzupełnisz później.
        </p>
      </div>

      <div className="mx-auto mb-7 max-w-3xl">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          {stepLabels.map((label, index) => (
            <span key={label} className={index === step ? "font-semibold text-primary" : ""}>
              {index < step ? "✓ " : ""}{label}
            </span>
          ))}
        </div>
        <Progress value={progress} />
      </div>

      <form action={formAction} onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <input type="hidden" name="organizationName" value={values.organizationName} />
        <input type="hidden" name="legalName" value="" />
        <input type="hidden" name="taxId" value="" />
        <input type="hidden" name="billingEmail" value={userEmail} />
        <input type="hidden" name="attractionName" value={values.attractionName} />
        <input type="hidden" name="attractionDescription" value={values.attractionDescription} />
        <input type="hidden" name="categoryId" value={values.categoryId} />
        <input type="hidden" name="address" value={values.address} />
        <input type="hidden" name="postalCode" value={values.postalCode} />
        <input type="hidden" name="city" value={values.city} />
        <input type="hidden" name="latitude" value={location?.lat ?? ""} />
        <input type="hidden" name="longitude" value={location?.lng ?? ""} />
        <input type="hidden" name="propertyImages" value={JSON.stringify(images)} />
        <input type="hidden" name="salesMode" value={salesMode} />
        <input type="hidden" name="productName" value={values.offerName} />
        <input type="hidden" name="productDescription" value={values.offerDescription} />
        <input type="hidden" name="durationMinutes" value={values.durationMinutes} />
        <input type="hidden" name="capacity" value={values.capacity} />
        <input type="hidden" name="localStartTime" value={values.localStartTime} />
        <input type="hidden" name="localEndTime" value={values.localEndTime} />
        <input type="hidden" name="slotIntervalMinutes" value={values.durationMinutes} />
        <input type="hidden" name="salesCutoffMinutes" value="60" />
        <input type="hidden" name="ticketName" value={values.ticketName} />
        <input type="hidden" name="ticketDescription" value={values.ticketDescription} />
        <input type="hidden" name="ticketPrice" value={values.ticketPrice} />
        <input type="hidden" name="ticketCapacityUnits" value="1" />
        <input type="hidden" name="ticketMaxQuantity" value="10" />
        <input type="hidden" name="accepted" value={accepted ? "yes" : ""} />
        {days.map((day) => <input key={day} type="hidden" name="weekdays" value={day} />)}

        {state.error ? (
          <Alert variant="destructive" className="mb-5">
            <AlertTitle>Nie udało się zakończyć</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {step === 0 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Jak nazywa się Twój biznes?</CardTitle>
              <CardDescription>Nie prosimy teraz o dane prawne. Najpierw dodaj atrakcję.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="organizationNameVisible">Nazwa firmy lub marki</Label>
              <Input id="organizationNameVisible" value={values.organizationName} onChange={(e) => setValue("organizationName", e.target.value)} placeholder="np. Park Przygody" autoFocus />
              <p className="text-xs text-muted-foreground">To może być nazwa marki widoczna dla klientów. Pełną nazwę prawną i NIP dodasz przed uruchomieniem płatności.</p>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Co chcesz pokazać klientom?</CardTitle>
              <CardDescription>Atrakcja to publiczna strona miejsca lub aktywności, np. park trampolin albo gokarty.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Nazwa atrakcji"><Input value={values.attractionName} onChange={(e) => setValue("attractionName", e.target.value)} placeholder="Park Linowy Wisła" autoFocus /></Field>
              <Field label="Krótki opis atrakcji"><Textarea value={values.attractionDescription} onChange={(e) => setValue("attractionDescription", e.target.value)} rows={4} placeholder="Co czeka klienta, dla kogo jest atrakcja i dlaczego warto przyjechać?" /></Field>
              <Field label="Kategoria">
                <select value={values.categoryId} onChange={(e) => setValue("categoryId", e.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Wybierz kategorię</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ""}{category.name}</option>)}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Adres lub nazwa obiektu" className="sm:col-span-2">
                  <LocationAutocomplete
                    mode="address"
                    value={values.address}
                    onValueChange={(value) => {
                      setValue("address", value)
                      setLocation(null)
                    }}
                    onSelect={applyAddressSuggestion}
                    placeholder="np. Rejtana 20, Rzeszów albo nazwa obiektu"
                  />
                </Field>
                <Field label="Kod pocztowy"><Input value={values.postalCode} onChange={(e) => setValue("postalCode", e.target.value)} placeholder="35-001" /></Field>
                <Field label="Miejscowość">
                  <LocationAutocomplete
                    mode="city"
                    value={values.city}
                    onValueChange={(value) => setValue("city", value)}
                    onSelect={(item) => setValue("city", clean(item.city || item.label, 120))}
                    placeholder="Rzeszów"
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>Położenie na mapie</Label>
                <p className="text-xs text-muted-foreground">Po wybraniu adresu pinezka ustawi się automatycznie. Klikając mapę możesz skorygować punkt, a adres zostanie ponownie rozpoznany.</p>
                <LocationPicker onLocationSelect={onLocation} selectedLat={location?.lat ?? null} selectedLng={location?.lng ?? null} />
              </div>
              <ImageUploadSection images={images} onImagesChange={setImages} userId={userId} maxImages={8} />
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Co dokładnie kupuje klient?</CardTitle>
              <CardDescription>
                Oferta określa usługę i czas wizyty. Rodzaj biletu określa cenę lub uprawnienie, np. normalny, ulgowy albo rodzinny.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Ticket className="h-4 w-4" />
                <AlertTitle>Atrakcja ≠ oferta ≠ rodzaj biletu</AlertTitle>
                <AlertDescription>
                  Przykład: „Park Trampolin Rzeszów” to atrakcja, „Wejście 60 minut” to oferta, a „Bilet normalny” i „Bilet ulgowy” to warianty biletu w tej ofercie.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nazwa oferty" className="sm:col-span-2">
                  <Input value={values.offerName} onChange={(e) => setValue("offerName", e.target.value)} placeholder="np. Wejście 60 minut" />
                </Field>
                <Field label="Co obejmuje oferta? (opcjonalnie)" className="sm:col-span-2">
                  <Textarea value={values.offerDescription} onChange={(e) => setValue("offerDescription", e.target.value)} rows={3} placeholder="Np. 60 minut korzystania ze wszystkich stref parku." />
                </Field>
                <Field label="Pierwszy rodzaj biletu">
                  <Input value={values.ticketName} onChange={(e) => setValue("ticketName", e.target.value)} placeholder="Bilet normalny" />
                </Field>
                <Field label="Cena brutto (zł)">
                  <Input type="number" min="0.01" step="0.01" value={values.ticketPrice} onChange={(e) => setValue("ticketPrice", e.target.value)} />
                </Field>
                <Field label="Dla kogo jest ten bilet? (opcjonalnie)" className="sm:col-span-2">
                  <Input value={values.ticketDescription} onChange={(e) => setValue("ticketDescription", e.target.value)} placeholder="np. osoba dorosła od 16 lat" />
                </Field>
                <Field label="Czas jednej wizyty (min)">
                  <Input type="number" min="1" value={values.durationMinutes} onChange={(e) => setValue("durationMinutes", e.target.value)} />
                </Field>
                <Field label={salesMode === "allocated_quota" ? "Miejsca dla EnjoyHub / termin" : "Wszystkie miejsca / termin"}>
                  <Input type="number" min="1" value={values.capacity} onChange={(e) => setValue("capacity", e.target.value)} />
                </Field>
              </div>

              <div>
                <Label>Jak sprzedajesz na miejscu?</Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Choice selected={salesMode === "allocated_quota"} title="Mam własną kasę" text="EnjoyHub dostaje wydzieloną pulę miejsc." onClick={() => setSalesMode("allocated_quota")} />
                  <Choice selected={salesMode === "native_enjoyhub"} title="Sprzedaję przez EnjoyHub" text="EnjoyHub prowadzi całą dostępność." onClick={() => setSalesMode("native_enjoyhub")} />
                </div>
              </div>

              <div>
                <Label>Stała reguła tygodniowa</Label>
                <p className="mt-1 text-xs text-muted-foreground">Zaznacz dni, w które ta oferta zwykle jest dostępna.</p>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {weekdays.map((day) => (
                    <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={cn("rounded-lg border px-2 py-3 text-sm font-medium", days.includes(day.value) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{day.label}</button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pierwsze wejście"><Input type="time" value={values.localStartTime} onChange={(e) => setValue("localStartTime", e.target.value)} /></Field>
                <Field label="Koniec okna wejść"><Input type="time" value={values.localEndTime} onChange={(e) => setValue("localEndTime", e.target.value)} /></Field>
              </div>

              <Alert>
                <CalendarClock className="h-4 w-4" />
                <AlertTitle>Nie będziesz ręcznie układać kalendarza</AlertTitle>
                <AlertDescription>
                  Ta reguła tygodniowa jest źródłem prawdy. EnjoyHub automatycznie utrzymuje przyszłe terminy. Pojedyncze święta, zamknięcia, inne godziny lub inną pojemność ustawisz później jako wyjątek.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <Card className="surface-3d">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Gotowe do publikacji</CardTitle>
                <CardDescription>Po tym kroku zobaczysz swoją atrakcję tak jak klient.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Summary icon={Building2} title="Organizator">{values.organizationName}</Summary>
                <Summary icon={MapPin} title="Atrakcja">{values.attractionName}<br />{selectedCategory?.name}<br />{values.city}</Summary>
                <Summary icon={Store} title="Oferta">{values.offerName}<br />{values.durationMinutes} min</Summary>
                <Summary icon={Ticket} title="Rodzaj biletu">{values.ticketName} · {values.ticketPrice.replace(".", ",")} zł</Summary>
                <Summary icon={CalendarClock} title="Dostępność">{days.map((day) => weekdays.find((item) => item.value === day)?.label).join(", ")}<br />{values.localStartTime}–{values.localEndTime} · {values.capacity} miejsc</Summary>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} className="mt-0.5" />
                  <span className="text-sm leading-6">Potwierdzam poprawność danych i że mam prawo opublikować oraz sprzedawać bilety do tej atrakcji.</span>
                </label>
                <p className="mt-3 text-xs text-muted-foreground">Strona atrakcji powstanie od razu. Płatności online uruchomimy dopiero po weryfikacji danych firmy.</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="mt-5"><AlertTitle>Sprawdź ten krok</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        ) : null}

        <div className="mt-6 flex items-center justify-between border-t pt-6">
          {step > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => { setStep((current) => current - 1); setError(null) }}>
              <ArrowLeft className="h-4 w-4" /> Wstecz
            </Button>
          ) : <span />}
          {step < 3 ? (
            <Button type="button" size="lg" onClick={next}>Dalej <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <SubmitButton disabled={!accepted} />
          )}
        </div>
      </form>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2", className)}><Label>{label}</Label>{children}</div>
}

function Choice({ selected, title, text, onClick }: { selected: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-xl border p-4 text-left", selected ? "border-primary bg-primary/10" : "hover:bg-muted")}>
      <div className="flex items-center gap-2 font-medium">{selected ? <Check className="h-4 w-4 text-primary" /> : null}{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </button>
  )
}

function Summary({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</div>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}
