"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star, ChevronLeft, ChevronRight, Diamond, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface AttractionCardProps {
  /** Array of image URLs for the slider */
  images: string[]
  /** Title of the attraction */
  title: string
  /** City name */
  city: string
  /** Region name */
  region: string
  /** Country name */
  country: string
  /** Average rating (e.g. 4.9) */
  rating: number
  /** Number of reviews */
  reviewsCount: number
  /** Starting price */
  price: number
  /** Price unit depending on category */
  priceUnit: 'noc' | 'osobę' | 'dzień'
  /** Optional: Guest favorite badge */
  isGuestFavorite?: boolean
  /** Optional: Instant booking badge */
  isInstantBookable?: boolean
  /** Optional: Link URL for the card */
  href?: string
  /** Optional: ID for the attraction */
  id?: string
}

export default function AttractionCard({
  images,
  title,
  city,
  region,
  country,
  rating,
  reviewsCount,
  price,
  priceUnit,
  isGuestFavorite = false,
  isInstantBookable = false,
  href,
  id,
}: AttractionCardProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  // Update scroll state when carousel changes
  useEffect(() => {
    if (!api) return

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }

    updateScrollState()
    api.on("select", updateScrollState)

    return () => {
      api.off("select", updateScrollState)
    }
  }, [api])

  const scrollPrev = () => api?.scrollPrev()
  const scrollNext = () => api?.scrollNext()

  // Ensure at least one image
  const imageList = images.length > 0 ? images : ["/placeholder.svg?height=400&width=400"]

  const cardContent = (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
      {/* Image Carousel */}
      <div className="relative aspect-square">
        <Carousel setApi={setApi} className="w-full h-full">
          <CarouselContent className="h-full">
            {imageList.map((image, index) => (
              <CarouselItem key={index} className="h-full">
                <div className="relative w-full h-full">
                  <Image
                    src={image}
                    alt={`${title} photo ${index + 1}`}
                    fill
                    unoptimized
                    className="object-cover rounded-t-xl"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Navigation Arrows - Always visible on hover */}
          {imageList.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white border-none shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10",
                  !canScrollPrev && "hidden"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  scrollPrev()
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white border-none shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10",
                  !canScrollNext && "hidden"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  scrollNext()
                }}
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </Carousel>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {isGuestFavorite && (
            <Badge className="bg-white/90 text-black text-xs font-medium shadow-sm">
              <Diamond className="w-3 h-3 mr-1" />
              Ulubieniec Gości
            </Badge>
          )}
          {isInstantBookable && (
            <Badge className="bg-white/90 text-black text-xs font-medium shadow-sm">
              <Zap className="w-3 h-3 mr-1" />
              Rezerwacja natychmiastowa
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-3">
        <div className="space-y-1">
          {/* Title and Rating */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm line-clamp-2 flex-1">
              {title}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-sm font-medium">{rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Location */}
          <p className="text-sm text-muted-foreground line-clamp-1">
            {city}, {region}, {country}
          </p>

          {/* Reviews Count */}
          <p className="text-xs text-muted-foreground">
            ({reviewsCount} {reviewsCount === 1 ? 'opinia' : 'opinii'})
          </p>

          {/* Price */}
          <div className="pt-1">
            <p className="text-sm">
              <span className="font-semibold">Cena od {price} zł</span>
              <span className="text-muted-foreground"> / {priceUnit}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Wrap in Link if href is provided
  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}
