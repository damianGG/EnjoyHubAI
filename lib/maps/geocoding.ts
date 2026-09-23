export const DEFAULT_LOCATION_RADIUS_KM = 30

export type GeocodedPlace = {
  id: string
  name: string
  label: string
  region: string | null
  country: string | null
  countryCode: string | null
  latitude: number
  longitude: number
  bbox: string
  providerBbox: [number, number, number, number] | null
}

type MapTilerContextItem = {
  id?: string
  text?: string
  short_code?: string
}

type MapTilerFeature = {
  id?: string
  text?: string
  place_name?: string
  place_type?: string[]
  center?: [number, number]
  bbox?: [number, number, number, number]
  context?: MapTilerContextItem[]
  properties?: {
    short_code?: string
  }
}

type MapTilerPayload = {
  features?: MapTilerFeature[]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function bboxAroundCoordinates(
  latitude: number,
  longitude: number,
  radiusKm = DEFAULT_LOCATION_RADIUS_KM,
) {
  const safeRadius = clamp(radiusKm, 1, 250)
  const latDelta = safeRadius / 111.32
  const longitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.15)
  const lngDelta = safeRadius / (111.32 * longitudeScale)

  const west = clamp(longitude - lngDelta, -180, 180)
  const south = clamp(latitude - latDelta, -90, 90)
  const east = clamp(longitude + lngDelta, -180, 180)
  const north = clamp(latitude + latDelta, -90, 90)

  return [west, south, east, north].map((value) => value.toFixed(6)).join(",")
}

function contextValue(feature: MapTilerFeature, prefix: string) {
  return feature.context?.find((item) => item.id?.startsWith(prefix)) ?? null
}

function normalizeCountryCode(value?: string | null) {
  if (!value) return null
  const normalized = value.split("-").at(-1)?.trim().toUpperCase()
  return normalized && normalized.length === 2 ? normalized : null
}

function featureToPlace(feature: MapTilerFeature, radiusKm = DEFAULT_LOCATION_RADIUS_KM): GeocodedPlace | null {
  const [longitude, latitude] = feature.center ?? []
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null

  const name = feature.text?.trim() || feature.place_name?.split(",")[0]?.trim()
  if (!name) return null

  const regionItem = contextValue(feature, "region.")
  const countryItem = contextValue(feature, "country.")
  const region = regionItem?.text?.trim() || null
  const country = countryItem?.text?.trim() || null
  const countryCode =
    normalizeCountryCode(countryItem?.short_code)
    || normalizeCountryCode(feature.properties?.short_code)

  const labelParts = [name]
  if (region && region.toLocaleLowerCase("pl") !== name.toLocaleLowerCase("pl")) labelParts.push(region)

  const providerBbox = feature.bbox?.length === 4 ? feature.bbox : null

  return {
    id: feature.id || `${latitude},${longitude}`,
    name,
    label: labelParts.join(", "),
    region,
    country,
    countryCode,
    latitude,
    longitude,
    bbox: bboxAroundCoordinates(latitude, longitude, radiusKm),
    providerBbox,
  }
}

export async function searchPlaces(
  query: string,
  apiKey: string,
  options: {
    countryCode?: string
    language?: string
    limit?: number
    radiusKm?: number
    signal?: AbortSignal
  } = {},
): Promise<GeocodedPlace[]> {
  const normalizedQuery = query.trim()
  if (!apiKey || normalizedQuery.length < 2) return []

  const endpoint = new URL(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(normalizedQuery)}.json`,
  )
  endpoint.searchParams.set("key", apiKey)
  endpoint.searchParams.set("language", options.language || "pl")
  endpoint.searchParams.set("limit", String(Math.max(1, Math.min(options.limit ?? 6, 10))))
  endpoint.searchParams.set("autocomplete", "true")
  endpoint.searchParams.set("fuzzyMatch", "true")
  endpoint.searchParams.set("types", "place,locality,municipality,municipal_district")
  if (options.countryCode) endpoint.searchParams.set("country", options.countryCode.toLowerCase())

  const response = await fetch(endpoint.toString(), {
    cache: "no-store",
    signal: options.signal,
  })
  if (!response.ok) throw new Error("Nie udało się pobrać podpowiedzi miejscowości.")

  const payload = await response.json() as MapTilerPayload
  const allowedTypes = new Set(["place", "locality", "municipality", "municipal_district"])

  return (payload.features ?? [])
    .filter((feature) => {
      const types = feature.place_type ?? []
      return types.length === 0 || types.some((type) => allowedTypes.has(type))
    })
    .map((feature) => featureToPlace(feature, options.radiusKm))
    .filter((place): place is GeocodedPlace => Boolean(place))
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  apiKey: string,
  options: {
    language?: string
    radiusKm?: number
    signal?: AbortSignal
  } = {},
): Promise<GeocodedPlace | null> {
  if (!apiKey) return null

  const endpoint = new URL(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(longitude)},${encodeURIComponent(latitude)}.json`,
  )
  endpoint.searchParams.set("key", apiKey)
  endpoint.searchParams.set("language", options.language || "pl")
  endpoint.searchParams.set("limit", "1")
  endpoint.searchParams.set("types", "place,locality,municipality,municipal_district")

  const response = await fetch(endpoint.toString(), {
    cache: "no-store",
    signal: options.signal,
  })
  if (!response.ok) return null

  const payload = await response.json() as MapTilerPayload
  const feature = payload.features?.[0]
  return feature ? featureToPlace(feature, options.radiusKm) : null
}

export async function geocodeAddress(
  query: string,
  apiKey: string,
  options: {
    countryCode?: string
    language?: string
    signal?: AbortSignal
  } = {},
) {
  const normalizedQuery = query.trim()
  if (!apiKey || normalizedQuery.length < 3) return null

  const endpoint = new URL(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(normalizedQuery)}.json`,
  )
  endpoint.searchParams.set("key", apiKey)
  endpoint.searchParams.set("language", options.language || "pl")
  endpoint.searchParams.set("limit", "1")
  endpoint.searchParams.set("fuzzyMatch", "true")
  if (options.countryCode) endpoint.searchParams.set("country", options.countryCode.toLowerCase())

  const response = await fetch(endpoint.toString(), {
    cache: "no-store",
    signal: options.signal,
  })
  if (!response.ok) return null

  const payload = await response.json() as MapTilerPayload
  const feature = payload.features?.[0]
  return feature ? featureToPlace(feature) : null
}
