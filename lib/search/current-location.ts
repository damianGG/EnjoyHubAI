"use client"

import {
  DEFAULT_LOCATION_RADIUS_KM,
  bboxAroundCoordinates,
  reverseGeocode,
} from "@/lib/maps/geocoding"

export const CURRENT_LOCATION_RADIUS_KM = DEFAULT_LOCATION_RADIUS_KM

export type CurrentLocationResult = {
  latitude: number
  longitude: number
  accuracy: number | null
  bbox: string
  label: string | null
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

export async function resolveCurrentLocation(mapTilerKey = ""): Promise<CurrentLocationResult> {
  const position = await getBrowserCoordinates()
  const latitude = position.coords.latitude
  const longitude = position.coords.longitude

  let label: string | null = null
  try {
    const place = await reverseGeocode(latitude, longitude, mapTilerKey, {
      language: "pl",
      radiusKm: CURRENT_LOCATION_RADIUS_KM,
    })
    label = place?.name ?? null
  } catch {
    label = null
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    bbox: bboxAroundCoordinates(latitude, longitude, CURRENT_LOCATION_RADIUS_KM),
    label,
  }
}
