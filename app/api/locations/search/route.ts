import { NextResponse } from "next/server"

import type { LocationSearchMode, LocationSuggestion } from "@/lib/locations/types"

export const dynamic = "force-dynamic"

interface LocationIqAddress {
  name?: string
  house_number?: string
  road?: string
  neighbourhood?: string
  suburb?: string
  city?: string
  city_district?: string
  locality?: string
  town?: string
  borough?: string
  municipality?: string
  village?: string
  hamlet?: string
  quarter?: string
  state?: string
  postcode?: string
  country?: string
  country_code?: string
}

interface LocationIqAutocompleteItem {
  place_id?: string | number
  osm_id?: string | number
  osm_type?: string
  lat?: string
  lon?: string
  display_name?: string
  display_place?: string
  display_address?: string
  type?: string
  address?: LocationIqAddress
}

function firstText(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? ""
}

function normalizeItem(
  item: LocationIqAutocompleteItem,
  mode: LocationSearchMode,
  fallbackCountryCode: string,
): LocationSuggestion | null {
  const latitude = Number(item.lat)
  const longitude = Number(item.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const address = item.address ?? {}
  const city = firstText(
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.hamlet,
    address.locality,
    address.borough,
    address.city_district,
    address.quarter,
  )
  const street = [address.road, address.house_number].filter(Boolean).join(" ").trim()
  const displayName = firstText(
    item.display_name,
    [item.display_place, item.display_address].filter(Boolean).join(", "),
    city,
  )
  const label = mode === "city"
    ? firstText(city, item.display_place, displayName)
    : firstText(item.display_place, address.name, street, displayName)
  const addressLine = firstText(street, address.name, item.display_place, displayName)
  const providerId = firstText(
    item.place_id !== undefined ? String(item.place_id) : undefined,
    item.osm_id !== undefined ? `${item.osm_type ?? "osm"}:${item.osm_id}` : undefined,
    `${latitude}:${longitude}`,
  )

  return {
    id: `locationiq:${providerId}`,
    label,
    displayName,
    addressLine,
    city: firstText(city, mode === "city" ? item.display_place : undefined),
    region: firstText(address.state),
    country: firstText(address.country, "Polska"),
    countryCode: firstText(address.country_code?.toUpperCase(), fallbackCountryCode.toUpperCase()),
    postcode: firstText(address.postcode),
    latitude,
    longitude,
    type: firstText(item.type, mode),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim().slice(0, 200) ?? ""
  const requestedMode = searchParams.get("mode")
  const mode: LocationSearchMode = requestedMode === "address" ? "address" : "city"
  const minimumLength = mode === "address" ? 3 : 2

  if (q.length < minimumLength) {
    return NextResponse.json({ items: [], provider: "locationiq" })
  }

  const apiKey = process.env.LOCATIONIQ_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: "LOCATION_PROVIDER_NOT_CONFIGURED", items: [], provider: "locationiq" },
      { status: 503 },
    )
  }

  const configuredCountries = process.env.LOCATIONIQ_COUNTRY_CODES?.trim().toLowerCase() || "pl"
  const fallbackCountryCode = configuredCountries.split(",")[0]?.trim() || "pl"
  const params = new URLSearchParams({
    key: apiKey,
    q,
    countrycodes: configuredCountries,
    limit: mode === "city" ? "8" : "10",
    "accept-language": "pl",
    normalizecity: "1",
    dedupe: "1",
  })

  if (mode === "city") {
    params.set("tag", "place:city,place:town,place:village,place:hamlet")
  }

  try {
    const providerResponse = await fetch(`https://api.locationiq.com/v1/autocomplete?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (!providerResponse.ok) {
      const body = await providerResponse.text().catch(() => "")
      console.error("LocationIQ autocomplete failed", {
        status: providerResponse.status,
        body: body.slice(0, 300),
      })
      return NextResponse.json(
        { error: "LOCATION_PROVIDER_ERROR", items: [], provider: "locationiq" },
        { status: providerResponse.status === 429 ? 429 : 502 },
      )
    }

    const payload = await providerResponse.json() as LocationIqAutocompleteItem[]
    const items = Array.isArray(payload)
      ? payload
          .map((item) => normalizeItem(item, mode, fallbackCountryCode))
          .filter((item): item is LocationSuggestion => Boolean(item?.label))
      : []

    const response = NextResponse.json({ items, provider: "locationiq" })
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900")
    return response
  } catch (error) {
    console.error("Location autocomplete endpoint failed", error)
    return NextResponse.json(
      { error: "LOCATION_PROVIDER_ERROR", items: [], provider: "locationiq" },
      { status: 502 },
    )
  }
}
