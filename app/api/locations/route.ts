import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export const revalidate = 300

interface RawLocation {
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

interface GroupedLocation {
  city: string
  country: string
  count: number
  latitudeSum: number
  longitudeSum: number
  coordinatesCount: number
}

function normalizeLocation(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("q")?.trim() ?? ""
    const query = normalizeLocation(rawQuery)

    const supabase = createClient()
    const { data, error } = await supabase
      .from("properties")
      .select("city,country,latitude,longitude")
      .eq("is_active", true)
      .not("city", "is", null)
      .order("city", { ascending: true })
      .limit(2000)

    if (error) {
      console.error("Locations query failed", { code: error.code, message: error.message })
      return NextResponse.json({ error: "Nie udało się pobrać miejscowości." }, { status: 500 })
    }

    const grouped = new Map<string, GroupedLocation>()

    for (const row of (data ?? []) as RawLocation[]) {
      const city = row.city?.trim()
      if (!city) continue

      const country = row.country?.trim() || "Polska"
      const key = `${normalizeLocation(city)}|${normalizeLocation(country)}`
      const current = grouped.get(key) ?? {
        city,
        country,
        count: 0,
        latitudeSum: 0,
        longitudeSum: 0,
        coordinatesCount: 0,
      }

      current.count += 1
      if (Number.isFinite(row.latitude) && Number.isFinite(row.longitude)) {
        current.latitudeSum += Number(row.latitude)
        current.longitudeSum += Number(row.longitude)
        current.coordinatesCount += 1
      }
      grouped.set(key, current)
    }

    const items = [...grouped.values()]
      .filter((item) => !query || normalizeLocation(item.city).includes(query))
      .sort((left, right) => {
        if (query) {
          const leftStarts = normalizeLocation(left.city).startsWith(query)
          const rightStarts = normalizeLocation(right.city).startsWith(query)
          if (leftStarts !== rightStarts) return leftStarts ? -1 : 1
        }
        if (left.count !== right.count) return right.count - left.count
        return left.city.localeCompare(right.city, "pl")
      })
      .slice(0, 20)
      .map((item) => ({
        city: item.city,
        country: item.country,
        attractionCount: item.count,
        latitude: item.coordinatesCount > 0 ? item.latitudeSum / item.coordinatesCount : null,
        longitude: item.coordinatesCount > 0 ? item.longitudeSum / item.coordinatesCount : null,
      }))

    const response = NextResponse.json({ items })
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
    return response
  } catch (error) {
    console.error("Locations endpoint failed", error)
    return NextResponse.json({ error: "Nie udało się pobrać miejscowości." }, { status: 500 })
  }
}
