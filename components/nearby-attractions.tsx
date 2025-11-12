"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AttractionCard } from "./attraction-card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

interface Attraction {
  id: string
  title: string
  city: string
  country: string
  images: string[]
  rating?: number
  reviewsCount?: number
  maxGuests?: number
  pricePerNight?: number
  categoryName?: string
  slug?: string
  activitySlug?: string
}

interface NearbyAttractionsProps {
  attractions: Attraction[]
  currentCity: string
}

export function NearbyAttractions({ attractions, currentCity }: NearbyAttractionsProps) {
  if (!attractions || attractions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Więcej atrakcji w pobliżu</CardTitle>
        <p className="text-sm text-muted-foreground">Odkryj inne atrakcje w {currentCity}</p>
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
              <CarouselItem key={attraction.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <AttractionCard {...attraction} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-12" />
          <CarouselNext className="hidden md:flex -right-12" />
        </Carousel>
      </CardContent>
    </Card>
  )
}
