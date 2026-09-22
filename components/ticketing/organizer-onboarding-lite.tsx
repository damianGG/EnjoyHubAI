"use client"

import { ActivityCategorySelect } from "@/components/activity-category-select"

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

type Category = { id: string; name: string; slug: string; icon: string | null; description: string | null }
type Subcategory = { id: string; parentCategoryId: string; name: string; icon: string | null; description: string | null }
type ImageData = { url: string; publicId: string }
type LocationValue = { lat: number; lng: number }
type SalesMode = "allocated_quota" | "native_enjoyhub" | ""
type PricingModel = "per_person" | "per_group" | ""

interface Props {
  categories: Category[]
  subcategories: Subcategory[]
  userId: string
  userEmail: string
}

interface Values {
  organizationName: string
  attractionName: string
  attractionDescription: string
  categoryId: string
  subcategoryId: string
  address: string
  postalCode: string
  city: string
  offerName: string
  offerDescription: string
  ticketName: string
  ticketDescription: string
  ticketPrice: string
  pricingModel: PricingModel
  durationMinutes: string
  minParticipants: string
  capacity: string
  ticketMaxQuantity: string
  salesCutoffMinutes: string
  availableFrom: string
  localStartTime: string
  localEndTime: string
  slotIntervalMinutes: string
}

const initialState: OrganizerOnboardingActionState = {}
const stepLabels = ["Firma", "Atrakcja", "Oferta i bilet", "Terminy", "Podsumowanie"]
const nextStepLabels = [
  "Dalej: opisz atrakcję",
  "Dalej: ustaw ofertę",
  "Dalej: ustaw terminy",
  "Sprawdź i opublikuj",
]
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

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0")
  const minutes = (value % 60).toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

function polishDateToday() {
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

function formatPolishDate(value: string) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "Europe/Warsaw" })
    .format(new Date(`${value}T12:00:00+02:00`))
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function OrganizerOnboardingLite({ categories, subcategories, userId, userEmail }: Props) {
  const [state, formAction] = useActionState(completeOrganizerOnboarding, initialState)
  const [step, setStep] = useState(0)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const [location, setLocation] = useState<LocationValue | null>(null)
  const [days, setDays] = useState<number[]>([])
  const [salesMode, setSalesMode] = useState<SalesMode>("")
  const [values, setValues] = useState<Values>({
    organizationName: "",
    attractionName: "",
    attractionDescription: "",
    categoryId: "",
    subcategoryId: "",
    address: "",
    postalCode: "",
    city: "",
    offerName: "",
    offerDescription: "",
    ticketName: "",
    ticketDescription: "",
    ticketPrice: "",
    pricingModel: "",
    durationMinutes: "",
    minParticipants: "",
    capacity: "",
    ticketMaxQuantity: "",
    salesCutoffMinutes: "",
    availableFrom: "",
    localStartTime: "",
    localEndTime: "",
    slotIntervalMinutes: "",
  })

  const storageKey = `enjoyhub.organizer-onboarding-lite.v4.${userId}`
  const legacyStorageKey = `enjoyhub.organizer-onboarding-lite.v3.${userId}`
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === values.categoryId),
    [categories, values.categoryId],
  )
  const availableSubcategories = useMemo(
    () => subcategories.filter((item) => item.parentCategoryId === values.categoryId),
    [subcategories, values.categoryId],
  )
  const selectedSubcategory = useMemo(
    () => subcategories.find((item) => item.id === values.subcategoryId),
    [subcategories, values.subcategoryId],
  )
  const examples = useMemo(() => {
    const categoryName = `${selectedCategory?.name ?? ""} ${selectedSubcategory?.name ?? ""}`.toLocaleLowerCase("pl")
    if (categoryName.includes("paintball")) {
      return { offer: "Gra paintballowa – pakiet 500 kulek", ticket: "Uczestnik", description: "Gra, wyposażenie ochronne i 500 kulek dla każdego uczestnika." }
    }
    if (categoryName.includes("gokart")) {
      return { offer: "Przejazd gokartem – 10 minut", ticket: "Kierowca", description: "10-minutowy przejazd, kask i krótkie szkolenie." }
    }
    return { offer: "Wejście 60 minut", ticket: "Bilet normalny", description: "Opisz, co dokładnie otrzymuje klient w cenie." }
  }, [selectedCategory, selectedSubcategory])

  useEffect(() => {
    try {
      const currentDraft = localStorage.getItem(storageKey)
      const raw = currentDraft ?? localStorage.getItem(legacyStorageKey)
      const isLegacyDraft = !currentDraft && Boolean(raw)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.values) setValues((current) => ({ ...current, ...saved.values }))
      if (Array.isArray(saved.days)) setDays(saved.days)
      if (saved.location) setLocation(saved.location)
      if (Array.isArray(saved.images)) setImages(saved.images.slice(0, 8))
      if (Number.isInteger(saved.step) && saved.step >= 0 && saved.step < stepLabels.length) {
        setStep(isLegacyDraft ? Math.min(saved.step, 2) : saved.step)
      }
      if (!isLegacyDraft && (saved.salesMode === "native_enjoyhub" || saved.salesMode === "allocated_quota")) {
        setSalesMode(saved.salesMode)
      }
    } catch {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(legacyStorageKey)
    } finally {
      setDraftLoaded(true)
    }
  }, [legacyStorageKey, storageKey])

  useEffect(() => {
    if (!draftLoaded) return
    localStorage.setItem(storageKey, JSON.stringify({ values, days, location, images, salesMode, step }))
  }, [days, draftLoaded, images, location, salesMode, step, storageKey, values])

  const entryTimes = useMemo(() => {
    const duration = Number(values.durationMinutes)
    const interval = Number(values.slotIntervalMinutes)
    if (!values.localStartTime || !values.localEndTime || !Number.isFinite(duration) || duration < 1 || !Number.isFinite(interval) || interval < 1) return []

    const start = timeToMinutes(values.localStartTime)
    const end = timeToMinutes(values.localEndTime)
    if (end <= start || end - start < duration) return []

    const slots: string[] = []
    for (let current = start; current + duration <= end; current += interval) {
      slots.push(minutesToTime(current))
    }
    return slots
  }, [values.durationMinutes, values.localEndTime, values.localStartTime, values.slotIntervalMinutes])

  const actualLastVisitEnd = useMemo(() => {
    const lastEntry = entryTimes.at(-1)
    const duration = Number(values.durationMinutes)
    if (!lastEntry || !Number.isFinite(duration)) return null
    return minutesToTime(timeToMinutes(lastEntry) + duration)
  }, [entryTimes, values.durationMinutes])
  const entryTimesPreview = entryTimes.length > 12
    ? `${entryTimes.slice(0, 12).join(", ")}…`
    : entryTimes.join(", ")

  const onLocation = useCallback((lat: number, lng: number) => {
    setLocation({ lat, lng })
    setError(null)
  }, [])

  function setValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  function setCategory(categoryId: string) {
    setValues((current) => ({ ...current, categoryId, subcategoryId: "" }))
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
      if (availableSubcategories.length > 0 && !values.subcategoryId) return "Wybierz rodzaj atrakcji w tej kategorii."
      if (values.address.trim().length < 3 || values.city.trim().length < 2) return "Uzupełnij adres i miejscowość."
      if (!location) return "Zaznacz lokalizację na mapie."
    }

    if (step === 2) {
      if (values.offerName.trim().length < 2) return "Podaj nazwę oferty, czyli tego, co klient kupuje."
      if (!values.pricingModel) return "Wybierz, czy cena dotyczy jednej osoby, czy całej grupy i terminu."
      if (!values.ticketName.trim() || Number(values.ticketPrice) <= 0) return "Podaj nazwę i cenę pierwszego rodzaju biletu."
      if (Number(values.durationMinutes) < 1) return "Podaj czas jednej wizyty."
    }

    if (step === 3) {
      if (!salesMode) return "Wybierz, czy prowadzisz rezerwacje również poza EnjoyHub."
      if (Number(values.capacity) < 1) return "Podaj liczbę miejsc dostępną na jeden termin."
      if (Number(values.minParticipants) < 1 || Number(values.minParticipants) > Number(values.capacity)) {
        return "Minimalna liczba uczestników musi wynosić od 1 do liczby miejsc na termin."
      }
      if (values.pricingModel === "per_person" && Number(values.minParticipants) > 100) {
        return "Przy cenie za osobę minimalna liczba uczestników nie może przekraczać 100."
      }
      if (values.pricingModel === "per_person" && (
        Number(values.ticketMaxQuantity) < Number(values.minParticipants)
        || Number(values.ticketMaxQuantity) > Number(values.capacity)
      )) {
        return "Maksymalna liczba biletów w zamówieniu musi mieścić się między minimum uczestników a liczbą miejsc."
      }
      const today = polishDateToday()
      if (!values.availableFrom || values.availableFrom < today || values.availableFrom > addDays(today, 275)) {
        return "Wybierz datę rozpoczęcia od dzisiaj do maksymalnie 275 dni naprzód."
      }
      if (!days.length) return "Wybierz przynajmniej jeden dzień dostępności."
      if (!values.localStartTime || !values.localEndTime) return "Podaj godzinę pierwszego wejścia i zakończenia ostatniej wizyty."
      if (values.localStartTime >= values.localEndTime) return "Godzina końcowa musi być późniejsza niż początkowa."
      if (Number(values.slotIntervalMinutes) < 1) return "Podaj, co ile minut może rozpoczynać się kolejny termin."
      if (values.salesCutoffMinutes === "" || Number(values.salesCutoffMinutes) < 0 || Number(values.salesCutoffMinutes) > 10080) {
        return "Wyprzedzenie zamknięcia sprzedaży musi wynosić od 0 do 10 080 minut."
      }
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

  function goToStep(target: number) {
    setStep(target)
    setError(null)
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
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          Szkic zapisujemy automatycznie na tym urządzeniu. Możesz wrócić i dokończyć później.
        </p>
      </div>

      <form action={formAction} onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <input type="hidden" name="organizationName" value={values.organizationName} />
        <input type="hidden" name="legalName" value="" />
        <input type="hidden" name="taxId" value="" />
        <input type="hidden" name="billingEmail" value={userEmail} />
        <input type="hidden" name="attractionName" value={values.attractionName} />
        <input type="hidden" name="attractionDescription" value={values.attractionDescription} />
        <input type="hidden" name="categoryId" value={values.categoryId} />
        <input type="hidden" name="subcategoryId" value={values.subcategoryId} />
        <input type="hidden" name="address" value={values.address} />
        <input type="hidden" name="postalCode" value={values.postalCode} />
        <input type="hidden" name="city" value={values.city} />
        <input type="hidden" name="latitude" value={location?.lat ?? ""} />
        <input type="hidden" name="longitude" value={location?.lng ?? ""} />
        <input type="hidden" name="propertyImages" value={JSON.stringify(images)} />
        <input type="hidden" name="salesMode" value={salesMode} />
        <input type="hidden" name="productName" value={values.offerName} />
        <input type="hidden" name="productDescription" value={values.offerDescription} />
        <input type="hidden" name="pricingModel" value={values.pricingModel} />
        <input type="hidden" name="durationMinutes" value={values.durationMinutes} />
        <input type="hidden" name="minParticipants" value={values.minParticipants} />
        <input type="hidden" name="capacity" value={values.capacity} />
        <input type="hidden" name="availableFrom" value={values.availableFrom} />
        <input type="hidden" name="localStartTime" value={values.localStartTime} />
        <input type="hidden" name="localEndTime" value={values.localEndTime} />
        <input type="hidden" name="slotIntervalMinutes" value={values.slotIntervalMinutes} />
        <input type="hidden" name="salesCutoffMinutes" value={values.salesCutoffMinutes} />
        <input type="hidden" name="ticketName" value={values.ticketName} />
        <input type="hidden" name="ticketDescription" value={values.ticketDescription} />
        <input type="hidden" name="ticketPrice" value={values.ticketPrice} />
        <input type="hidden" name="ticketCapacityUnits" value={values.pricingModel === "per_group" ? values.capacity : "1"} />
        <input type="hidden" name="ticketMinQuantity" value={values.pricingModel === "per_group" ? "1" : values.minParticipants} />
        <input type="hidden" name="ticketMaxQuantity" value={values.pricingModel === "per_group" ? "1" : values.ticketMaxQuantity} />
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
              <Input id="organizationNameVisible" maxLength={160} value={values.organizationName} onChange={(e) => setValue("organizationName", e.target.value)} placeholder="np. Park Przygody" autoFocus />
              <p className="text-xs text-muted-foreground">To może być nazwa marki widoczna dla klientów. Pełną nazwę prawną i NIP dodasz przed uruchomieniem płatności.</p>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Co chcesz pokazać klientom?</CardTitle>
              <CardDescription>Atrakcja to publiczna strona miejsca lub aktywności. Te informacje klient zobaczy przed wyborem biletu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Nazwa atrakcji" htmlFor="attractionNameVisible"><Input id="attractionNameVisible" maxLength={160} value={values.attractionName} onChange={(e) => setValue("attractionName", e.target.value)} placeholder="np. Paintball Rzeszów" autoFocus /></Field>
              <Field label="Krótki opis atrakcji" htmlFor="attractionDescriptionVisible" help={`${values.attractionDescription.length}/4000 znaków · minimum 20`}><Textarea id="attractionDescriptionVisible" maxLength={4000} value={values.attractionDescription} onChange={(e) => setValue("attractionDescription", e.target.value)} rows={4} placeholder="Co czeka klienta, dla kogo jest atrakcja i dlaczego warto przyjechać?" /></Field>
<ActivityCategorySelect
                categories={categories}
                subcategories={subcategories}
                categoryValue={values.categoryId}
                subcategoryValue={values.subcategoryId}
                onCategoryChange={setCategory}
                onSubcategoryChange={(id) => setValue("subcategoryId", id)}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ulica i numer" htmlFor="addressVisible" className="sm:col-span-2"><Input id="addressVisible" maxLength={240} value={values.address} onChange={(e) => setValue("address", e.target.value)} placeholder="ul. Przykładowa 10" /></Field>
                <Field label="Kod pocztowy" htmlFor="postalCodeVisible"><Input id="postalCodeVisible" maxLength={20} value={values.postalCode} onChange={(e) => setValue("postalCode", e.target.value)} placeholder="35-001" /></Field>
                <Field label="Miejscowość" htmlFor="cityVisible"><Input id="cityVisible" maxLength={120} value={values.city} onChange={(e) => setValue("city", e.target.value)} placeholder="Rzeszów" /></Field>
              </div>
              <div className="space-y-2">
                <Label>Dokładne miejsce wejścia na mapie</Label>
                <p className="text-xs text-muted-foreground">Kliknij punkt, do którego ma trafić klient. Lokalizację wykorzystamy na stronie atrakcji i w nawigacji.</p>
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
                  Przykład: „Paintball Rzeszów” to atrakcja, „Gra z pakietem 500 kulek” to oferta, a „Uczestnik” to rodzaj biletu w tej ofercie.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nazwa oferty" htmlFor="offerNameVisible" help="Klient wybierze tę nazwę przed wskazaniem terminu." className="sm:col-span-2">
                  <Input id="offerNameVisible" maxLength={180} value={values.offerName} onChange={(e) => setValue("offerName", e.target.value)} placeholder={`np. ${examples.offer}`} />
                </Field>
                <Field label="Co obejmuje oferta? (opcjonalnie)" htmlFor="offerDescriptionVisible" className="sm:col-span-2">
                  <Textarea id="offerDescriptionVisible" maxLength={4000} value={values.offerDescription} onChange={(e) => setValue("offerDescription", e.target.value)} rows={3} placeholder={examples.description} />
                </Field>
                <div className="sm:col-span-2">
                  <Label>Czego dotyczy podana cena?</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Wybierz świadomie — ten wybór zmienia sposób liczenia miejsc.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Choice selected={values.pricingModel === "per_person"} title="Cena za jedną osobę" text="Klient wybiera liczbę uczestników i płaci za każdą osobę." onClick={() => setValue("pricingModel", "per_person")} />
                    <Choice selected={values.pricingModel === "per_group"} title="Cena za całą grupę i termin" text="Klient kupuje jedną rezerwację, która blokuje cały termin dla jego grupy." onClick={() => setValue("pricingModel", "per_group")} />
                  </div>
                </div>
                <Field label="Pierwszy rodzaj biletu" htmlFor="ticketNameVisible">
                  <Input id="ticketNameVisible" maxLength={120} value={values.ticketName} onChange={(e) => setValue("ticketName", e.target.value)} placeholder={values.pricingModel === "per_group" ? "np. Rezerwacja grupowa" : `np. ${examples.ticket}`} />
                </Field>
                <Field label="Cena brutto (zł)" htmlFor="ticketPriceVisible" help={values.pricingModel === "per_group" ? "To pełna cena za rezerwację całego terminu." : "To cena brutto za jednego uczestnika."}>
                  <Input id="ticketPriceVisible" type="number" min="0.01" max="1000000" step="0.01" value={values.ticketPrice} onChange={(e) => setValue("ticketPrice", e.target.value)} placeholder="np. 120" />
                </Field>
                <Field label="Dla kogo jest ten bilet? (opcjonalnie)" htmlFor="ticketDescriptionVisible" className="sm:col-span-2">
                  <Input id="ticketDescriptionVisible" maxLength={1000} value={values.ticketDescription} onChange={(e) => setValue("ticketDescription", e.target.value)} placeholder={values.pricingModel === "per_group" ? "np. grupa od 8 do 20 osób" : "np. uczestnik od 16 lat"} />
                </Field>
                <Field label="Ile trwa jedna wizyta? (min)" htmlFor="durationMinutesVisible" help="Czas trwania określa, kiedy każda wizyta się zakończy." className="sm:col-span-2">
                  <Input id="durationMinutesVisible" type="number" min="1" max="1440" value={values.durationMinutes} onChange={(e) => setValue("durationMinutes", e.target.value)} placeholder="np. 120" />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Na początek dodaj jeden podstawowy rodzaj biletu. Przed publikacją sprawdzisz jego nazwę i cenę.</p>
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="surface-3d">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Kiedy klient może zarezerwować?</CardTitle>
              <CardDescription>Ustaw typowy tydzień. Święta, zamknięcia i pojedyncze zmiany dodasz później jako wyjątki.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Czy prowadzisz rezerwacje również poza EnjoyHub?</Label>
                <p className="mt-1 text-xs text-muted-foreground">Wybierz jedną odpowiedź. EnjoyHub nie zaznacza żadnej opcji za Ciebie.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Choice selected={salesMode === "allocated_quota"} title="Tak — mam własny system" text="Rezerwuję dla EnjoyHub osobną pulę miejsc, żeby uniknąć podwójnej sprzedaży." onClick={() => setSalesMode("allocated_quota")} />
                  <Choice selected={salesMode === "native_enjoyhub"} title="Nie — wszystko w EnjoyHub" text="Rezerwacje online, telefoniczne i klientów z wejścia zapisuję w jednym kalendarzu EnjoyHub." onClick={() => setSalesMode("native_enjoyhub")} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Minimalna liczba uczestników" htmlFor="minParticipantsVisible" help="Najmniejsza grupa, dla której można zarezerwować ofertę.">
                  <Input id="minParticipantsVisible" type="number" min="1" max={values.pricingModel === "per_person" ? 100 : 100000} value={values.minParticipants} onChange={(e) => setValue("minParticipants", e.target.value)} placeholder="np. 1" />
                </Field>
                <Field
                  label={values.pricingModel === "per_group" ? "Maksymalna wielkość grupy" : salesMode === "allocated_quota" ? "Ile miejsc rezerwujesz dla EnjoyHub?" : "Ile łącznie miejsc ma termin?"}
                  htmlFor="capacityVisible"
                  help={values.pricingModel === "per_group" ? "Jedna rezerwacja grupowa zablokuje cały termin do tej liczby osób." : salesMode === "allocated_quota" ? "EnjoyHub nie sprzeda więcej niż ta wydzielona pula." : "Każda rezerwacja — także telefoniczna i na miejscu — powinna trafić do kalendarza EnjoyHub."}
                >
                  <Input id="capacityVisible" type="number" min="1" max="100000" value={values.capacity} onChange={(e) => setValue("capacity", e.target.value)} placeholder="np. 20" />
                </Field>
                {values.pricingModel === "per_person" ? (
                  <Field label="Maks. biletów w jednym zamówieniu" htmlFor="ticketMaxQuantityVisible" help="Nie może przekraczać liczby miejsc na termin." className="sm:col-span-2">
                    <Input id="ticketMaxQuantityVisible" type="number" min="1" max="100" value={values.ticketMaxQuantity} onChange={(e) => setValue("ticketMaxQuantity", e.target.value)} placeholder="np. 20" />
                  </Field>
                ) : (
                  <Alert className="sm:col-span-2">
                    <Ticket className="h-4 w-4" />
                    <AlertTitle>Jedno zamówienie = cały termin</AlertTitle>
                    <AlertDescription>Przy cenie grupowej klient kupi jedną rezerwację, a pozostałe miejsca w tym terminie zostaną zablokowane.</AlertDescription>
                  </Alert>
                )}
              </div>

              <Field label="Od kiedy klienci mogą rezerwować?" htmlFor="availableFromVisible" help="Pierwsze terminy utworzymy nie wcześniej niż w wybranym dniu.">
                <Input id="availableFromVisible" type="date" min={polishDateToday()} max={addDays(polishDateToday(), 275)} value={values.availableFrom} onChange={(e) => setValue("availableFrom", e.target.value)} />
              </Field>

              <div>
                <Label>W które dni oferta jest zwykle dostępna?</Label>
                <p className="mt-1 text-xs text-muted-foreground">Zaznacz dni, w które ta oferta zwykle jest dostępna.</p>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {weekdays.map((day) => (
                    <button key={day.value} type="button" aria-pressed={days.includes(day.value)} onClick={() => toggleDay(day.value)} className={cn("rounded-lg border px-2 py-3 text-sm font-medium", days.includes(day.value) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{day.label}</button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Godzina pierwszego wejścia" htmlFor="localStartTimeVisible"><Input id="localStartTimeVisible" type="time" value={values.localStartTime} onChange={(e) => setValue("localStartTime", e.target.value)} /></Field>
                <Field label="Najpóźniejsza godzina zakończenia" htmlFor="localEndTimeVisible" help="Nie utworzymy wizyty, która kończy się po tej godzinie."><Input id="localEndTimeVisible" type="time" value={values.localEndTime} onChange={(e) => setValue("localEndTime", e.target.value)} /></Field>
                <Field label="Co ile minut może zacząć się termin?" htmlFor="slotIntervalMinutesVisible" help="Może być krócej niż czas wizyty, jeśli obsługujesz kilka grup jednocześnie.">
                  <Input id="slotIntervalMinutesVisible" type="number" min="1" max="1440" value={values.slotIntervalMinutes} onChange={(e) => setValue("slotIntervalMinutes", e.target.value)} placeholder="np. 60" />
                </Field>
                <Field label="Ile minut wcześniej zamknąć sprzedaż?" htmlFor="salesCutoffMinutesVisible" help="Wpisz 0, jeśli klient może kupić bilet aż do rozpoczęcia terminu.">
                  <Input id="salesCutoffMinutesVisible" type="number" min="0" max="10080" value={values.salesCutoffMinutes} onChange={(e) => setValue("salesCutoffMinutes", e.target.value)} placeholder="np. 60" />
                </Field>
              </div>

              {entryTimes.length ? (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
                  <CalendarClock className="h-4 w-4" />
                  <AlertTitle>Klient zobaczy {entryTimes.length} {entryTimes.length === 1 ? "termin" : "terminów"} dziennie</AlertTitle>
                  <AlertDescription>
                    Godziny rozpoczęcia: {entryTimesPreview}. Ostatnia wizyta faktycznie zakończy się o {actualLastVisitEnd}.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Alert>
                <CalendarClock className="h-4 w-4" />
                <AlertTitle>Co zrobi EnjoyHub?</AlertTitle>
                <AlertDescription>
                  Automatycznie utworzymy terminy od {values.availableFrom ? formatPolishDate(values.availableFrom) : "wybranej daty"} i będziemy pilnować wolnych miejsc. Ustawienia możesz później zmienić w kalendarzu.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <Card className="surface-3d">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Gotowe do publikacji</CardTitle>
                <CardDescription>Sprawdź, co pokażemy klientom. Każdą sekcję możesz jeszcze poprawić.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Summary icon={Building2} title="Organizator" onEdit={() => goToStep(0)}>{values.organizationName}</Summary>
                <Summary icon={MapPin} title="Atrakcja" onEdit={() => goToStep(1)}>{values.attractionName}<br />{selectedCategory?.name}{selectedSubcategory ? ` → ${selectedSubcategory.name}` : ""}<br />{values.address}, {values.city}<br />{images.length ? `${images.length} zdjęć` : "Bez zdjęć"}</Summary>
                <Summary icon={Store} title="Oferta" onEdit={() => goToStep(2)}>{values.offerName}<br />{values.durationMinutes} min</Summary>
                <Summary icon={Ticket} title="Cena i uczestnicy" onEdit={() => goToStep(2)}>{values.ticketName} · {values.ticketPrice.replace(".", ",")} zł {values.pricingModel === "per_group" ? "za całą grupę i termin" : "za osobę"}<br />Grupa: {values.minParticipants}–{values.capacity} os.{values.pricingModel === "per_person" ? <><br />Maks. {values.ticketMaxQuantity} biletów w zamówieniu</> : null}</Summary>
                <Summary icon={CalendarClock} title="Dostępność" onEdit={() => goToStep(3)}>Od {formatPolishDate(values.availableFrom)}<br />{days.map((day) => weekdays.find((item) => item.value === day)?.label).join(", ")}<br />Starty: {entryTimesPreview}<br />Ostatnie zakończenie: {actualLastVisitEnd}<br />{salesMode === "allocated_quota" ? "Wydzielona pula dla EnjoyHub" : "Cała dostępność w EnjoyHub"}</Summary>
              </CardContent>
            </Card>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Co stanie się po publikacji?</AlertTitle>
              <AlertDescription>
                Strona atrakcji zostanie opublikowana od razu. Terminy powstaną od wybranej daty, ale po publikacji poprosimy Cię o ich sprawdzenie. Sprzedaż online pozostanie wyłączona do czasu uzupełnienia danych firmy i połączenia rachunku do wypłat.
              </AlertDescription>
            </Alert>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <label htmlFor="publishConfirmation" className="flex cursor-pointer items-start gap-3">
                  <Checkbox id="publishConfirmation" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} className="mt-0.5" />
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
            <Button type="button" variant="outline" size="lg" onClick={() => goToStep(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Wstecz
            </Button>
          ) : <span />}
          {step < stepLabels.length - 1 ? (
            <Button type="button" size="lg" onClick={next}>{nextStepLabels[step]} <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <SubmitButton disabled={!accepted} />
          )}
        </div>
      </form>
    </div>
  )
}

function Field({ label, children, className, help, htmlFor }: { label: string; children: React.ReactNode; className?: string; help?: string; htmlFor?: string }) {
  return <div className={cn("space-y-2", className)}><Label htmlFor={htmlFor}>{label}</Label>{children}{help ? <p className="text-xs text-muted-foreground">{help}</p> : null}</div>
}

function Choice({ selected, title, text, onClick }: { selected: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cn("rounded-xl border p-4 text-left", selected ? "border-primary bg-primary/10" : "hover:bg-muted")}>
      <div className="flex items-center gap-2 font-medium">{selected ? <Check className="h-4 w-4 text-primary" /> : null}{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </button>
  )
}

function Summary({ icon: Icon, title, children, onEdit }: { icon: typeof Building2; title: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</span>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-primary hover:underline">Zmień</button>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}
