"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

interface AttractionGalleryProps {
  images: string[]
  title: string
  propertyId: string
}

export default function AttractionGallery({ images, title, propertyId }: AttractionGalleryProps) {
  const [isFavorite, setIsFavorite] = useState(false)

  if (!Array.isArray(images) || images.length === 0) {
    return (
      <div className="w-full h-[400px] md:h-[500px] bg-muted flex items-center justify-center">
        <span className="text-muted-foreground">No images available</span>
      </div>
    )
  }

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite)
    // TODO: Implement actual favorite toggle with Supabase
  }

  return (
    <div className="relative w-full">
      <Carousel className="w-full" opts={{ loop: true }}>
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem key={index}>
              <div className="relative w-full h-[400px] md:h-[500px]">
                <img
                  src={image || "/placeholder.svg?height=500&width=1200"}
                  alt={`${title} - Image ${index + 1}`}
                  className="w-full h-full object-cover"
                  role="img"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {/* Navigation Arrows */}
        <CarouselPrevious 
          className="left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </CarouselPrevious>
        <CarouselNext 
          className="right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </CarouselNext>
      </Carousel>

      {/* Favorites Button Overlay */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-white/90 hover:bg-white shadow-lg"
          onClick={toggleFavorite}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-gray-700"}`}
          />
        </Button>
      </div>
    </div>
  )
}
