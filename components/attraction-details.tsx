"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Clock,
  DollarSign,
  Users,
  Info,
  Lightbulb,
  ExternalLink,
} from "lucide-react"

interface AttractionDetailsProps {
  category: string
  description: string
  openingHours: string
  address: string
  mapLink?: string
  priceFrom: number
  priceTo: number
  priceUnit: string
  duration?: string
  ageLimit?: string
  amenities: string[]
  tips?: string[]
}

export default function AttractionDetails({
  category,
  description,
  openingHours,
  address,
  mapLink,
  priceFrom,
  priceTo,
  priceUnit,
  duration,
  ageLimit,
  amenities,
  tips,
}: AttractionDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Main Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Szczegóły</CardTitle>
            <Badge variant="secondary" className="text-sm">
              {category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <p className="text-muted-foreground leading-relaxed">{description}</p>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opening Hours */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Godziny otwarcia</p>
                <p className="text-sm text-muted-foreground">{openingHours}</p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Adres</p>
                <p className="text-sm text-muted-foreground">{address}</p>
                {mapLink && (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    Pokaż na mapie <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Cena</p>
                <p className="text-sm text-muted-foreground">
                  {priceFrom} - {priceTo} {priceUnit}
                </p>
              </div>
            </div>

            {/* Duration */}
            {duration && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Czas trwania</p>
                  <p className="text-sm text-muted-foreground">{duration}</p>
                </div>
              </div>
            )}

            {/* Age Limit */}
            {ageLimit && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Wymagania wiekowe</p>
                  <p className="text-sm text-muted-foreground">{ageLimit}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Amenities Card */}
      {amenities && amenities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Udogodnienia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {amenities.map((amenity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips Card */}
      {tips && tips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Wskazówki i zalecenia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
