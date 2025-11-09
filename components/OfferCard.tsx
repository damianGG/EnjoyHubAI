"use client"

import Image from "next/image"
import { Star, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface OfferCardProps {
  id: string
  image: string
  title: string
  city: string
  price: number
  rating: number
  category: string
}

export function OfferCard({ image, title, city, price, rating }: OfferCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-base line-clamp-1 flex-1">{title}</h3>
          <div className="flex items-center gap-1 ml-2">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{rating.toFixed(1)}</span>
          </div>
        </div>
        <div className="flex items-center text-sm text-muted-foreground mb-3">
          <MapPin className="h-4 w-4 mr-1" />
          {city}
        </div>
        <div className="text-base">
          <span className="font-bold">{price} zł</span>
          <span className="text-sm text-muted-foreground"> / osoba</span>
        </div>
      </CardContent>
    </Card>
  )
}
