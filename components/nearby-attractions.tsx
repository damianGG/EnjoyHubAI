"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Star, MapPin } from "lucide-react"
import Link from "next/link"

interface NearbyAttraction {
  id: string
  title: string
  images?: string[]
  city: string
  price_per_night: number
  avgRating?: number
  reviewCount?: number
}

interface NearbyAttractionsProps {
  attractions: NearbyAttraction[]
  city: string
}

export default function NearbyAttractions({ attractions, city }: NearbyAttractionsProps) {
  if (!attractions || attractions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">
          Więcej atrakcji w pobliżu – {city}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {attractions.map((attraction) => (
              <CarouselItem key={attraction.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                <Link href={`/properties/${attraction.id}`} className="block">
                  <div className="group cursor-pointer">
                    {/* Image */}
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-3">
                      {attraction.images && attraction.images.length > 0 ? (
                        <img
                          src={attraction.images[0] || "/placeholder.svg?height=200&width=300"}
                          alt={attraction.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold line-clamp-1 flex-1">{attraction.title}</h4>
                        {attraction.avgRating && attraction.avgRating > 0 && (
                          <div className="flex items-center gap-1 text-sm ml-2">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{attraction.avgRating}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {attraction.city}
                        {attraction.reviewCount !== undefined && attraction.reviewCount > 0 && (
                          <span> · {attraction.reviewCount} opinii</span>
                        )}
                      </p>
                      <p className="text-sm font-medium">
                        {attraction.price_per_night} zł{" "}
                        <span className="text-muted-foreground font-normal">/ noc</span>
                      </p>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-12" />
          <CarouselNext className="-right-12" />
        </Carousel>
      </CardContent>
    </Card>
  )
}
