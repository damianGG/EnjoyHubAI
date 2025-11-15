"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Star } from "lucide-react"
import { NearbyAttraction } from "@/types/attraction"
import Link from "next/link"

interface NearbyAttractionsProps {
  attractions: NearbyAttraction[]
}

export default function NearbyAttractions({ attractions }: NearbyAttractionsProps) {
  if (!attractions || attractions.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Section: Nearby attractions header */}
      <h2 className="text-2xl font-bold">More Attractions Nearby</h2>

      {/* Section: Attractions carousel/grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {attractions.map((attraction) => (
          <Link key={attraction.id} href={`/attractions/${attraction.id}`}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
              <div className="aspect-video overflow-hidden">
                <img
                  src={attraction.image}
                  alt={attraction.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold line-clamp-1">{attraction.name}</h3>
                  {attraction.rating && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{attraction.rating}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {attraction.category}
                  </Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 mr-1" />
                    {attraction.distance}
                  </div>
                </div>
                {attraction.priceFrom && (
                  <p className="text-sm font-semibold">
                    From {attraction.priceFrom} zł
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
