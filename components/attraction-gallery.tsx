"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Heart, ChevronLeft, ChevronRight } from "lucide-react"
import { ShareButton } from "@/components/share-button"
import Image from "next/image"
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
}

export function AttractionGallery({ images, title }: AttractionGalleryProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)

  if (!Array.isArray(images) || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <span className="text-muted-foreground">Brak zdjęć</span>
      </div>
    )
  }

  return (
    <>
      {/* Main Gallery Carousel */}
      <div className="relative w-full">
        <Carousel className="w-full" opts={{ loop: true }}>
          <CarouselContent>
            {images.map((image, index) => (
              <CarouselItem key={index}>
                <div className="relative aspect-video w-full">
                  <Image
                    src={image || "/placeholder.svg?height=600&width=1200"}
                    alt={`${title} - Zdjęcie ${index + 1}`}
                    fill
                    className="object-cover rounded-lg"
                    priority={index === 0}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4" />
          <CarouselNext className="right-4" />
          
          {/* Action Buttons Overlay */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="bg-white/90 backdrop-blur-sm hover:bg-white"
              onClick={() => setIsFavorite(!isFavorite)}
              aria-label={isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            >
              <Heart
                className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
              />
            </Button>
            <ShareButton
              title={title}
              variant="secondary"
              size="icon"
              className="bg-white/90 backdrop-blur-sm hover:bg-white"
            />
          </div>

          {/* Image Counter */}
          <div className="absolute bottom-4 right-4 z-10">
            <div className="bg-black/60 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
              {images.length} zdjęć
            </div>
          </div>

          {/* View All Button */}
          <div className="absolute bottom-4 left-4 z-10">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/90 backdrop-blur-sm hover:bg-white"
              onClick={() => setIsFullscreen(true)}
            >
              Zobacz wszystkie zdjęcia
            </Button>
          </div>
        </Carousel>
      </div>

      {/* Fullscreen Gallery Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <Carousel className="w-full" opts={{ loop: true }}>
            <CarouselContent>
              {images.map((image, index) => (
                <CarouselItem key={index}>
                  <div className="relative w-full" style={{ height: "80vh" }}>
                    <Image
                      src={image || "/placeholder.svg?height=800&width=1200"}
                      alt={`${title} - Zdjęcie ${index + 1}`}
                      fill
                      className="object-contain"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-4" />
            <CarouselNext className="right-4" />
          </Carousel>
        </DialogContent>
      </Dialog>
    </>
  )
}
