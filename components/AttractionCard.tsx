"use client"

import { memo, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Sparkles, Star, Zap } from "lucide-react"
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-optimizer"

function formatSlotDate(date: string, startTime: string): string {
  const [, month, day] = date.split('-')
  return `${day}.${month} · ${startTime}`
}

export interface AttractionCardProps {
  images: string[]
  title: string
  city: string
  region: string
  country: string
  rating: number
  reviewsCount: number
  price: number
  priceUnit: 'noc' | 'osobę' | 'dzień'
  isGuestFavorite?: boolean
  isInstantBookable?: boolean
  href?: string
  id?: string
  nextAvailableSlot?: { date: string; startTime: string } | null
  priceFrom?: number | null
  coverImageUrl?: string | null
}

function AttractionCard({
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
  nextAvailableSlot,
  priceFrom,
  coverImageUrl,
}: AttractionCardProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!api) return
    const update = () => {
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
      setCurrentSlide(api.selectedScrollSnap())
    }
    update()
    api.on("select", update)
    return () => api.off("select", update)
  }, [api])

  let imageArray: string[] = []
  if (Array.isArray(images)) {
    imageArray = images
  } else if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed)) imageArray = parsed
    } catch {
      imageArray = []
    }
  }

  const validImages = imageArray.filter((img) => img && typeof img === 'string' && img.trim() !== '')
  const fallback = coverImageUrl ? [coverImageUrl] : ["/placeholder.jpg"]
  const imageList = validImages.length > 0 ? validImages : fallback
  const optimizedImages = imageList.map((img) => optimizeCloudinaryUrl(img, {
    width: 900,
    quality: 'auto',
    format: 'auto',
    crop: 'fill',
  }))

  const body = (
    <article className="group overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_8px_28px_rgba(55,37,19,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(55,37,19,0.12)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Carousel setApi={setApi} className="h-full w-full">
          <CarouselContent className="h-full">
            {optimizedImages.map((image, index) => {
              const isLoading = imageLoadingStates[index] !== false
              return (
                <CarouselItem key={index} className="h-full">
                  <div className="relative h-full w-full overflow-hidden">
                    {isLoading && <Skeleton className="absolute inset-0 rounded-none" />}
                    <Image
                      src={image}
                      alt={`${title} — zdjęcie ${index + 1}`}
                      fill
                      priority={index === 0}
                      loading={index === 0 ? undefined : "lazy"}
                      className={cn(
                        "object-cover transition duration-500 group-hover:scale-[1.025]",
                        isLoading ? "opacity-0" : "opacity-100"
                      )}
                      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      onLoad={() => setImageLoadingStates((prev) => ({ ...prev, [index]: false }))}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" />
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>

          {optimizedImages.length > 1 && (
            <>
              {canScrollPrev && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full border-0 bg-white/92 opacity-100 shadow-md md:opacity-0 md:group-hover:opacity-100"
                  onClick={(event) => { event.preventDefault(); api?.scrollPrev() }}
                  aria-label="Poprzednie zdjęcie"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {canScrollNext && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full border-0 bg-white/92 opacity-100 shadow-md md:opacity-0 md:group-hover:opacity-100"
                  onClick={(event) => { event.preventDefault(); api?.scrollNext() }}
                  aria-label="Następne zdjęcie"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </Carousel>

        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          {isGuestFavorite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/94 px-2.5 py-1 text-[10px] font-bold text-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" /> Polecane
            </span>
          )}
          {isInstantBookable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/94 px-2.5 py-1 text-[10px] font-bold text-foreground shadow-sm backdrop-blur">
              <Zap className="h-3 w-3 text-primary" /> Od razu
            </span>
          )}
        </div>

        {optimizedImages.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {optimizedImages.slice(0, 6).map((_, index) => (
              <span key={index} className={cn("h-1.5 rounded-full bg-white/70 transition-all", currentSlide === index ? "w-4 bg-white" : "w-1.5")} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-[-0.015em] text-foreground">{title}</h3>
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              {[city, region || country].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-bold text-foreground">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            {rating > 0 ? rating.toFixed(1) : "Nowe"}
          </span>
        </div>

        {nextAvailableSlot !== undefined && (
          <div className="flex items-center gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            {nextAvailableSlot ? (
              <span className="font-medium text-foreground">Najbliżej: {formatSlotDate(nextAvailableSlot.date, nextAvailableSlot.startTime)}</span>
            ) : (
              <span className="text-muted-foreground">Sprawdź kolejne terminy</span>
            )}
          </div>
        )}

        <div className="flex items-end justify-between gap-3 border-t border-black/[0.055] pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">od</p>
            {priceFrom !== undefined ? (
              priceFrom !== null ? (
                <p className="text-lg font-extrabold tracking-[-0.03em] text-foreground">{priceFrom} zł <span className="text-xs font-medium text-muted-foreground">/ os.</span></p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">Zapytaj o dostępność</p>
              )
            ) : (
              <p className="text-lg font-extrabold tracking-[-0.03em] text-foreground">{price} zł <span className="text-xs font-medium text-muted-foreground">/ {priceUnit}</span></p>
            )}
          </div>
          {reviewsCount > 0 && <span className="text-[11px] text-muted-foreground">{reviewsCount} opinii</span>}
        </div>
      </div>
    </article>
  )

  return href ? <Link href={href} className="block">{body}</Link> : body
}

export default memo(AttractionCard)
