"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, MapPin, Users } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface AttractionCardProps {
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

export function AttractionCard({
  id,
  title,
  city,
  country,
  images,
  rating,
  reviewsCount,
  maxGuests,
  pricePerNight,
  categoryName,
  slug,
  activitySlug,
}: AttractionCardProps) {
  // Generate URL - use the pattern {city}-{activity}-{slug}-{id}
  const citySlug = city.toLowerCase().replace(/\s+/g, '-')
  const activityPart = activitySlug || 'attraction'
  const titleSlug = slug || title.toLowerCase().replace(/\s+/g, '-')
  const href = `/${citySlug}-${activityPart}-${titleSlug}-${id}`

  return (
    <Link href={href}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        <div className="aspect-square relative">
          <Image
            src={images?.[0] || `/placeholder.svg?height=300&width=300&query=${encodeURIComponent(title)}`}
            alt={title}
            fill
            className="object-cover"
          />
          {categoryName && (
            <Badge className="absolute top-2 left-2 bg-white/90 text-black text-xs">
              {categoryName}
            </Badge>
          )}
        </div>
        <CardContent className="p-3 md:p-4">
          <div className="space-y-1.5 md:space-y-2">
            <h3 className="font-semibold line-clamp-1 text-sm md:text-base">{title}</h3>
            <div className="flex items-center text-xs md:text-sm text-muted-foreground">
              <MapPin className="w-3 md:w-4 h-3 md:h-4 mr-1 flex-shrink-0" />
              <span className="truncate">
                {city}, {country}
              </span>
            </div>
            <div className="flex items-center justify-between">
              {maxGuests && (
                <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                  <Users className="w-3 md:w-4 h-3 md:h-4 mr-1 flex-shrink-0" />
                  Do {maxGuests} osób
                </div>
              )}
              {rating && (
                <div className="flex items-center">
                  <Star className="w-3 md:w-4 h-3 md:h-4 text-yellow-400 fill-current" />
                  <span className="text-xs md:text-sm ml-1">{rating}</span>
                  {reviewsCount && reviewsCount > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">({reviewsCount})</span>
                  )}
                </div>
              )}
            </div>
            {pricePerNight && (
              <div className="text-base md:text-lg font-semibold">
                {pricePerNight} zł <span className="text-xs md:text-sm font-normal text-muted-foreground">/ noc</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
