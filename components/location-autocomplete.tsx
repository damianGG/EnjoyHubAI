"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin } from "lucide-react"

import { Input } from "@/components/ui/input"
import { getMapTilerKey } from "@/lib/maps/maplibre"
import { searchPlaces, type GeocodedPlace } from "@/lib/maps/geocoding"
import { cn } from "@/lib/utils"

type LocationAutocompleteProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelect: (place: GeocodedPlace) => void
  onEnter?: () => void
  placeholder?: string
  countryCode?: string
  language?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
}

export function LocationAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder = "Wpisz miejscowość",
  countryCode = "PL",
  language = "pl",
  className,
  inputClassName,
  disabled = false,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedLabelRef = useRef<string | null>(null)

  useEffect(() => {
    const query = value.trim()
    if (!focused || query.length < 2 || selectedLabelRef.current === query) {
      setSuggestions([])
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      void searchPlaces(query, getMapTilerKey(), {
        countryCode,
        language,
        limit: 6,
        signal: controller.signal,
      })
        .then((places) => setSuggestions(places))
        .catch((reason) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return
          setSuggestions([])
          setError(reason instanceof Error ? reason.message : "Nie udało się pobrać podpowiedzi.")
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [countryCode, focused, language, value])

  const handleChange = (nextValue: string) => {
    if (selectedLabelRef.current !== nextValue) selectedLabelRef.current = null
    onChange(nextValue)
  }

  const choose = (place: GeocodedPlace) => {
    selectedLabelRef.current = place.label
    setSuggestions([])
    setError(null)
    onChange(place.label)
    onSelect(place)
  }

  const dropdownVisible = focused && (loading || error || suggestions.length > 0)

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) {
            event.preventDefault()
            onEnter()
          }
        }}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={dropdownVisible}
        className={inputClassName}
      />

      {dropdownVisible && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[1200] overflow-hidden rounded-2xl border border-[#0b1220]/[0.08] bg-white shadow-[0_18px_50px_rgba(11,18,32,0.16)]">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Szukam miejscowości…
            </div>
          )}

          {!loading && error && (
            <p className="px-4 py-3 text-xs font-medium text-destructive">{error}</p>
          )}

          {!loading && !error && suggestions.map((place) => (
            <button
              key={place.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
              className="flex w-full items-start gap-3 border-b border-[#0b1220]/[0.05] px-4 py-3 text-left transition last:border-b-0 hover:bg-secondary/60"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground">{place.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {[place.region, place.country].filter(Boolean).join(" · ") || "Miejscowość"}
                </span>
              </span>
            </button>
          ))}

          {!loading && !error && value.trim().length >= 2 && suggestions.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">Brak pasujących miejscowości.</p>
          )}
        </div>
      )}
    </div>
  )
}
