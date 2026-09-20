"use client"

import { useState } from "react"
import LocationPicker from "@/components/location-picker"
import { Input } from "@/components/ui/input"

export function SupplyLocationPicker({ latitude, longitude }: {
  latitude?: number | null
  longitude?: number | null
}) {
  const [lat, setLat] = useState(latitude == null ? "" : String(latitude))
  const [lng, setLng] = useState(longitude == null ? "" : String(longitude))
  const [revision, setRevision] = useState(0)
  const valid = lat.trim() !== "" && lng.trim() !== "" &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180

  return (
    <div className="space-y-4">
      <LocationPicker
        key={revision}
        draggable
        selectedLat={valid ? Number(lat) : null}
        selectedLng={valid ? Number(lng) : null}
        onLocationSelect={(nextLat, nextLng) => {
          setLat(nextLat.toFixed(6))
          setLng(nextLng.toFixed(6))
        }}
      />
      <p className="text-sm text-muted-foreground">Kliknij mapę lub przeciągnij pinezkę. Możesz też wpisać współrzędne. Następnie kliknij „Zapisz zmiany”.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span>Szerokość geograficzna</span>
          <Input name="latitude" type="number" step="any" min={-90} max={90} value={lat}
            required={lng !== ""} onChange={(event) => setLat(event.target.value)} onBlur={() => setRevision((value) => value + 1)} />
        </label>
        <label className="space-y-2 text-sm">
          <span>Długość geograficzna</span>
          <Input name="longitude" type="number" step="any" min={-180} max={180} value={lng}
            required={lat !== ""} onChange={(event) => setLng(event.target.value)} onBlur={() => setRevision((value) => value + 1)} />
        </label>
      </div>
    </div>
  )
}
