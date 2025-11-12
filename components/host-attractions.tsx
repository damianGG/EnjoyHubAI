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
import Link from "next/link"
import { Button } from "@/components/ui/button"

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

interface HostAttractionsProps {
  attractions: Attraction[]
  hostName: string
  hostId: string
}

export function HostAttractions({ attractions, hostName, hostId }: HostAttractionsProps) {
  if (!attractions || attractions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Inne atrakcje gospodarza {hostName}</CardTitle>
          <Link href={`/host/${hostId}`}>
            <Button variant="link" className="text-primary">
              Zobacz wszystkie
            </Button>
          </Link>
        </div>
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
