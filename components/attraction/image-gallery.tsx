"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
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

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const openGallery = (index: number) => {
    setCurrentIndex(index)
    setIsOpen(true)
  }

  return (
    <>
      {/* Desktop Grid Gallery */}
      <div className="hidden md:grid md:grid-cols-4 gap-2 rounded-xl overflow-hidden h-[400px]">
        {/* Main large image */}
        <button
          onClick={() => openGallery(0)}
          className="col-span-2 row-span-2 relative overflow-hidden group"
        >
          <img
            src={images[0]}
            alt={`${title} - Main view`}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        </button>

        {/* Smaller images */}
        {images.slice(1, 5).map((image, index) => (
          <button
            key={index}
            onClick={() => openGallery(index + 1)}
            className="relative overflow-hidden group"
          >
            <img
              src={image}
              alt={`${title} - View ${index + 2}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            {index === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-semibold">+{images.length - 5} more</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Mobile Horizontal Scroll */}
      <div className="md:hidden flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-xl">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => openGallery(index)}
            className="flex-shrink-0 w-full snap-center"
          >
            <img
              src={image}
              alt={`${title} - View ${index + 1}`}
              className="w-full aspect-video object-cover rounded-xl"
            />
          </button>
        ))}
      </div>

      {/* Fullscreen Gallery Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-7xl h-[90vh] p-0 bg-black">
          <div className="relative h-full flex items-center justify-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Main image */}
            <img
              src={images[currentIndex]}
              alt={`${title} - Image ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />

            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                  onClick={prevImage}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
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
            <div className="absolute bottom-20 left-0 right-0 flex gap-2 overflow-x-auto px-8 pb-4 scrollbar-hide">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    currentIndex === index ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
