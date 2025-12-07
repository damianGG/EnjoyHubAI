"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface HostCreateOfferDialogProps {
  propertyId: string
  onOfferCreated: () => void
}

export default function HostCreateOfferDialog({ propertyId, onOfferCreated }: HostCreateOfferDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    base_price: "",
    currency: "PLN",
    max_participants: "",
    is_active: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/host/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          place_id: propertyId,
          title: formData.title,
          description: formData.description || undefined,
          base_price: parseFloat(formData.base_price),
          duration_minutes: 30, // Fixed 30-minute slots
          currency: formData.currency,
          max_participants: formData.max_participants ? parseInt(formData.max_participants, 10) : undefined,
          is_active: formData.is_active,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create offer")
      }

      toast.success("Oferta utworzona pomyślnie!")
      setOpen(false)
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        base_price: "",
        currency: "PLN",
        max_participants: "",
        is_active: true,
      })
      
      // Notify parent to refresh
      onOfferCreated()
    } catch (error) {
      console.error("Error creating offer:", error)
      toast.error(error instanceof Error ? error.message : "Nie udało się utworzyć oferty")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj ofertę
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Utwórz nową ofertę</DialogTitle>
            <DialogDescription>
              Dodaj ofertę usługi lub aktywności dla swojego obiektu
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Nazwa oferty *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="np. Wycieczka rowerowa"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opisz swoją ofertę..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="base_price">Cena bazowa *</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="currency">Waluta</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="PLN"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="max_participants">Maks. uczestników</Label>
              <Input
                id="max_participants"
                type="number"
                value={formData.max_participants}
                onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                placeholder="Opcjonalne"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Aktywna</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Tworzenie..." : "Utwórz ofertę"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
