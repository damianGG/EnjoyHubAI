"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const DEFAULT_AMENITIES = [
  "WiFi",
  "Parking",
  "Klimatyzacja",
  "Ogrzewanie",
  "Toalety",
  "Szatnia",
  "Catering",
  "Nagłośnienie",
  "Oświetlenie",
  "Bezpieczeństwo",
  "Dostęp dla niepełnosprawnych",
  "Miejsce na imprezy",
  "Strefa relaksu",
  "Bar/Restauracja",
  "Miejsce na piknik",
  "Prysznice",
]

interface AmenitiesSelectorProps {
  selectedAmenities: string[]
  onAmenitiesChange: (amenities: string[]) => void
  amenitiesList?: string[]
}

export function AmenitiesSelector({ 
  selectedAmenities, 
  onAmenitiesChange,
  amenitiesList = DEFAULT_AMENITIES 
}: AmenitiesSelectorProps) {
  const handleAmenityChange = (amenity: string, checked: boolean) => {
    if (checked) {
      onAmenitiesChange([...selectedAmenities, amenity])
    } else {
      onAmenitiesChange(selectedAmenities.filter((a) => a !== amenity))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Udogodnienia</CardTitle>
        <CardDescription>
          Wybierz dostępne udogodnienia
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {amenitiesList.map((amenity) => (
            <div key={amenity} className="flex items-center space-x-2">
              <Checkbox
                id={`amenity-${amenity}`}
                checked={selectedAmenities.includes(amenity)}
                onCheckedChange={(checked) => handleAmenityChange(amenity, checked as boolean)}
              />
              <Label
                htmlFor={`amenity-${amenity}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {amenity}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
