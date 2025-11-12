"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { MapPin } from "lucide-react"
import Link from "next/link"

interface Attraction {
  id: string
  title: string
  images?: string[]
  city: string
  price_per_night: number
  latitude?: number
  longitude?: number
}

interface HostAttractionsProps {
  attractions: Attraction[]
  hostName: string
}

export default function HostAttractions({ attractions, hostName }: HostAttractionsProps) {
  if (!attractions || attractions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">
          Inne atrakcje od {hostName}
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
              <CarouselItem key={attraction.id} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
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
                      <h4 className="font-semibold line-clamp-1 mb-1">{attraction.title}</h4>
                      <p className="text-sm text-muted-foreground mb-1">{attraction.city}</p>
                      <p className="text-sm font-medium">
                        {attraction.price_per_night} zł <span className="text-muted-foreground">/ noc</span>
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
