"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

interface ImageData {
  url: string
  publicId: string
}

interface ImageUploadSectionProps {
  images: ImageData[]
  onImagesChange: (images: ImageData[]) => void
  userId: string
  maxImages?: number
}

export function ImageUploadSection({ 
  images, 
  onImagesChange, 
  userId,
  maxImages = 10 
}: ImageUploadSectionProps) {
  const [uploading, setUploading] = useState(false)

  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > maxImages) {
      toast.error(`Możesz dodać maksymalnie ${maxImages} zdjęć`)
      return
    }

    setUploading(true)
    const newImages: ImageData[] = []

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("image", file)
        formData.append("userId", userId)

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          toast.error(`Nie udało się przesłać ${file.name}: ${error.error}`)
          continue
        }

        const data = await response.json()
        newImages.push({ url: data.secure_url, publicId: data.public_id })
        toast.success(`Przesłano ${file.name}`)
      }

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages])
      }
    } catch (error) {
      console.error("Error uploading images:", error)
      toast.error("Wystąpił błąd podczas przesyłania zdjęć")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleImageRemove = async (index: number) => {
    const image = images[index]
    
    try {
      const response = await fetch("/api/delete-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: image.publicId }),
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(`Nie udało się usunąć zdjęcia: ${error.error}`)
        return
      }

      onImagesChange(images.filter((_, i) => i !== index))
      toast.success("Zdjęcie zostało usunięte")
    } catch (error) {
      console.error("Error deleting image:", error)
      toast.error("Wystąpił błąd podczas usuwania zdjęcia")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zdjęcia</CardTitle>
        <CardDescription>
          Dodaj zdjęcia swojej atrakcji (maksymalnie {maxImages})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
              <Image
                src={image.url}
                alt={`Property image ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleImageRemove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-2 border-dashed rounded-lg p-6">
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            multiple
            onChange={handleImageAdd}
            className="hidden"
            disabled={uploading || images.length >= maxImages}
          />
          <label
            htmlFor="image-upload"
            className={`flex flex-col items-center justify-center cursor-pointer ${
              uploading || images.length >= maxImages ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <span className="text-sm text-muted-foreground">Przesyłanie...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 mb-2" />
                <span className="text-sm text-muted-foreground">
                  {images.length >= maxImages
                    ? "Osiągnięto maksymalną liczbę zdjęć"
                    : "Kliknij, aby wybrać zdjęcia"}
                </span>
              </>
            )}
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
