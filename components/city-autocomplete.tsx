"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, MapPin, Plus } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface CitySuggestion {
  city: string
  country: string
  attractionCount: number
  latitude: number | null
  longitude: number | null
}

interface CityAutocompleteProps {
  value: string
  onValueChange: (value: string) => void
  onSelect?: (suggestion: CitySuggestion) => void
  allowCustom?: boolean
  name?: string
  id?: string
  required?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .trim()
}

export function CityAutocomplete({
  value,
  onValueChange,
  onSelect,
  allowCustom = false,
  name,
  id,
  required,
  placeholder = "Wpisz miejscowość",
  className,
  inputClassName,
}: CityAutocompleteProps) {
  const [items, setItems] = useState<CitySuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/locations?q=${encodeURIComponent(value.trim())}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Locations request failed")
        const payload = await response.json() as { items?: CitySuggestion[] }
        setItems(Array.isArray(payload.items) ? payload.items : [])
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setItems([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 160)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, value])

  const exactMatch = useMemo(
    () => items.some((item) => normalize(item.city) === normalize(value)),
    [items, value],
  )
  const customValue = value.trim()
  const showCustom = allowCustom && customValue.length >= 2 && !exactMatch

  function selectSuggestion(item: CitySuggestion) {
    onValueChange(item.city)
    onSelect?.(item)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value.trim()} /> : null}
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
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className={cn("pl-10", inputClassName)}
      />

      {open ? (
        <div
          role="listbox"
          className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pobieram miejscowości…
            </div>
          ) : null}

          {!loading && items.map((item) => (
            <button
              key={`${item.city}-${item.country}`}
              type="button"
              role="option"
              aria-selected={normalize(value) === normalize(item.city)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(item)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.city}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.country}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.attractionCount} {item.attractionCount === 1 ? "atrakcja" : "atrakcji"}
              </span>
            </button>
          ))}

          {!loading && showCustom ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"
            >
              <Plus className="h-4 w-4 text-primary" />
              <span>Użyj „<strong>{customValue}</strong>” jako nowej miejscowości</span>
            </button>
          ) : null}

          {!loading && items.length === 0 && !showCustom ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Brak pasujących miejscowości.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
