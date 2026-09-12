"use client"

import { LocationAutocomplete } from "@/components/location-autocomplete"
import type { LocationSuggestion } from "@/lib/locations/types"

export type CitySuggestion = LocationSuggestion

interface CityAutocompleteProps {
  value: string
  onValueChange: (value: string) => void
  onSelect?: (suggestion: CitySuggestion) => void
  name?: string
  id?: string
  required?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
}

export function CityAutocomplete(props: CityAutocompleteProps) {
  return <LocationAutocomplete mode="city" {...props} />
}
