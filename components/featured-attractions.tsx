"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, MapPin, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"
import { generateAttractionSlug } from "@/lib/utils"

interface Attraction {
  id: string
  title: string
  city: string
  country: string
  price_per_night: number
  max_guests: number
  images: string[]
  category_id: string
  categories?: {
    name: string
    slug: string
  }
}

interface FeaturedAttractionsProps {
  selectedCategory?: string | null
}

export function FeaturedAttractions({ selectedCategory }: FeaturedAttractionsProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAttractions() {
      console.log("[v0] Loading attractions with category:", selectedCategory)
      setLoading(true)
      const supabase = createClient()

      const query = supabase
        .from("properties")
        .select(`
          *,
          categories (
            name,
            slug
          )
        `)
        .eq("is_active", true)
        .limit(8)

      const { data, error } = await query

      if (error) {
        console.error("Error fetching attractions:", error)
        setAttractions([])
      } else {
        console.log("[v0] Raw data loaded:", data?.length || 0)
        let filteredData = data || []

        if (selectedCategory) {
          filteredData = data?.filter((attraction) => attraction.categories?.slug === selectedCategory) || []
        }

        console.log("[v0] Filtered attractions:", filteredData.length)
        setAttractions(filteredData)
      }
      setLoading(false)
    }

    fetchAttractions()
  }, [selectedCategory])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="aspect-square bg-muted animate-pulse" />
            <CardContent className="p-3 md:p-4">
              <div className="space-y-1.5 md:space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (attractions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {selectedCategory ? "Brak atrakcji w tej kategorii." : "Brak dostępnych atrakcji."}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {attractions.map((attraction) => {
        const slug = generateAttractionSlug({
          city: attraction.city,
          category: attraction.categories?.slug || null,
          title: attraction.title,
          id: attraction.id
        })
        
        return (
          <Link key={attraction.id} href={`/attractions/${slug}`}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
              <div className="aspect-square relative">
                <Image
                  src={attraction.images?.[0] || "/placeholder.jpg"}
                  alt={`${attraction.title} – zdjęcie 1`}
                  fill
                className="object-cover"
              />
              {attraction.categories && (
                <Badge className="absolute top-2 left-2 bg-white/90 text-black text-xs">
                  {attraction.categories.name}
                </Badge>
              )}
            </div>
            <CardContent className="p-3 md:p-4">
              <div className="space-y-1.5 md:space-y-2">
                <h3 className="font-semibold line-clamp-1 text-sm md:text-base">{attraction.title}</h3>
                <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                  <MapPin className="w-3 md:w-4 h-3 md:h-4 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    {attraction.city}, {attraction.country}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                    <Users className="w-3 md:w-4 h-3 md:h-4 mr-1 flex-shrink-0" />
                    Do {attraction.max_guests} osób
                  </div>
                  <div className="flex items-center">
                    <Star className="w-3 md:w-4 h-3 md:h-4 text-yellow-400 fill-current" />
                    <span className="text-xs md:text-sm ml-1">4.8</span>
                  </div>
                </div>
                <div className="text-base md:text-lg font-semibold">
                  {attraction.price_per_night} zł{" "}
                  <span className="text-xs md:text-sm font-normal text-muted-foreground">/ noc</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        )
      })}
    </div>
  )
}
