"use client"

import { useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { CalendarClock, MapPin, PlusCircle, Store, Ticket } from "lucide-react"

import { addOrganizerAttraction } from "@/app/host/atrakcje/nowa/actions"
import { ImageUploadSection } from "@/components/forms/ImageUploadSection"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const LocationPicker = dynamic(() => import("@/components/location-picker"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl border bg-muted" /> })

type Organization = { id: string; name: string }
type Category = { id: string; name: string; icon: string | null }
type ImageData = { url: string; publicId: string }

const weekdayOptions = [[1,"Pon"],[2,"Wt"],[3,"Śr"],[4,"Czw"],[5,"Pt"],[6,"Sob"],[7,"Niedz"]] as const

export function AddAttractionForm({ organizations, categories, userId }: { organizations: Organization[]; categories: Category[]; userId: string }) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const [days, setDays] = useState<number[]>([1,2,3,4,5,6,7])
  const onLocation = useCallback((lat: number, lng: number) => setLocation({ lat, lng }), [])

  return (
    <form action={addOrganizerAttraction} className="space-y-6">
      <input type="hidden" name="latitude" value={location?.lat ?? ""} />
      <input type="hidden" name="longitude" value={location?.lng ?? ""} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      {days.map((day) => <input key={day} type="hidden" name="weekdays" value={day} />)}

      <Card className="surface-3d">
        <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" /> Nowa atrakcja</CardTitle><CardDescription>Nie zakładamy nowego konta ani firmy. Atrakcję przypisujesz do istniejącej organizacji.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <Field label="Organizacja"><select name="organizationId" required defaultValue={organizations[0]?.id} className="h-11 w-full rounded-md border bg-background px-3 text-sm">{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Nazwa atrakcji"><Input name="attractionName" minLength={2} maxLength={160} required placeholder="np. Gokarty Rzeszów" /></Field>
          <Field label="Opis"><Textarea name="attractionDescription" minLength={20} maxLength={4000} required rows={4} placeholder="Co czeka klienta i dla kogo jest atrakcja?" /></Field>
          <Field label="Kategoria"><select name="categoryId" required defaultValue="" className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="" disabled>Wybierz kategorię</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.icon ? `${item.icon} ` : ""}{item.name}</option>)}</select></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Ulica i numer" className="sm:col-span-2"><Input name="address" required minLength={3} maxLength={240} /></Field><Field label="Kod pocztowy"><Input name="postalCode" maxLength={20} /></Field><Field label="Miejscowość"><Input name="city" required minLength={2} maxLength={120} /></Field></div>
          <div className="space-y-2"><Label>Położenie na mapie</Label><LocationPicker onLocationSelect={onLocation} selectedLat={location?.lat ?? null} selectedLng={location?.lng ?? null} /></div>
          <ImageUploadSection images={images} onImagesChange={setImages} userId={userId} maxImages={8} />
        </CardContent>
      </Card>

      <Card className="surface-3d">
        <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" /> Pierwsza oferta</CardTitle><CardDescription>Dodaj jeden podstawowy bilet. Kolejne warianty dopracujesz później.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Nazwa biletu"><Input name="ticketName" defaultValue="Bilet wstępu" required /></Field><Field label="Cena brutto (zł)"><Input name="ticketPrice" type="number" min="0.01" step="0.01" defaultValue="50" required /></Field><Field label="Czas wizyty (min)"><Input name="durationMinutes" type="number" min="1" defaultValue="60" required /></Field><Field label="Miejsca w terminie"><Input name="capacity" type="number" min="1" defaultValue="20" required /></Field></div>
          <Field label="Jak działa dostępność?"><select name="salesMode" defaultValue="allocated_quota" className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="allocated_quota">Mam własną kasę — wydzielam pulę dla EnjoyHub</option><option value="native_enjoyhub">Cała dostępność w EnjoyHub</option></select></Field>
          <div><Label>Dni dostępności</Label><div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdayOptions.map(([value,label]) => <button key={value} type="button" onClick={() => setDays((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current,value].sort())} className={cn("rounded-lg border px-2 py-3 text-sm font-medium", days.includes(value) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{label}</button>)}</div></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Pierwsze wejście"><Input name="localStartTime" type="time" defaultValue="10:00" required /></Field><Field label="Koniec wejść"><Input name="localEndTime" type="time" defaultValue="18:00" required /></Field></div>
          <Alert><CalendarClock className="h-4 w-4" /><AlertTitle>Automatyczny start</AlertTitle><AlertDescription>Utworzymy 90 dni terminów. Interwał będzie równy czasowi wizyty, a sprzedaż zamknie się 60 minut przed wejściem.</AlertDescription></Alert>
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button type="submit" size="lg" disabled={!location || days.length === 0}><Store className="h-4 w-4" /> Dodaj atrakcję i ofertę</Button></div>
    </form>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) { return <div className={cn("space-y-2", className)}><Label>{label}</Label>{children}</div> }
