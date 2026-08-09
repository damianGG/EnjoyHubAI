"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar as CalendarIcon, Plus, X, Save, AlertCircle, CheckCircle } from "lucide-react"
import type { AttractionAvailability, SeasonalPrice, BookingMode } from "@/lib/types/dynamic-fields"
import { format, parseISO } from "date-fns"

interface AvailabilityManagerProps {
  propertyId: string
  initialAvailability?: AttractionAvailability | null
  basePrice: number
}

export default function AvailabilityManager({
  propertyId,
  initialAvailability,
  basePrice,
}: AvailabilityManagerProps) {
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    initialAvailability?.booking_mode || "daily"
  )
  const [minStay, setMinStay] = useState(initialAvailability?.min_stay || 1)
  const [maxStay, setMaxStay] = useState(initialAvailability?.max_stay || null)
  const [blockedDates, setBlockedDates] = useState<Date[]>(
    (initialAvailability?.blocked_dates || []).map(d => parseISO(d))
  )
  const [selectedDatesToBlock, setSelectedDatesToBlock] = useState<Date[]>([])
  const [seasonalPrices, setSeasonalPrices] = useState<SeasonalPrice[]>(
    initialAvailability?.seasonal_prices || []
  )
  
  // New seasonal price form
  const [newSeasonStart, setNewSeasonStart] = useState<Date | undefined>()
  const [newSeasonEnd, setNewSeasonEnd] = useState<Date | undefined>()
  const [newSeasonPrice, setNewSeasonPrice] = useState("")
  const [newSeasonName, setNewSeasonName] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleBlockDates = async () => {
    if (selectedDatesToBlock.length === 0) return

    try {
      const datesToBlock = selectedDatesToBlock.map(d => format(d, "yyyy-MM-dd"))
      
      const response = await fetch(`/api/attractions/${propertyId}/block-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          dates: datesToBlock,
          action: "block",
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setBlockedDates(prev => [...prev, ...selectedDatesToBlock])
        setSelectedDatesToBlock([])
        setSaveMessage({ type: "success", text: "Terminy zablokowane pomyślnie" })
      } else {
        setSaveMessage({ type: "error", text: "Nie udało się zablokować terminów" })
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Błąd podczas blokowania terminów" })
    }
  }

  const handleUnblockDate = async (date: Date) => {
    try {
      const dateStr = format(date, "yyyy-MM-dd")
      
      const response = await fetch(`/api/attractions/${propertyId}/block-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          dates: [dateStr],
          action: "unblock",
        }),
      })

      if (response.ok) {
        setBlockedDates(prev => prev.filter(d => format(d, "yyyy-MM-dd") !== dateStr))
        setSaveMessage({ type: "success", text: "Termin odblokowany pomyślnie" })
      } else {
        setSaveMessage({ type: "error", text: "Nie udało się odblokować terminu" })
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Błąd podczas odblokowywania terminu" })
    }
  }

  const handleAddSeasonalPrice = () => {
    if (!newSeasonStart || !newSeasonEnd || !newSeasonPrice || !newSeasonName) {
      setSaveMessage({ type: "error", text: "Wypełnij wszystkie pola ceny sezonowej" })
      return
    }

    const newSeason: SeasonalPrice = {
      start_date: format(newSeasonStart, "yyyy-MM-dd"),
      end_date: format(newSeasonEnd, "yyyy-MM-dd"),
      price: parseFloat(newSeasonPrice),
      name: newSeasonName,
    }

    setSeasonalPrices(prev => [...prev, newSeason])
    setNewSeasonStart(undefined)
    setNewSeasonEnd(undefined)
    setNewSeasonPrice("")
    setNewSeasonName("")
    setSaveMessage({ type: "success", text: "Cena sezonowa dodana. Pamiętaj, aby zapisać!" })
  }

  const handleRemoveSeasonalPrice = (index: number) => {
    setSeasonalPrices(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch(`/api/attractions/${propertyId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_mode: bookingMode,
          min_stay: minStay,
          max_stay: maxStay || null,
          seasonal_prices: seasonalPrices,
        }),
      })

      if (response.ok) {
        setSaveMessage({ type: "success", text: "Ustawienia zapisane pomyślnie!" })
      } else {
        setSaveMessage({ type: "error", text: "Nie udało się zapisać ustawień" })
      }
    } catch (error) {
      setSaveMessage({ type: "error", text: "Błąd podczas zapisywania ustawień" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {saveMessage && (
        <Alert variant={saveMessage.type === "error" ? "destructive" : "default"}>
          {saveMessage.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{saveMessage.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Ustawienia</TabsTrigger>
          <TabsTrigger value="blocked-dates">Zablokowane terminy</TabsTrigger>
          <TabsTrigger value="seasonal-pricing">Ceny sezonowe</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tryb rezerwacji</CardTitle>
              <CardDescription>Wybierz, jak goście mogą rezerwować ten obiekt</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={bookingMode} onValueChange={(value) => setBookingMode(value as BookingMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily" className="cursor-pointer">
                    Dobowy - pobyty wielodniowe (jak Airbnb)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hourly" id="hourly" />
                  <Label htmlFor="hourly" className="cursor-pointer">
                    Godzinowy - rezerwacje na przedziały czasowe
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wymagania dotyczące pobytu</CardTitle>
              <CardDescription>Ustaw minimalny i maksymalny czas pobytu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="minStay">
                  Minimalny pobyt ({bookingMode === "daily" ? "nocy" : "godzin"})
                </Label>
                <Input
                  id="minStay"
                  type="number"
                  min="1"
                  value={minStay}
                  onChange={(e) => setMinStay(parseInt(e.target.value) || 1)}
                  className="max-w-xs"
                />
              </div>
              <div>
                <Label htmlFor="maxStay">
                  Maksymalny pobyt ({bookingMode === "daily" ? "nocy" : "godzin"}) - opcjonalnie
                </Label>
                <Input
                  id="maxStay"
                  type="number"
                  min={minStay}
                  value={maxStay || ""}
                  onChange={(e) => setMaxStay(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Bez limitu"
                  className="max-w-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveSettings} disabled={isSaving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Zapisywanie..." : "Zapisz ustawienia"}
          </Button>
        </TabsContent>

        {/* Blocked Dates Tab */}
        <TabsContent value="blocked-dates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blokuj terminy</CardTitle>
              <CardDescription>Wybierz terminy, które mają być niedostępne do rezerwacji</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-md p-4">
                <Calendar
                  mode="multiple"
                  selected={selectedDatesToBlock}
                  onSelect={(dates) => setSelectedDatesToBlock(dates || [])}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    return date < today
                  }}
                  className="rounded-md"
                />
              </div>

              {selectedDatesToBlock.length > 0 && (
                <Button onClick={handleBlockDates}>
                  Zablokuj {selectedDatesToBlock.length} {selectedDatesToBlock.length === 1 ? "termin" : "terminów"}
                </Button>
              )}
            </CardContent>
          </Card>

          {blockedDates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Aktualnie zablokowane terminy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {blockedDates.map((date, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-2">
                      <CalendarIcon className="h-3 w-3" />
                      {format(date, "PPP")}
                      <button
                        onClick={() => handleUnblockDate(date)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Seasonal Pricing Tab */}
        <TabsContent value="seasonal-pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dodaj cenę sezonową</CardTitle>
              <CardDescription>
                Ustaw różne ceny dla wybranych zakresów dat (np. lato, święta)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nazwa sezonu</Label>
                  <Input
                    placeholder="np. Sezon letni"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Cena za noc</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={`Podstawowa: ${basePrice} zł`}
                    value={newSeasonPrice}
                    onChange={(e) => setNewSeasonPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data początkowa</Label>
                  <Calendar
                    mode="single"
                    selected={newSeasonStart}
                    onSelect={setNewSeasonStart}
                    className="rounded-md border"
                  />
                </div>
                <div>
                  <Label>Data końcowa</Label>
                  <Calendar
                    mode="single"
                    selected={newSeasonEnd}
                    onSelect={setNewSeasonEnd}
                    disabled={(date) => newSeasonStart ? date < newSeasonStart : false}
                    className="rounded-md border"
                  />
                </div>
              </div>

              <Button onClick={handleAddSeasonalPrice}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj cenę sezonową
              </Button>
            </CardContent>
          </Card>

          {seasonalPrices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Aktywne ceny sezonowe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {seasonalPrices.map((season, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{season.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {season.start_date} do {season.end_date}
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          {season.price} zł za noc
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSeasonalPrice(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button onClick={handleSaveSettings} disabled={isSaving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Zapisywanie..." : "Zapisz ceny sezonowe"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
