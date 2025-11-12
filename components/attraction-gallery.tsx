"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Grid3X3 } from "lucide-react"

interface AttractionGalleryProps {
  images: string[]
  title: string
}

export default function AttractionGallery({ images, title }: AttractionGalleryProps) {
  const [currentImage, setCurrentImage] = useState(0)

  if (!Array.isArray(images) || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <span className="text-muted-foreground">No images available</span>
      </div>
    )
  }

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="space-y-4">
      {/* Main Gallery Grid */}
      <div className="grid grid-cols-4 gap-2 aspect-video">
        {/* Main Image */}
        <div className="col-span-2 row-span-2 relative">
          <img
            src={images[0] || "/placeholder.svg?height=400&width=600"}
            alt={`${title} - Main view`}
            className="w-full h-full object-cover rounded-l-lg"
          />
        </div>

        {/* Side Images */}
        {images.slice(1, 5).map((image, index) => (
          <div key={index} className="relative">
            <img
              src={image || "/placeholder.svg?height=200&width=300"}
              alt={`${title} - View ${index + 2}`}
              className={`w-full h-full object-cover ${
                index === 1 ? "rounded-tr-lg" : index === 3 ? "rounded-br-lg" : ""
              }`}
            />
            {index === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-br-lg">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      Show all photos
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                    <div className="relative">
                      <img
                        src={images[currentImage] || "/placeholder.svg?height=600&width=800"}
                        alt={`${title} - Image ${currentImage + 1}`}
                        className="w-full h-auto max-h-[70vh] object-contain"
                      />

                      {images.length > 1 && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-transparent"
                            onClick={prevImage}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent"
                            onClick={nextImage}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                        {currentImage + 1} / {images.length}
                      </div>
                    </div>

                    {/* Thumbnail Strip */}
                    <div className="flex space-x-2 overflow-x-auto p-4">
                      {images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImage(index)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                            currentImage === index ? "border-primary" : "border-transparent"
                          }`}
                        >
                          <img
                            src={image || "/placeholder.svg?height=64&width=64"}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
