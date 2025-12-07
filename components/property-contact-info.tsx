"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Phone, Mail, MapPin, Clock } from "lucide-react"

interface PropertyContactInfoProps {
  phone?: string
  email?: string
  address?: string
  city?: string
  country?: string
  openingHours?: string
}

export default function PropertyContactInfo({
  phone,
  email,
  address,
  city,
  country,
  openingHours,
}: PropertyContactInfoProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Informacje kontaktowe</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Address */}
        {(address || city) && (
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-muted-foreground mb-1">Adres</p>
              <p className="text-sm">
                {address && <span>{address}</span>}
                {address && (city || country) && <br />}
                {city && <span>{city}</span>}
                {city && country && <span>, </span>}
                {country && <span>{country}</span>}
              </p>
            </div>
          </div>
        )}

        {/* Phone */}
        {phone && (
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-muted-foreground mb-1">Telefon</p>
              <a 
                href={`tel:${phone}`} 
                className="text-sm hover:underline text-primary"
              >
                {phone}
              </a>
            </div>
          </div>
        )}

        {/* Email */}
        {email && (
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-muted-foreground mb-1">Email</p>
              <a 
                href={`mailto:${email}`} 
                className="text-sm hover:underline text-primary break-all"
              >
                {email}
              </a>
            </div>
          </div>
        )}

        {/* Opening Hours */}
        {openingHours && (
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-muted-foreground mb-1">Godziny otwarcia</p>
              <p className="text-sm whitespace-pre-line">{openingHours}</p>
            </div>
          </div>
        )}

        {/* No contact info message */}
        {!phone && !email && !address && !city && !country && !openingHours && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Brak dostępnych informacji kontaktowych
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
