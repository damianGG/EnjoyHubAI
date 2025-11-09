"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, MapPin, X } from "lucide-react"
import { useUrlState } from "@/lib/search/url-state"

interface SearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: SearchDialogProps) {
  const [open, setOpen] = useState(false)
  const urlState = useUrlState()
  
  // Filter state
  const [location, setLocation] = useState("")
  const [ageMin, setAgeMin] = useState("")
  const [ageMax, setAgeMax] = useState("")

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : open
  const setIsOpen = isControlled ? controlledOnOpenChange || (() => {}) : setOpen

  // Load current filters from URL when dialog opens
  useEffect(() => {
    if (isOpen) {
      const currentLocation = urlState.get("q") || ""
      setLocation(currentLocation)
      
      const currentAgeMin = urlState.get("age_min") || ""
      const currentAgeMax = urlState.get("age_max") || ""
      setAgeMin(currentAgeMin)
      setAgeMax(currentAgeMax)
    }
  }, [isOpen])

  const handleSearch = () => {
    const updates: Record<string, any> = {
      page: 1,
    }

    if (location.trim()) {
      updates.q = location.trim()
    } else {
      updates.q = ""
    }

    if (ageMin) {
      updates.age_min = ageMin
    } else {
      updates.age_min = ""
    }

    if (ageMax) {
      updates.age_max = ageMax
    } else {
      updates.age_max = ""
    }

    urlState.setMany(updates)
    setIsOpen(false)
  }

  const handleClearAll = () => {
    setLocation("")
    setAgeMin("")
    setAgeMax("")
    
    urlState.setMany({
      q: "",
      age_min: "",
      age_max: "",
      page: 1,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-2">
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Wyszukaj</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 gap-0" showCloseButton={false}>
        {/* Close button in top right */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-gray-100 transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 space-y-6">
          {/* Where Section */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Gdzie?</h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Wyszukaj kierunki"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-12 h-14 text-base border-2 rounded-xl focus-visible:ring-0 focus-visible:border-primary"
              />
            </div>
          </div>

          {/* When Section - Adapted for Age */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Wiek uczestników</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Od"
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value)}
                      className="h-10 border-gray-300"
                      min="0"
                      max="99"
                    />
                  </div>
                  <span className="text-gray-400">-</span>
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Do"
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      className="h-10 border-gray-300"
                      min="0"
                      max="99"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t p-4 flex items-center justify-between bg-white">
          <Button 
            variant="ghost" 
            onClick={handleClearAll}
            className="text-sm underline hover:no-underline"
          >
            Wyczyść wszystko
          </Button>
          <Button 
            onClick={handleSearch}
            className="bg-pink-600 hover:bg-pink-700 text-white px-8 rounded-lg"
            size="lg"
          >
            <Search className="h-4 w-4 mr-2" />
            Szukaj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
