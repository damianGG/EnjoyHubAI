"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [guests, setGuests] = useState("")

  const handleSearch = () => {
    // Handle search logic here
    console.log({ location, date, guests })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Wyszukaj aktywność</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-base font-semibold">
              Gdzie?
            </Label>
            <Input
              id="location"
              placeholder="Wpisz miasto lub region"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-base font-semibold">
              Kiedy?
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <Label htmlFor="guests" className="text-base font-semibold">
              Ile osób?
            </Label>
            <Input
              id="guests"
              type="number"
              min="1"
              placeholder="Liczba uczestników"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSearch} 
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            <Search className="mr-2 h-5 w-5" />
            Szukaj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
