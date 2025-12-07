"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Save } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OfferAvailability } from "@/lib/types/dynamic-fields"

interface HostOfferAvailabilityManagerProps {
  offerId: string
  durationMinutes: number
  initialAvailability: OfferAvailability[]
  onSaved?: () => void
}

const WEEKDAYS = [
  { value: 0, label: "Poniedziałek" },
  { value: 1, label: "Wtorek" },
  { value: 2, label: "Środa" },
  { value: 3, label: "Czwartek" },
  { value: 4, label: "Piątek" },
  { value: 5, label: "Sobota" },
  { value: 6, label: "Niedziela" },
]

interface AvailabilitySlot {
  id?: string
  weekday: number
  start_time: string
  end_time: string
  slot_length_minutes: number
  max_bookings_per_slot: number
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export default function HostOfferAvailabilityManager({
  offerId,
  durationMinutes,
  initialAvailability,
  onSaved,
}: HostOfferAvailabilityManagerProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>(
    initialAvailability.map(a => ({
      id: a.id,
      weekday: a.weekday,
      start_time: a.start_time,
      end_time: a.end_time,
      slot_length_minutes: a.slot_length_minutes,
      max_bookings_per_slot: a.max_bookings_per_slot,
    }))
  )
  const [isSaving, setIsSaving] = useState(false)

  const addSlot = () => {
    setSlots([
      ...slots,
      {
        weekday: 0,
        start_time: "09:00",
        end_time: "17:00",
        slot_length_minutes: durationMinutes,
        max_bookings_per_slot: 1,
      },
    ])
  }

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index))
  }

  const updateSlot = (index: number, field: keyof AvailabilitySlot, value: string | number) => {
    const newSlots = [...slots]
    newSlots[index] = { ...newSlots[index], [field]: value }
    setSlots(newSlots)
  }

  const handleSave = async () => {
    // Validate time ranges before saving
    const invalidSlots = slots.filter(slot => {
      const startMinutes = timeToMinutes(slot.start_time)
      const endMinutes = timeToMinutes(slot.end_time)
      return startMinutes >= endMinutes
    })

    if (invalidSlots.length > 0) {
      toast.error("Godzina rozpoczęcia musi być wcześniejsza niż zakończenia")
      return
    }

    setIsSaving(true)
    try {
      // Delete all existing availability
      const deleteResponse = await fetch(`/api/host/offers/${offerId}/availability`, {
        method: "DELETE",
      })

      if (!deleteResponse.ok) {
        throw new Error("Failed to delete existing availability")
      }

      // Create new availability slots
      for (const slot of slots) {
        const response = await fetch(`/api/host/offers/${offerId}/availability`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekday: slot.weekday,
            start_time: slot.start_time,
            end_time: slot.end_time,
            slot_length_minutes: slot.slot_length_minutes,
            max_bookings_per_slot: slot.max_bookings_per_slot,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to create availability slot")
        }
      }

      toast.success("Dostępność zapisana pomyślnie!")
      if (onSaved) {
        onSaved()
      }
    } catch (error) {
      console.error("Error saving availability:", error)
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać dostępności")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Harmonogram dostępności</CardTitle>
        <CardDescription>
          Skonfiguruj dni i godziny, w których Twoja oferta jest dostępna dla rezerwacji
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {slots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Nie skonfigurowano jeszcze żadnych slotów dostępności
            </p>
            <Button onClick={addSlot} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Dodaj pierwszy slot
            </Button>
          </div>
        ) : (
          <>
            {slots.map((slot, index) => (
              <Card key={index} className="p-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Dzień tygodnia</Label>
                      <Select
                        value={slot.weekday.toString()}
                        onValueChange={(value) => updateSlot(index, "weekday", parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((day) => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Długość slotu (min)</Label>
                      <Input
                        type="number"
                        value={slot.slot_length_minutes}
                        onChange={(e) =>
                          updateSlot(index, "slot_length_minutes", parseInt(e.target.value))
                        }
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Godzina rozpoczęcia</Label>
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => updateSlot(index, "start_time", e.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Godzina zakończenia</Label>
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => updateSlot(index, "end_time", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Maksymalna liczba rezerwacji na slot</Label>
                    <Input
                      type="number"
                      value={slot.max_bookings_per_slot}
                      onChange={(e) =>
                        updateSlot(index, "max_bookings_per_slot", parseInt(e.target.value))
                      }
                      min="1"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeSlot(index)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Usuń slot
                  </Button>
                </div>
              </Card>
            ))}

            <Button onClick={addSlot} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Dodaj kolejny slot
            </Button>
          </>
        )}

        {slots.length > 0 && (
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Zapisywanie..." : "Zapisz wszystkie sloty"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
