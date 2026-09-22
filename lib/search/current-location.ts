"use client"

export const CURRENT_LOCATION_RADIUS_KM = 30

export type CurrentLocationResult = {
  latitude: number
  longitude: number
  accuracy: number | null
  bbox: string
  label: string | null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function bboxAroundCoordinates(
  latitude: number,
  longitude: number,
  radiusKm = CURRENT_LOCATION_RADIUS_KM,
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

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Dostęp do lokalizacji jest wyłączony. Zezwól EnjoyHub na lokalizację w ustawieniach przeglądarki."
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Nie udało się ustalić Twojej lokalizacji. Spróbuj ponownie za chwilę."
  }
  if (error.code === error.TIMEOUT) {
    return "Ustalanie lokalizacji trwało zbyt długo. Spróbuj ponownie."
  }
  return "Nie udało się pobrać lokalizacji."
}

function getBrowserCoordinates() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Ta przeglądarka nie obsługuje lokalizacji."))
      return
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(geolocationErrorMessage(error))),
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  })
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
  mapTilerKey: string,
): Promise<string | null> {
  if (!mapTilerKey) return null

  try {
    const endpoint = new URL(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(longitude)},${encodeURIComponent(latitude)}.json`,
    )
    endpoint.searchParams.set("key", mapTilerKey)
    endpoint.searchParams.set("language", "pl")
    endpoint.searchParams.set("limit", "1")

    const response = await fetch(endpoint.toString(), { cache: "no-store" })
    if (!response.ok) return null

    const payload = await response.json() as {
      features?: Array<{
        text?: string
        place_name?: string
      }>
    }

    const feature = payload.features?.[0]
    const label = feature?.text?.trim() || feature?.place_name?.split(",")[0]?.trim()
    return label || null
  } catch {
    return null
  }
}

export async function resolveCurrentLocation(mapTilerKey = ""): Promise<CurrentLocationResult> {
  const position = await getBrowserCoordinates()
  const latitude = position.coords.latitude
  const longitude = position.coords.longitude
  const label = await reverseGeocode(latitude, longitude, mapTilerKey)

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    bbox: bboxAroundCoordinates(latitude, longitude),
    label,
  }
}
