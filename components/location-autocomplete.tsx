"use client"

import { useEffect, useState } from "react"
import { Loader2, MapPin } from "lucide-react"

import { Input } from "@/components/ui/input"
import type { LocationSearchMode, LocationSearchResponse, LocationSuggestion } from "@/lib/locations/types"
import { cn } from "@/lib/utils"

interface LocationAutocompleteProps {
  mode: LocationSearchMode
  value: string
  onValueChange: (value: string) => void
  onSelect?: (suggestion: LocationSuggestion) => void
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
  const minimumLength = mode === "city" ? 2 : 3

  useEffect(() => {
    if (!open || value.trim().length < minimumLength) {
      setItems([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setProviderUnavailable(false)
      try {
        const params = new URLSearchParams({ q: value.trim(), mode })
        const response = await fetch(`/api/locations/search?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          if (response.status === 503 || response.status === 429) setProviderUnavailable(true)
          throw new Error("Location lookup failed")
        }
        const payload = await response.json() as LocationSearchResponse
        setItems(Array.isArray(payload.items) ? payload.items : [])
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
  }, [minimumLength, mode, open, value])

  function selectSuggestion(item: LocationSuggestion) {
    const nextValue = mode === "city" ? (item.city || item.label) : (item.addressLine || item.label)
    onValueChange(nextValue)
    onSelect?.(item)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value.trim()} /> : null}
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
        <Input
          id={id}
          value={value}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onValueChange(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false)
            if (event.key === "Enter" && open && items[0]) {
              event.preventDefault()
              selectSuggestion(items[0])
            }
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          placeholder={placeholder}
          className={cn("pl-10", inputClassName)}
        />
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Lokalizacje: <a href="https://locationiq.com" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">Search by LocationIQ.com</a>
      </p>

      {open && value.trim().length >= minimumLength ? (
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
