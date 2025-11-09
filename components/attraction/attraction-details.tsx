import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  MapPin,
  DollarSign,
  Users,
  Calendar,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface AttractionDetailsProps {
  category: string
  description: string
  openingHours: string
  address: string
  mapLink?: string
  priceFrom?: number
  priceTo?: number
  priceUnit?: string
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
  priceUnit = "zł / person",
  duration,
  ageLimit,
  amenities,
  tips,
}: AttractionDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Section: Main information card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>About This Attraction</CardTitle>
            <Badge variant="default" className="text-sm">
              {category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">{description}</p>

          {/* Section: Key details grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Opening hours */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Opening Hours</div>
                <div className="text-sm text-muted-foreground">{openingHours}</div>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Address</div>
                <div className="text-sm text-muted-foreground">{address}</div>
                {mapLink && (
                  <Button variant="link" className="h-auto p-0 text-sm" asChild>
                    <a href={mapLink} target="_blank" rel="noopener noreferrer">
                      View on map <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Price */}
            {(priceFrom || priceTo) && (
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Price</div>
                  <div className="text-sm text-muted-foreground">
                    {priceFrom && priceTo ? (
                      <>
                        {priceFrom} - {priceTo} {priceUnit}
                      </>
                    ) : priceFrom ? (
                      <>From {priceFrom} {priceUnit}</>
                    ) : (
                      <>Up to {priceTo} {priceUnit}</>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Duration */}
            {duration && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Duration</div>
                  <div className="text-sm text-muted-foreground">{duration}</div>
                </div>
              </div>
            )}

            {/* Age limit */}
            {ageLimit && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Age Requirements</div>
                  <div className="text-sm text-muted-foreground">{ageLimit}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section: Amenities */}
      {amenities && amenities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Amenities & Facilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((amenity, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm">{amenity}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section: Tips and recommendations */}
      {tips && tips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Tips & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
