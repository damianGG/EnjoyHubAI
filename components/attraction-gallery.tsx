"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Grid3X3, X, Maximize2 } from "lucide-react"
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

interface AttractionGalleryProps {
  images: string[]
  title: string
}

export default function AttractionGallery({ images, title }: AttractionGalleryProps) {
  const [currentImage, setCurrentImage] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCarouselView, setIsCarouselView] = useState(false)
  const [api, setApi] = useState<CarouselApi>()
  const [dialogApi, setDialogApi] = useState<CarouselApi>()

  // Sync carousel with current image
  useEffect(() => {
    if (!api) return
    api.on("select", () => {
      setCurrentImage(api.selectedScrollSnap())
    })
  }, [api])

  // Sync dialog carousel with current image
  useEffect(() => {
    if (!dialogApi) return
    dialogApi.on("select", () => {
      setCurrentImage(dialogApi.selectedScrollSnap())
    })
  }, [dialogApi])

  if (!Array.isArray(images) || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <span className="text-muted-foreground">No images available</span>
      </div>
    )
  }

  const nextImage = () => {
    if (isCarouselView && dialogApi) {
      dialogApi.scrollNext()
    } else if (api) {
      api.scrollNext()
    } else {
      setCurrentImage((prev) => (prev + 1) % images.length)
    }
  }

  const prevImage = () => {
    if (isCarouselView && dialogApi) {
      dialogApi.scrollPrev()
    } else if (api) {
      api.scrollPrev()
    } else {
      setCurrentImage((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  const scrollToImage = (index: number) => {
    setCurrentImage(index)
    setIsCarouselView(true)
    // Wait for carousel to be ready, then scroll
    setTimeout(() => {
      if (dialogApi) {
        dialogApi.scrollTo(index)
      }
    }, 100)
  }

  const openGallery = (index: number) => {
    setCurrentImage(index)
    setIsDialogOpen(true)
    setIsCarouselView(false)
  }

  const toggleView = () => {
    setIsCarouselView(!isCarouselView)
  }

  // Scroll carousel when dialog opens and carousel is ready
  useEffect(() => {
    if (isDialogOpen && api) {
      api.scrollTo(currentImage)
    }
  }, [isDialogOpen, api, currentImage])

  // Scroll dialog carousel when it becomes ready
  useEffect(() => {
    if (isCarouselView && dialogApi) {
      dialogApi.scrollTo(currentImage)
    }
  }, [isCarouselView, dialogApi, currentImage])

  return (
    <div className="space-y-4">
      {/* Mobile: Carousel View */}
      <div className="md:hidden">
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {images.map((image, index) => (
              <CarouselItem key={index}>
                <div
                  className="relative aspect-[4/3] cursor-pointer"
                  onClick={() => openGallery(index)}
                >
                  <Image
                    src={image || "/placeholder.jpg"}
                    alt={`${title} – zdjęcie ${index + 1}`}
                    fill
                    className="object-cover rounded-lg"
                    sizes="100vw"
                    priority={index === 0}
                  />
                  {/* Image counter overlay */}
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {index + 1} / {images.length}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {/* Navigation buttons for mobile carousel */}
          {images.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation()
                  prevImage()
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation()
                  nextImage()
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </Carousel>
      </div>

      {/* Desktop: Grid View */}
      <div className="hidden md:grid grid-cols-4 gap-2 aspect-video">
        {/* Main Image */}
        <div
          className="col-span-2 row-span-2 relative cursor-pointer group"
          onClick={() => openGallery(0)}
        >
          <Image
            src={images[0] || "/placeholder.jpg"}
            alt={`${title} – zdjęcie 1`}
            fill
            className="object-cover rounded-l-lg transition-opacity group-hover:opacity-90"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        {/* Side Images */}
        {images.slice(1, 5).map((image, index) => (
          <div
            key={index}
            className="relative cursor-pointer group"
            onClick={() => openGallery(index + 1)}
          >
            <Image
              src={image || "/placeholder.jpg"}
              alt={`${title} – zdjęcie ${index + 2}`}
              fill
              className={cn(
                "object-cover transition-opacity group-hover:opacity-90",
                index === 1 ? "rounded-tr-lg" : index === 3 ? "rounded-br-lg" : ""
              )}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            {/* Show all photos button on last image */}
            {index === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-br-lg group-hover:bg-black/40 transition-colors">
                <Button variant="secondary" size="sm">
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Pokaż wszystkie zdjęcia
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Full-screen Gallery Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="max-w-7xl max-h-[95vh] overflow-hidden p-0" 
          showCloseButton={false}
          aria-describedby="gallery-description"
        >
          <div className="relative h-full bg-black">
            {/* Close button */}
            <Button
              variant="outline"
              size="icon"
              className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/90 hover:bg-white"
              onClick={() => setIsDialogOpen(false)}
              aria-label="Zamknij galerię"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Toggle view button */}
            <Button
              variant="outline"
              size="icon"
              className="absolute top-4 left-4 z-10 h-10 w-10 rounded-full bg-white/90 hover:bg-white"
              onClick={toggleView}
              aria-label={isCarouselView ? "Pokaż siatkę" : "Pokaż slider"}
            >
              {isCarouselView ? <Grid3X3 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {isCarouselView ? (
              /* Full-screen Carousel Slider */
              <div className="relative w-full h-[95vh] flex items-center justify-center">
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <p id="gallery-description" className="sr-only">Galeria zdjęć - {images.length} zdjęć</p>
                
                <Carousel setApi={setDialogApi} className="w-full h-full">
                  <CarouselContent className="h-full">
                    {images.map((image, index) => (
                      <CarouselItem key={index} className="h-full flex items-center justify-center">
                        <div className="relative w-full h-full flex items-center justify-center p-12">
                          <Image
                            src={image || "/placeholder.jpg"}
                            alt={`${title} – zdjęcie ${index + 1}`}
                            fill
                            className="object-contain"
                            sizes="100vw"
                            priority={index === currentImage}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>

                  {/* Navigation arrows */}
                  {images.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white z-10"
                        onClick={(e) => {
                          e.stopPropagation()
                          prevImage()
                        }}
                        aria-label="Poprzednie zdjęcie"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white z-10"
                        onClick={(e) => {
                          e.stopPropagation()
                          nextImage()
                        }}
                        aria-label="Następne zdjęcie"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  )}

                  {/* Image counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium z-10">
                    {currentImage + 1} / {images.length}
                  </div>
                </Carousel>
              </div>
            ) : (
              /* Grid layout for all photos */
              <div className="overflow-y-auto max-h-[95vh] p-6 bg-white">
                <DialogTitle className="text-2xl font-bold mb-4">{title}</DialogTitle>
                <p id="gallery-description" className="sr-only">Galeria zdjęć - {images.length} zdjęć</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={index}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group"
                      onClick={() => scrollToImage(index)}
                    >
                      <Image
                        src={image || "/placeholder.jpg"}
                        alt={`${title} – zdjęcie ${index + 1}`}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
