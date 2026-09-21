"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { ArrowLeft, CalendarDays, MapPin, Minus, Plus, Search, Sparkles, Users, WalletCards } from "lucide-react"

import { DynamicFilterSection, type DynamicFilterCondition, type DynamicFilterDefinition } from "@/components/dynamic-filter-section"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { BrandLogo } from "@/components/brand-logo"
import { CATEGORY_GROUPS } from "@/lib/category-groups"
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

interface CategoryGroupView {
  slug: string
  name: string
  icon: string
  categories: Category[]
}

interface DynamicFilterDefinitionsPayload {
  category?: {
    slug: string
    name: string
    kind: "category" | "subcategory"
    parentSlug: string | null
  } | null
  definitions?: DynamicFilterDefinition[]
}

interface SearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const fallbackCategories: Category[] = [
  { id: "paintball", name: "Paintball", slug: "paintball", icon: "🎯" },
  { id: "gokarty", name: "Gokarty", slug: "go-karts", icon: "🏎️" },
  { id: "trampoliny", name: "Park trampolin", slug: "park-trampolin", icon: "🤸" },
  { id: "plac-zabaw", name: "Place zabaw", slug: "plac-zabaw", icon: "🛝" },
  { id: "park-linowy", name: "Park linowy", slug: "park-linowy", icon: "🧗" },
  { id: "escape-room", name: "Escape room", slug: "escape-room", icon: "🗝️" },
]

function normalizeSlug(value?: string | null) {
  return (value || "").trim().toLowerCase().replaceAll("_", "-")
}

function csvParam(value: string | null) {
  return (value || "").split(",").map(normalizeSlug).filter(Boolean)
}

function isDynamicCondition(value: unknown): value is DynamicFilterCondition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const condition = value as Record<string, unknown>
  return (
    typeof condition.eq === "string"
    || typeof condition.eq === "number"
    || typeof condition.eq === "boolean"
    || typeof condition.min === "number"
    || typeof condition.max === "number"
  )
}

function parseDynamicFilters(value: string | null, categorySlug: string | null) {
  if (!value || !categorySlug) return {} as Record<string, DynamicFilterCondition>

  try {
    const parsed = JSON.parse(value) as { category?: unknown; supply?: unknown; product?: unknown }
    if (normalizeSlug(typeof parsed.category === "string" ? parsed.category : null) !== categorySlug) return {}

    const flattened: Record<string, DynamicFilterCondition> = {}
    for (const scope of ["supply", "product"] as const) {
      const source = parsed[scope]
      if (!source || typeof source !== "object" || Array.isArray(source)) continue
      for (const [key, condition] of Object.entries(source)) {
        if (!/^[a-z0-9_]{2,80}$/.test(key) || !isDynamicCondition(condition)) continue
        flattened[`${scope}:${key}`] = condition
      }
    }
    return flattened
  } catch {
    return {}
  }
}

function serializeDynamicFilters(categorySlug: string | null, values: Record<string, DynamicFilterCondition>) {
  if (!categorySlug) return null

  const supply: Record<string, DynamicFilterCondition> = {}
  const product: Record<string, DynamicFilterCondition> = {}

  for (const [id, condition] of Object.entries(values)) {
    const separator = id.indexOf(":")
    if (separator <= 0) continue
    const scope = id.slice(0, separator)
    const key = id.slice(separator + 1)
    if (!/^[a-z0-9_]{2,80}$/.test(key)) continue
    if (scope === "supply") supply[key] = condition
    if (scope === "product") product[key] = condition
  }

  if (Object.keys(supply).length === 0 && Object.keys(product).length === 0) return null
  return JSON.stringify({ category: categorySlug, supply, product })
}

export function SearchDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: SearchDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>(fallbackCategories)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [guests, setGuests] = useState(1)
  const [ageMin, setAgeMin] = useState("")
  const [ageMax, setAgeMax] = useState("")
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500])
  const [dynamicDefinitions, setDynamicDefinitions] = useState<DynamicFilterDefinition[]>([])
  const [dynamicCategoryName, setDynamicCategoryName] = useState<string | null>(null)
  const [dynamicDefinitionsLoading, setDynamicDefinitionsLoading] = useState(false)
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, DynamicFilterCondition>>({})
  const urlState = useUrlState()

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setIsOpen = isControlled ? controlledOnOpenChange || (() => {}) : setInternalOpen

  const groupedCategories = useMemo<CategoryGroupView[]>(() => {
    const groups: CategoryGroupView[] = CATEGORY_GROUPS.map((group) => ({
      slug: group.slug,
      name: group.name,
      icon: group.icon,
      categories: categories.filter((category) => (group.activities as readonly string[]).includes(category.slug)),
    })).filter((group) => group.categories.length > 0)

    const known = new Set<string>(CATEGORY_GROUPS.flatMap((group) => [...group.activities]))
    const other = categories.filter((category) => !known.has(category.slug))
    if (other.length) groups.push({ slug: "inne", name: "Inne", icon: "✨", categories: other })

    return groups
  }, [categories])

  const selectedGroupData = groupedCategories.find((group) => group.slug === selectedGroup) ?? null
  const selectedActivitySlug = selectedCategories.length === 1 ? selectedCategories[0] : null

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
        // Preview environments can continue with local fallbacks.
      }
    }

    void loadCategories()
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const currentCategories = csvParam(urlState.get("categories"))
    setSelectedCategories(currentCategories)
    setLocation(urlState.get("q") || "")
    setDate(urlState.get("date") || "")
    setAgeMin(urlState.get("age_min") || "")
    setAgeMax(urlState.get("age_max") || "")

    const minPrice = Number.parseInt(urlState.get("min_price") || "0", 10)
    const maxPrice = Number.parseInt(urlState.get("max_price") || "500", 10)
    setPriceRange([
      Number.isFinite(minPrice) ? Math.max(0, Math.min(500, minPrice)) : 0,
      Number.isFinite(maxPrice) ? Math.max(0, Math.min(500, maxPrice)) : 500,
    ])

    const currentGuests = Number.parseInt(urlState.get("guests") || "1", 10)
    setGuests(Number.isFinite(currentGuests) && currentGuests > 0 ? currentGuests : 1)

    const matchingGroup = groupedCategories.find((group) => (
      currentCategories.length > 0
      && currentCategories.every((slug) => group.categories.some((category) => category.slug === slug))
    ))
    setSelectedGroup(matchingGroup?.slug ?? null)

    const currentActivity = currentCategories.length === 1 ? currentCategories[0] : null
    setDynamicFilters(parseDynamicFilters(urlState.get("attrs"), currentActivity))
  }, [isOpen, groupedCategories])

  useEffect(() => {
    if (!isOpen || !selectedActivitySlug) {
      setDynamicDefinitions([])
      setDynamicCategoryName(null)
      setDynamicDefinitionsLoading(false)
      return
    }

    const controller = new AbortController()
    setDynamicDefinitionsLoading(true)
    setDynamicDefinitions([])

    void fetch(`/api/search/filter-definitions?category=${encodeURIComponent(selectedActivitySlug)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Filter definitions failed: ${response.status}`)
        return response.json() as Promise<DynamicFilterDefinitionsPayload>
      })
      .then((payload) => {
        setDynamicCategoryName(payload.category?.name || selectedActivitySlug)
        setDynamicDefinitions(Array.isArray(payload.definitions) ? payload.definitions : [])
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("[search dialog] Failed to load dynamic filters", error)
        setDynamicCategoryName(selectedActivitySlug)
        setDynamicDefinitions([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setDynamicDefinitionsLoading(false)
      })

    return () => controller.abort()
  }, [isOpen, selectedActivitySlug])

  const selectGroup = (group: CategoryGroupView) => {
    setSelectedGroup(group.slug)
    setSelectedCategories(group.categories.map((category) => category.slug))
    setDynamicFilters({})
  }

  const selectActivity = (slug: string | null) => {
    if (!selectedGroupData) return
    setSelectedCategories(slug ? [slug] : selectedGroupData.categories.map((category) => category.slug))
    setDynamicFilters({})
  }

  const clearAll = () => {
    setSelectedGroup(null)
    setSelectedCategories([])
    setLocation("")
    setDate("")
    setGuests(1)
    setAgeMin("")
    setAgeMax("")
    setPriceRange([0, 500])
    setDynamicFilters({})
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
      categories: selectedCategories.length ? selectedCategories.join(",") : null,
      q: location.trim() || null,
      date: date || null,
      guests: guests > 1 ? String(guests) : null,
      age_min: normalizedMin || null,
      age_max: normalizedMax || null,
      min_price: priceRange[0] > 0 ? String(priceRange[0]) : null,
      max_price: priceRange[1] < 500 ? String(priceRange[1]) : null,
      attrs: serializeDynamicFilters(selectedActivitySlug, dynamicFilters),
    })
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none min-w-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-[28px]"
      >
        <DialogTitle className="sr-only">Filtry wyszukiwania atrakcji</DialogTitle>

        <header className="z-20 shrink-0 border-b border-[#0b1220]/[0.055] bg-white/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl md:px-6 md:py-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full border border-[#0b1220]/[0.07] bg-white text-foreground"
              aria-label="Wróć"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="md:hidden"><BrandLogo mobile href={undefined} /></div>
            <button onClick={clearAll} className="text-xs font-bold text-primary md:text-sm">Wyczyść</button>
          </div>

          <div className="mt-4 md:mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary md:text-xs">Filtry</p>
            <h2 className="mt-1 text-[1.65rem] font-extrabold leading-tight tracking-[-0.045em] text-foreground md:text-3xl">
              Dopasuj atrakcję
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground md:text-sm">
              Najpierw wybierz kategorię i aktywność. Potem pokażemy filtry właściwe właśnie dla niej.
            </p>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-7 px-4 py-5 pb-32 md:px-6 md:py-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
                <div>
                  <h3 className="text-sm font-extrabold tracking-[-0.02em]">Rodzaj atrakcji</h3>
                  <p className="text-[11px] text-muted-foreground">Kategoria główna → konkretna aktywność</p>
                </div>
              </div>

              <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup(null)
                    setSelectedCategories([])
                    setDynamicFilters({})
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-all",
                    !selectedGroup
                      ? "border-primary bg-primary text-white shadow-[inset_0_2px_5px_rgba(11,18,32,0.14)]"
                      : "border-[#0b1220]/10 bg-white text-muted-foreground",
                  )}
                >
                  Wszystkie
                </button>
                {groupedCategories.map((group) => (
                  <button
                    key={group.slug}
                    type="button"
                    onClick={() => selectGroup(group)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all",
                      selectedGroup === group.slug
                        ? "translate-y-px border-primary bg-primary text-white shadow-[inset_0_2px_6px_rgba(11,18,32,0.18)]"
                        : "border-[#0b1220]/10 bg-white text-muted-foreground",
                    )}
                  >
                    <span>{group.icon}</span>{group.name}
                  </button>
                ))}
              </div>

              {selectedGroupData && (
                <div className="rounded-[22px] border border-[#0b1220]/[0.06] bg-[#fffdfa] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Podkategoria</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Wybierz konkretną aktywność, aby dostać jej własne filtry.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 min-[390px]:grid-cols-3 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => selectActivity(null)}
                      className={cn(
                        "flex min-h-[88px] flex-col items-center justify-center rounded-[18px] border bg-white px-2 py-2.5 text-center transition-all",
                        !selectedActivitySlug
                          ? "border-primary bg-secondary shadow-[0_8px_22px_rgba(255,90,31,0.10)]"
                          : "border-[#0b1220]/[0.06]",
                      )}
                    >
                      <span className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Sparkles className="h-5 w-5" /></span>
                      <span className="text-[10.5px] font-bold">Wszystkie</span>
                    </button>

                    {selectedGroupData.categories.map((category) => {
                      const selected = selectedActivitySlug === category.slug
                      const localImage = getEnjoyHubCategoryIcon(category.slug)
                      const imageUrl = localImage || category.image_url
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => selectActivity(category.slug)}
                          className={cn(
                            "flex min-h-[88px] flex-col items-center justify-center rounded-[18px] border bg-white px-2 py-2.5 text-center transition-all",
                            selected
                              ? "border-primary bg-secondary shadow-[0_8px_22px_rgba(255,90,31,0.12)] ring-1 ring-primary/15"
                              : "border-[#0b1220]/[0.06]",
                          )}
                          aria-pressed={selected}
                        >
                          {imageUrl ? (
                            <span className="relative mb-2 h-10 w-10 overflow-hidden rounded-xl bg-secondary">
                              <Image src={imageUrl} alt="" fill className={localImage ? "object-contain p-0.5" : "object-cover"} sizes="40px" />
                            </span>
                          ) : (
                            <span className="mb-2 text-[25px] leading-none">{category.icon || "✨"}</span>
                          )}
                          <span className={cn("line-clamp-2 text-[10.5px] font-bold leading-tight", selected ? "text-primary" : "text-foreground")}>
                            {category.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold tracking-[-0.02em]">Filtry główne</h3>
                <p className="mt-1 text-xs text-muted-foreground">Działają dla każdej atrakcji, niezależnie od kategorii.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><MapPin className="h-3.5 w-3.5" /></span>
                  <h4 className="text-xs font-extrabold">Gdzie?</h4>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Miasto, okolica lub nazwa atrakcji"
                    className="h-14 min-w-0 rounded-[18px] border-[#0b1220]/[0.07] bg-white pl-11 text-sm shadow-sm focus-visible:ring-primary/25"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><CalendarDays className="h-3.5 w-3.5" /></span>
                    <h4 className="text-xs font-extrabold">Kiedy?</h4>
                  </div>
                  <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-14 rounded-[18px] border-[#0b1220]/[0.07] bg-white px-4 text-sm shadow-sm focus-visible:ring-primary/25" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><Users className="h-3.5 w-3.5" /></span>
                    <h4 className="text-xs font-extrabold">Ile osób?</h4>
                  </div>
                  <div className="flex h-14 items-center justify-between rounded-[18px] border border-[#0b1220]/[0.07] bg-white px-3 shadow-sm">
                    <button type="button" onClick={() => setGuests((value) => Math.max(1, value - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary" aria-label="Mniej osób"><Minus className="h-4 w-4" /></button>
                    <div className="text-center"><span className="block text-base font-extrabold">{guests}</span><span className="block text-[9px] font-semibold text-muted-foreground">{guests === 1 ? "osoba" : "osoby"}</span></div>
                    <button type="button" onClick={() => setGuests((value) => Math.min(30, value + 1))} className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary" aria-label="Więcej osób"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-xs font-extrabold">Wiek uczestników <span className="font-medium text-muted-foreground">(opcjonalnie)</span></h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" min="0" max="99" value={ageMin} onChange={(event) => setAgeMin(event.target.value)} placeholder="Od ilu lat" className="h-13 min-w-0 rounded-[16px] border-[#0b1220]/[0.07] bg-white shadow-sm" />
                  <Input type="number" min="0" max="99" value={ageMax} onChange={(event) => setAgeMax(event.target.value)} placeholder="Do ilu lat" className="h-13 min-w-0 rounded-[16px] border-[#0b1220]/[0.07] bg-white shadow-sm" />
                </div>
              </div>

              <div className="space-y-4 rounded-[18px] border border-[#0b1220]/[0.07] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><WalletCards className="h-3.5 w-3.5" /></span>
                    <h4 className="truncate text-xs font-extrabold">Budżet za osobę</h4>
                  </div>
                  <span className="text-xs font-bold">{priceRange[0]}–{priceRange[1] === 500 ? "500+" : priceRange[1]} zł</span>
                </div>
                <Slider value={priceRange} onValueChange={(value) => setPriceRange(value as [number, number])} min={0} max={500} step={10} />
              </div>
            </section>

            <DynamicFilterSection
              categoryName={dynamicCategoryName}
              definitions={dynamicDefinitions}
              loading={dynamicDefinitionsLoading}
              values={dynamicFilters}
              onValuesChange={setDynamicFilters}
            />
          </div>
        </ScrollArea>

        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[#0b1220]/[0.055] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:static md:px-6 md:pb-5">
          <Button onClick={handleSearch} className="h-13 w-full rounded-full text-sm font-extrabold orange-glow md:h-12">
            <Search className="mr-2 h-4 w-4" />
            Pokaż atrakcje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
