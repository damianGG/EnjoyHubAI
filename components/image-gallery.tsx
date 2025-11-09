"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

interface ImageGalleryProps {
  images: string[]
  title: string
}

export default function ImageGallery({ images, title }: ImageGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <span className="text-muted-foreground">No images available</span>
      </div>
    )
  }

  const openGallery = (index: number) => {
    setCurrentIndex(index)
    setIsOpen(true)
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <>
      {/* Desktop Grid Gallery */}
      <div className="hidden md:grid md:grid-cols-4 gap-2 h-[400px]">
        {/* Main large image */}
        <button
          onClick={() => openGallery(0)}
          className="col-span-2 row-span-2 relative overflow-hidden rounded-l-xl hover:opacity-90 transition-opacity"
        >
          <img
            src={images[0]}
            alt={`${title} - Main view`}
            className="w-full h-full object-cover"
          />
        </button>

        {/* Smaller side images */}
        {images.slice(1, 5).map((image, index) => (
          <button
            key={index}
            onClick={() => openGallery(index + 1)}
            className={`relative overflow-hidden hover:opacity-90 transition-opacity ${
              index === 1 ? "rounded-tr-xl" : index === 3 ? "rounded-br-xl" : ""
            }`}
          >
            <img
              src={image}
              alt={`${title} - View ${index + 2}`}
              className="w-full h-full object-cover"
            />
            {index === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-semibold">+{images.length - 5} more</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Mobile Horizontal Scroll */}
      <div className="md:hidden overflow-x-auto flex gap-2 snap-x snap-mandatory">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => openGallery(index)}
            className="flex-shrink-0 w-[85vw] aspect-video rounded-xl overflow-hidden snap-center"
          >
            <img
              src={image}
              alt={`${title} - View ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Fullscreen Gallery Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] p-0">
          <VisuallyHidden>
            <DialogTitle>{title} - Galeria zdjęć</DialogTitle>
          </VisuallyHidden>
          <div className="relative bg-black">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Main image */}
            <div className="flex items-center justify-center min-h-[70vh] max-h-[80vh]">
              <img
                src={images[currentIndex]}
                alt={`${title} - Image ${currentIndex + 1}`}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={prevImage}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={nextImage}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Image counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>

            {/* Thumbnail strip */}
            <div className="bg-black/90 p-4">
              <div className="flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      currentIndex === index ? "border-white scale-105" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
