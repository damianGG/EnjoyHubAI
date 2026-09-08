"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { ArrowLeft, CalendarDays, MapPin, Minus, Plus, Search, Sparkles, Users } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BrandLogo } from "@/components/brand-logo"
import { useUrlState } from "@/lib/search/url-state"
import { getEnjoyHubCategoryIcon } from "@/lib/category-icon-assets"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
  image_url?: string
}

interface SearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const fallbackCategories: Category[] = [
  { id: "paintball", name: "Paintball", slug: "paintball", icon: "🎯" },
  { id: "gokarty", name: "Gokarty", slug: "gokarty", icon: "🏎️" },
  { id: "trampoliny", name: "Park trampolin", slug: "park-trampolin", icon: "🤸" },
  { id: "plac-zabaw", name: "Place zabaw", slug: "plac-zabaw", icon: "🛝" },
  { id: "park-linowy", name: "Park linowy", slug: "park-linowy", icon: "🧗" },
  { id: "escape-room", name: "Escape room", slug: "escape-room", icon: "🗝️" },
]

export function SearchDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: SearchDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>(fallbackCategories)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [guests, setGuests] = useState(1)
  const [ageMin, setAgeMin] = useState("")
  const [ageMax, setAgeMax] = useState("")
  const urlState = useUrlState()

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setIsOpen = isControlled ? controlledOnOpenChange || (() => {}) : setInternalOpen

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("categories")
          .select("id,name,slug,icon,image_url")
          .order("name")

        if (data?.length) setCategories(data)
      } catch {
        // The visual search flow remains usable with local fallbacks in preview environments.
      }
    }

    void loadCategories()
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const currentCategories = urlState.get("categories") || ""
    setSelectedCategories(currentCategories ? currentCategories.split(",") : [])
    setLocation(urlState.get("q") || "")
    setDate(urlState.get("date") || "")
    setAgeMin(urlState.get("age_min") || "")
    setAgeMax(urlState.get("age_max") || "")

    const currentGuests = Number.parseInt(urlState.get("guests") || "1", 10)
    setGuests(Number.isFinite(currentGuests) && currentGuests > 0 ? currentGuests : 1)
  }, [isOpen])

  const toggleCategory = (slug: string) => {
    setSelectedCategories((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    )
  }

  const clearAll = () => {
    setSelectedCategories([])
    setLocation("")
    setDate("")
    setGuests(1)
    setAgeMin("")
    setAgeMax("")
  }

  const handleSearch = () => {
    let normalizedMin = ageMin.trim()
    let normalizedMax = ageMax.trim()

    const min = Number.parseInt(normalizedMin, 10)
    const max = Number.parseInt(normalizedMax, 10)
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      normalizedMin = String(max)
      normalizedMax = String(min)
    }

    urlState.setMany({
      page: 1,
      categories: selectedCategories.join(","),
      q: location.trim(),
      date,
      guests: String(guests),
      age_min: normalizedMin,
      age_max: normalizedMax,
    })
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none bg-[#fffdfa] p-0 md:h-auto md:max-h-[88vh] md:max-w-2xl md:rounded-[28px]"
      >
        <DialogTitle className="sr-only">Znajdź atrakcję</DialogTitle>

        <header className="sticky top-0 z-20 border-b border-black/[0.055] bg-white/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl md:px-6 md:py-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full border border-black/[0.07] bg-white text-foreground"
              aria-label="Wróć"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="md:hidden"><BrandLogo mobile href={undefined} /></div>
            <button onClick={clearAll} className="text-xs font-bold text-primary md:text-sm">Wyczyść</button>
          </div>

          <div className="mt-4 md:mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary md:text-xs">Odkrywaj</p>
            <h2 className="mt-1 text-[1.65rem] font-extrabold leading-tight tracking-[-0.045em] text-foreground md:text-3xl">
              Znajdź coś dla siebie
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground md:text-sm">
              Wybierz rodzaj atrakcji, miejsce i termin. Resztę pokażemy na mapie.
            </p>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-7 px-4 py-5 pb-32 md:px-6 md:py-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
                <h3 className="text-sm font-extrabold tracking-[-0.02em]">Czego szukasz?</h3>
              </div>

              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {categories.map((category) => {
                  const selected = selectedCategories.includes(category.slug)
                  const localImage = getEnjoyHubCategoryIcon(category.slug)
                  const imageUrl = localImage || category.image_url

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.slug)}
                      className={cn(
                        "flex min-h-[94px] flex-col items-center justify-center rounded-[20px] border bg-white px-2 py-3 text-center transition-all",
                        selected
                          ? "border-primary bg-secondary shadow-[0_8px_22px_rgba(244,117,33,0.12)] ring-1 ring-primary/15"
                          : "border-black/[0.06] shadow-[0_5px_16px_rgba(58,39,20,0.05)]"
                      )}
                    >
                      {imageUrl ? (
                        <span className="relative mb-2 h-11 w-11 overflow-hidden rounded-xl bg-orange-50/70">
                          <Image
                            src={imageUrl}
                            alt=""
                            fill
                            className={localImage ? "object-contain p-0.5" : "object-cover"}
                            sizes="44px"
                          />
                        </span>
                      ) : (
                        <span className="mb-2 text-[28px] leading-none">{category.icon || "✨"}</span>
                      )}
                      <span className={cn("line-clamp-2 text-[10.5px] font-bold leading-tight", selected ? "text-primary" : "text-foreground")}>{category.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><MapPin className="h-3.5 w-3.5" /></span>
                <h3 className="text-sm font-extrabold tracking-[-0.02em]">Gdzie?</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Miasto, okolica lub nazwa atrakcji"
                  className="h-14 rounded-[18px] border-black/[0.07] bg-white pl-11 text-sm shadow-sm focus-visible:ring-primary/25"
                />
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><CalendarDays className="h-3.5 w-3.5" /></span>
                  <h3 className="text-sm font-extrabold tracking-[-0.02em]">Kiedy?</h3>
                </div>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-14 rounded-[18px] border-black/[0.07] bg-white px-4 text-sm shadow-sm focus-visible:ring-primary/25"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><Users className="h-3.5 w-3.5" /></span>
                  <h3 className="text-sm font-extrabold tracking-[-0.02em]">Ile osób?</h3>
                </div>
                <div className="flex h-14 items-center justify-between rounded-[18px] border border-black/[0.07] bg-white px-3 shadow-sm">
                  <button type="button" onClick={() => setGuests((value) => Math.max(1, value - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary" aria-label="Mniej osób"><Minus className="h-4 w-4" /></button>
                  <div className="text-center"><span className="block text-base font-extrabold">{guests}</span><span className="block text-[9px] font-semibold text-muted-foreground">{guests === 1 ? "osoba" : "osoby"}</span></div>
                  <button type="button" onClick={() => setGuests((value) => Math.min(30, value + 1))} className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary" aria-label="Więcej osób"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-extrabold tracking-[-0.02em]">Wiek uczestników <span className="font-medium text-muted-foreground">(opcjonalnie)</span></h3>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" min="0" max="99" value={ageMin} onChange={(event) => setAgeMin(event.target.value)} placeholder="Od ilu lat" className="h-13 rounded-[16px] border-black/[0.07] bg-white shadow-sm" />
                <Input type="number" min="0" max="99" value={ageMax} onChange={(event) => setAgeMax(event.target.value)} placeholder="Do ilu lat" className="h-13 rounded-[16px] border-black/[0.07] bg-white shadow-sm" />
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-black/[0.055] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:static md:px-6 md:pb-5">
          <Button onClick={handleSearch} className="h-13 w-full rounded-full text-sm font-extrabold orange-glow md:h-12">
            <Search className="mr-2 h-4 w-4" />
            Pokaż atrakcje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
