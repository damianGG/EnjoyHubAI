"use client"

import { useEffect, useState } from "react"
import { Loader2, MapPin, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LocationSearchMode, LocationSearchResponse, LocationSuggestion } from "@/lib/locations/types"
import { cn } from "@/lib/utils"

type LocationLookupBehavior = "manual" | "autocomplete"

interface LocationAutocompleteProps {
  mode: LocationSearchMode
  value: string
  onValueChange: (value: string) => void
  onSelect?: (suggestion: LocationSuggestion) => void
  behavior?: LocationLookupBehavior
  name?: string
  id?: string
  required?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
}

export function LocationAutocomplete({
  mode,
  value,
  onValueChange,
  onSelect,
  behavior = "manual",
  name,
  id,
  required,
  placeholder = mode === "city" ? "Wpisz miasto lub miejscowość" : "Wpisz adres lub nazwę obiektu",
  className,
  inputClassName,
}: LocationAutocompleteProps) {
  const [items, setItems] = useState<LocationSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [providerUnavailable, setProviderUnavailable] = useState(false)
  const [manualMessage, setManualMessage] = useState<string | null>(null)
  const minimumLength = mode === "city" ? 2 : 3

  async function requestSuggestions(signal?: AbortSignal) {
    const params = new URLSearchParams({ q: value.trim(), mode })
    const response = await fetch(`/api/locations/search?${params.toString()}`, { signal })

    if (!response.ok) {
      if (response.status === 503 || response.status === 429) setProviderUnavailable(true)
      throw new Error("Location lookup failed")
    }

    const payload = await response.json() as LocationSearchResponse
    return Array.isArray(payload.items) ? payload.items : []
  }

  useEffect(() => {
    if (behavior !== "autocomplete" || !open || value.trim().length < minimumLength) {
      setItems([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setProviderUnavailable(false)
      try {
        setItems(await requestSuggestions(controller.signal))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setItems([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [behavior, minimumLength, mode, open, value])

  function selectSuggestion(item: LocationSuggestion) {
    const nextValue = mode === "city" ? (item.city || item.label) : (item.addressLine || item.label)
    onValueChange(nextValue)
    onSelect?.(item)
    setOpen(false)
    setManualMessage(null)
  }

  async function findOnMap() {
    if (value.trim().length < minimumLength || loading) return

    setLoading(true)
    setProviderUnavailable(false)
    setManualMessage(null)
    try {
      const found = await requestSuggestions()
      const first = found[0]
      if (!first) {
        setManualMessage("Nie znaleziono tego miejsca. Możesz ustawić pinezkę ręcznie na mapie.")
        return
      }

      selectSuggestion(first)
    } catch {
      setManualMessage("Nie udało się wyszukać miejsca. Możesz ustawić pinezkę ręcznie na mapie.")
    } finally {
      setLoading(false)
    }
  }

  const input = (
    <Input
      id={id}
      value={value}
      required={required}
      autoComplete="off"
      role={behavior === "autocomplete" ? "combobox" : undefined}
      aria-autocomplete={behavior === "autocomplete" ? "list" : undefined}
      aria-expanded={behavior === "autocomplete" ? open : undefined}
      onFocus={() => {
        if (behavior === "autocomplete") setOpen(true)
      }}
      onChange={(event) => {
        onValueChange(event.target.value)
        setManualMessage(null)
        if (behavior === "autocomplete") setOpen(true)
      }}
      onKeyDown={(event) => {
        if (behavior === "autocomplete") {
          if (event.key === "Escape") setOpen(false)
          if (event.key === "Enter" && open && items[0]) {
            event.preventDefault()
            selectSuggestion(items[0])
          }
          return
        }

        if (event.key === "Enter") {
          event.preventDefault()
          void findOnMap()
        }
      }}
      onBlur={() => {
        if (behavior === "autocomplete") window.setTimeout(() => setOpen(false), 140)
      }}
      placeholder={placeholder}
      className={cn("pl-10", inputClassName)}
    />
  )

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value.trim()} /> : null}

      {behavior === "manual" ? (
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
            {input}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void findOnMap()}
            disabled={loading || value.trim().length < minimumLength}
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="hidden sm:inline">Znajdź na mapie</span>
            <span className="sm:hidden">Znajdź</span>
          </Button>
        </div>
      ) : (
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
          {input}
        </div>
      )}

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Lokalizacje: <a href="https://locationiq.com" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">Search by LocationIQ.com</a>
      </p>

      {behavior === "manual" && manualMessage ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{manualMessage}</p>
      ) : null}

      {behavior === "autocomplete" && open && value.trim().length >= minimumLength ? (
        <div role="listbox" className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Szukam lokalizacji…
            </div>
          ) : null}

          {!loading && items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(item)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{mode === "city" ? (item.city || item.label) : item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {mode === "city"
                    ? [item.region, item.country].filter(Boolean).join(", ")
                    : item.displayName}
                </span>
              </span>
            </button>
          ))}

          {!loading && providerUnavailable ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Podpowiedzi są chwilowo niedostępne. Możesz wpisać lokalizację ręcznie.</div>
          ) : null}

          {!loading && !providerUnavailable && items.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Brak pasujących lokalizacji. Możesz wpisać dane ręcznie.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
