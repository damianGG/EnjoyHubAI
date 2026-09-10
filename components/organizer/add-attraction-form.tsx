"use client"

import { useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { CalendarClock, Info, MapPin, PlusCircle, Store, Ticket } from "lucide-react"

import { addOrganizerAttraction } from "@/app/host/atrakcje/nowa/actions"
import { ImageUploadSection } from "@/components/forms/ImageUploadSection"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const LocationPicker = dynamic(() => import("@/components/location-picker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl border bg-muted" />,
})

type Organization = { id: string; name: string }
type Category = { id: string; name: string; icon: string | null }
type ImageData = { url: string; publicId: string }

const weekdayOptions = [
  [1, "Pon"], [2, "Wt"], [3, "Śr"], [4, "Czw"], [5, "Pt"], [6, "Sob"], [7, "Niedz"],
] as const

export function AddAttractionForm({
  organizations,
  categories,
  userId,
}: {
  organizations: Organization[]
  categories: Category[]
  userId: string
}) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const onLocation = useCallback((lat: number, lng: number) => setLocation({ lat, lng }), [])

  return (
    <form action={addOrganizerAttraction} className="space-y-6">
      <input type="hidden" name="latitude" value={location?.lat ?? ""} />
      <input type="hidden" name="longitude" value={location?.lng ?? ""} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      {days.map((day) => <input key={day} type="hidden" name="weekdays" value={day} />)}

      <Card className="surface-3d">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" /> Nowa atrakcja</CardTitle>
          <CardDescription>Nie zakładamy nowego konta ani firmy. Atrakcję przypisujesz do istniejącej organizacji.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Organizacja">
            <select name="organizationId" required defaultValue={organizations[0]?.id} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
              {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Nazwa atrakcji"><Input name="attractionName" minLength={2} maxLength={160} required placeholder="np. Gokarty Rzeszów" /></Field>
          <Field label="Opis atrakcji"><Textarea name="attractionDescription" minLength={20} maxLength={4000} required rows={4} placeholder="Co czeka klienta i dla kogo jest atrakcja?" /></Field>
          <Field label="Kategoria">
            <select name="categoryId" required defaultValue="" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
              <option value="" disabled>Wybierz kategorię</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.icon ? `${item.icon} ` : ""}{item.name}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ulica i numer" className="sm:col-span-2"><Input name="address" required minLength={3} maxLength={240} /></Field>
            <Field label="Kod pocztowy"><Input name="postalCode" maxLength={20} /></Field>
            <Field label="Miejscowość"><Input name="city" required minLength={2} maxLength={120} /></Field>
          </div>
          <div className="space-y-2"><Label>Położenie na mapie</Label><LocationPicker onLocationSelect={onLocation} selectedLat={location?.lat ?? null} selectedLng={location?.lng ?? null} /></div>
          <ImageUploadSection images={images} onImagesChange={setImages} userId={userId} maxImages={8} />
        </CardContent>
      </Card>

      <Card className="surface-3d">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Oferta i pierwszy rodzaj biletu</CardTitle>
          <CardDescription>Najpierw określ usługę, którą klient kupuje, a potem pierwszy wariant ceny.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Jedna atrakcja może mieć wiele ofert</AlertTitle>
            <AlertDescription>Przykład: „Park trampolin” to atrakcja. „Wejście 60 min” i „Urodziny 2 h” to dwie różne oferty. Każda oferta może mieć własne rodzaje biletów i kalendarz.</AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nazwa oferty" className="sm:col-span-2"><Input name="offerName" minLength={2} maxLength={180} defaultValue="Wejście standardowe" required placeholder="np. Wejście 60 minut" /></Field>
            <Field label="Co obejmuje oferta? (opcjonalnie)" className="sm:col-span-2"><Textarea name="offerDescription" maxLength={4000} rows={3} placeholder="np. 60 minut korzystania ze wszystkich stref" /></Field>
            <Field label="Pierwszy rodzaj biletu"><Input name="ticketName" maxLength={120} defaultValue="Bilet wstępu" required placeholder="np. Bilet normalny" /></Field>
            <Field label="Cena brutto (zł)"><Input name="ticketPrice" type="number" min="0.01" max="1000000" step="0.01" defaultValue="50" required /></Field>
            <Field label="Dla kogo jest bilet? (opcjonalnie)" className="sm:col-span-2"><Input name="ticketDescription" maxLength={1000} placeholder="np. osoba dorosła od 16 lat" /></Field>
            <Field label="Czas jednej wizyty (min)"><Input name="durationMinutes" type="number" min="1" max="1440" defaultValue="60" required /></Field>
            <Field label="Miejsca w jednym terminie"><Input name="capacity" type="number" min="1" max="100000" defaultValue="20" required /></Field>
          </div>

          <Field label="Jak działa dostępność?">
            <select name="salesMode" defaultValue="allocated_quota" className="h-11 w-full rounded-md border bg-background px-3 text-sm">
              <option value="allocated_quota">Mam własną kasę — wydzielam pulę dla EnjoyHub</option>
              <option value="native_enjoyhub">Cała dostępność w EnjoyHub</option>
            </select>
          </Field>

          <div>
            <Label>Stała reguła tygodniowa</Label>
            <p className="mt-1 text-xs text-muted-foreground">Zaznacz dni, w które ta oferta zwykle jest dostępna.</p>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdayOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort())}
                  className={cn("rounded-lg border px-2 py-3 text-sm font-medium", days.includes(value) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pierwsze wejście"><Input name="localStartTime" type="time" defaultValue="10:00" required /></Field>
            <Field label="Koniec okna wejść"><Input name="localEndTime" type="time" defaultValue="18:00" required /></Field>
          </div>

          <Alert>
            <CalendarClock className="h-4 w-4" />
            <AlertTitle>Kalendarz będzie utrzymywany automatycznie</AlertTitle>
            <AlertDescription>Ta reguła tygodniowa jest źródłem prawdy. EnjoyHub tworzy z niej przyszłe terminy i stale przedłuża horyzont. Święta, zamknięcia, inne godziny i specjalną pojemność ustawisz jako wyjątki w „Kalendarz i dostępność”.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!location || days.length === 0}><Ticket className="h-4 w-4" /> Dodaj atrakcję i ofertę</Button>
      </div>
    </form>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2", className)}><Label>{label}</Label>{children}</div>
}
