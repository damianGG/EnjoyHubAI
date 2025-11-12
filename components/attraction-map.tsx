"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Share2, Copy, Check } from "lucide-react"
import "leaflet/dist/leaflet.css"

interface AttractionMapProps {
  latitude?: number
  longitude?: number
  address: string
  city: string
  country: string
  title: string
}

export default function AttractionMap({
  latitude,
  longitude,
  address,
  city,
  country,
  title,
}: AttractionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!mapRef.current || !latitude || !longitude) return

    const initMap = async () => {
      const L = (await import("leaflet")).default

      // Fix default markers
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      })

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }

      const map = L.map(mapRef.current).setView([latitude, longitude], 14)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map)

      L.marker([latitude, longitude]).addTo(map).bindPopup(title)

      mapInstanceRef.current = map
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [latitude, longitude, title])

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          url: url,
        })
      } catch (err) {
        // User cancelled or error occurred
        console.log("Share cancelled or failed")
      }
    } else {
      // Fallback to copy to clipboard
      handleCopy()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Gdzie się znajduje</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map */}
        {latitude && longitude ? (
          <div ref={mapRef} className="w-full h-64 md:h-96 rounded-lg" />
        ) : (
          <div className="w-full h-64 md:h-96 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Map not available</span>
          </div>
        )}

        {/* Address */}
        <div>
          <p className="text-muted-foreground">
            {address}, {city}, {country}
          </p>
        </div>

        {/* Share Button */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            Udostępnij
          </Button>
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Skopiowano!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Kopiuj link
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
