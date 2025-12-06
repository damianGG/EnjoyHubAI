"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Save } from "lucide-react"
import { toast } from "sonner"
import type { OfferAvailability } from "@/lib/types/dynamic-fields"

interface OfferAvailabilityManagerProps {
  offerId: string
  durationMinutes: number
  initialAvailability: OfferAvailability[]
}

const WEEKDAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
]

interface AvailabilitySlot {
  id?: string
  weekday: number
  start_time: string
  end_time: string
  slot_length_minutes: number
  max_bookings_per_slot: number
}

export default function OfferAvailabilityManager({
  offerId,
  durationMinutes,
  initialAvailability,
}: OfferAvailabilityManagerProps) {
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
    setIsSaving(true)
    try {
      // Delete all existing availability
      const deleteResponse = await fetch(`/api/admin/offers/${offerId}/availability`, {
        method: "DELETE",
      })

      if (!deleteResponse.ok) {
        throw new Error("Failed to delete existing availability")
      }

      // Create new availability slots
      const createPromises = slots.map(slot =>
        fetch(`/api/admin/offers/${offerId}/availability`, {
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
      )

      const results = await Promise.all(createPromises)
      const allSuccessful = results.every(r => r.ok)

      if (!allSuccessful) {
        throw new Error("Failed to save some availability slots")
      }

      toast.success("Availability saved successfully!")
    } catch (error) {
      console.error("Error saving availability:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save availability")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability Schedule</CardTitle>
          <CardDescription>
            Define when this offer is available each week. Each slot represents a recurring time window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {slots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No availability slots defined yet</p>
              <Button onClick={addSlot}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Slot
              </Button>
            </div>
          ) : (
            <>
              {slots.map((slot, index) => (
                <Card key={index} className="p-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Weekday</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          value={slot.weekday}
                          onChange={(e) => updateSlot(index, "weekday", parseInt(e.target.value))}
                        >
                          {WEEKDAYS.map(day => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Max Bookings Per Slot</Label>
                        <Input
                          type="number"
                          min="1"
                          value={slot.max_bookings_per_slot}
                          onChange={(e) => updateSlot(index, "max_bookings_per_slot", parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => updateSlot(index, "start_time", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => updateSlot(index, "end_time", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Slot Length (min)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={slot.slot_length_minutes}
                          onChange={(e) => updateSlot(index, "slot_length_minutes", parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeSlot(index)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              <Button onClick={addSlot} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Another Slot
              </Button>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={handleSave} disabled={isSaving || slots.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Availability"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
