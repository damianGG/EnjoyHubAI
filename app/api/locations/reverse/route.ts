import { NextResponse } from "next/server"

import type { LocationSuggestion } from "@/lib/locations/types"

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

interface LocationIqReverseItem {
  place_id?: string | number
  osm_id?: string | number
  osm_type?: string
  lat?: string
  lon?: string
  display_name?: string
  type?: string
  address?: LocationIqAddress
}

function firstText(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? ""
}

function normalizeItem(item: LocationIqReverseItem): LocationSuggestion | null {
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
  const addressLine = firstText(street, address.name, item.display_name)
  const providerId = firstText(
    item.place_id !== undefined ? String(item.place_id) : undefined,
    item.osm_id !== undefined ? `${item.osm_type ?? "osm"}:${item.osm_id}` : undefined,
    `${latitude}:${longitude}`,
  )

  return {
    id: `locationiq:${providerId}`,
    label: firstText(address.name, street, city, item.display_name),
    displayName: firstText(item.display_name, addressLine, city),
    addressLine,
    city,
    region: firstText(address.state),
    country: firstText(address.country, "Polska"),
    countryCode: firstText(address.country_code?.toUpperCase(), "PL"),
    postcode: firstText(address.postcode),
    latitude,
    longitude,
    type: firstText(item.type, "address"),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const latitude = Number(searchParams.get("lat"))
  const longitude = Number(searchParams.get("lng"))

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "INVALID_COORDINATES" }, { status: 400 })
  }

  const apiKey = process.env.LOCATIONIQ_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "LOCATION_PROVIDER_NOT_CONFIGURED" }, { status: 503 })
  }

  const params = new URLSearchParams({
    key: apiKey,
    lat: String(latitude),
    lon: String(longitude),
    format: "json",
    addressdetails: "1",
    normalizeaddress: "1",
    normalizecity: "1",
    "accept-language": "pl",
  })

  try {
    const providerResponse = await fetch(`https://eu1.locationiq.com/v1/reverse?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (!providerResponse.ok) {
      const body = await providerResponse.text().catch(() => "")
      console.error("LocationIQ reverse failed", {
        status: providerResponse.status,
        body: body.slice(0, 300),
      })
      return NextResponse.json(
        { error: "LOCATION_PROVIDER_ERROR" },
        { status: providerResponse.status === 429 ? 429 : 502 },
      )
    }

    const payload = await providerResponse.json() as LocationIqReverseItem
    const item = normalizeItem(payload)
    if (!item) return NextResponse.json({ error: "LOCATION_NOT_FOUND" }, { status: 404 })

    const response = NextResponse.json({ item, provider: "locationiq" })
    response.headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800")
    return response
  } catch (error) {
    console.error("Location reverse endpoint failed", error)
    return NextResponse.json({ error: "LOCATION_PROVIDER_ERROR" }, { status: 502 })
  }
}
