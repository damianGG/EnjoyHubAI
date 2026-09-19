export type LocationSearchMode = "city" | "address"

export interface LocationSuggestion {
  id: string
  label: string
  displayName: string
  addressLine: string
  city: string
  region: string
  country: string
  countryCode: string
  postcode: string
  latitude: number
  longitude: number
  type: string
}

export interface LocationSearchResponse {
  items: LocationSuggestion[]
  provider: "locationiq"
}

export interface LocationReverseResponse {
  item: LocationSuggestion
  provider: "locationiq"
}
