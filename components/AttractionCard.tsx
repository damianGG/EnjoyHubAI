"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star, ChevronLeft, ChevronRight, Diamond, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-optimizer"

// Helper function to format slot date
function formatSlotDate(date: string, startTime: string): string {
  // Parse date in format YYYY-MM-DD
  const [year, month, day] = date.split('-')
  // Format as DD.MM.YYYY HH:mm
  return `${day}.${month}.${year} ${startTime}`
}

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
  /** Optional: Next available slot */
  nextAvailableSlot?: { date: string; startTime: string } | null
  /** Optional: Price from (minimum price) */
  priceFrom?: number | null
  /** Optional: Cover image URL */
  coverImageUrl?: string | null
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
  nextAvailableSlot,
  priceFrom,
  coverImageUrl,
}: AttractionCardProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<number, boolean>>({})

  // Update scroll state when carousel changes
  useEffect(() => {
    if (!api) return

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
      setCurrentSlide(api.selectedScrollSnap())
    }

    updateScrollState()
    api.on("select", updateScrollState)

    return () => {
      api.off("select", updateScrollState)
    }
  }, [api])

  const scrollPrev = () => api?.scrollPrev()
  const scrollNext = () => api?.scrollNext()

  // Ensure images is an array - handle both array and stringified array
  let imageArray: string[] = []
  if (Array.isArray(images)) {
    imageArray = images
  } else if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed)) {
        imageArray = parsed
      }
    } catch {
      // If parsing fails, treat as empty array
      imageArray = []
    }
  }
  
  // Filter out any invalid entries
  const validImages = imageArray.filter(img => img && typeof img === 'string' && img.trim() !== '')
  
  // Use valid images or fallback to placeholder
  const imageList = validImages.length > 0 ? validImages : ["/placeholder.jpg"]

  // Optimize Cloudinary URLs for faster loading
  const optimizedImages = imageList.map(img => optimizeCloudinaryUrl(img, {
    width: 800,
    quality: 'auto',
    format: 'auto',
    crop: 'fill'
  }))

  const cardContent = (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group border border-border">
      {/* Image Carousel */}
      <div className="relative aspect-video">
        <Carousel setApi={setApi} className="w-full h-full">
          <CarouselContent className="h-full">
            {optimizedImages.map((image, index) => {
              // Preload current slide and 2 slides ahead for smoother navigation
              const shouldPreload = index >= currentSlide && index <= currentSlide + 2
              const isFirstImage = index === 0
              const isLoading = imageLoadingStates[index] !== false
              
              return (
                <CarouselItem key={index} className="h-full">
                  <div className="relative w-full h-full">
                    {isLoading && (
                      <Skeleton className="absolute inset-0 rounded-t-xl" />
                    )}
                    <Image
                      src={image}
                      alt={`${title} photo ${index + 1}`}
                      fill
                      priority={isFirstImage}
                      loading={isFirstImage ? undefined : (shouldPreload ? "eager" : "lazy")}
                      className={cn(
                        "object-cover rounded-t-xl transition-opacity duration-300",
                        isLoading ? "opacity-0" : "opacity-100"
                      )}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      onLoad={() => {
                        setImageLoadingStates(prev => ({ ...prev, [index]: false }))
                      }}
                    />
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>

          {/* Navigation Arrows - Visible on mobile, hover on desktop */}
          {optimizedImages.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white border-none shadow-md transition-opacity z-10",
                  "md:opacity-0 md:group-hover:opacity-100", // Only hide on desktop hover
                  !canScrollPrev && "hidden"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
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
                  "absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white border-none shadow-md transition-opacity z-10",
                  "md:opacity-0 md:group-hover:opacity-100", // Only hide on desktop hover
                  !canScrollNext && "hidden"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  scrollNext()
                }}
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Pagination Dots */}
          {optimizedImages.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {optimizedImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    api?.scrollTo(index)
                  }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    currentSlide === index 
                      ? "bg-white w-4" 
                      : "bg-white/60 hover:bg-white/80"
                  )}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
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
      <CardContent className="p-0">
        <div className="space-y-0.5">
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

          {/* Next Available Slot - only show if the prop is provided and has a value */}
          {nextAvailableSlot !== undefined && nextAvailableSlot && (
            <p className="text-xs text-muted-foreground pt-1">
              Najbliższy termin: {formatSlotDate(nextAvailableSlot.date, nextAvailableSlot.startTime)}
            </p>
          )}

          {/* Price */}
          <div className="pt-1">
            <p className="text-sm">
              <span className="font-semibold">Cena od {priceFrom ?? price} zł</span>
              {!priceFrom && <span className="text-muted-foreground"> / {priceUnit}</span>}
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
