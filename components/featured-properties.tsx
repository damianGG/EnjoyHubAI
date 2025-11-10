"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, MapPin, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"

interface Property {
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

interface FeaturedPropertiesProps {
  selectedCategory?: string | null
}

export function FeaturedProperties({ selectedCategory }: FeaturedPropertiesProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProperties() {
      console.log("[v0] Loading properties with category:", selectedCategory)
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
        console.error("Error fetching properties:", error)
        setProperties([])
      } else {
        console.log("[v0] Raw data loaded:", data?.length || 0)
        let filteredData = data || []

        if (selectedCategory) {
          filteredData = data?.filter((property) => property.categories?.slug === selectedCategory) || []
        }

        console.log("[v0] Filtered properties:", filteredData.length)
        setProperties(filteredData)
      }
      setLoading(false)
    }

    fetchProperties()
  }, [selectedCategory])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
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

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {selectedCategory ? "Brak obiektów w tej kategorii." : "Brak dostępnych obiektów."}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {properties.map((property) => (
        <Link key={property.id} href={`/attractions/${property.id}`}>
          <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="aspect-square relative">
              <Image
                src={
                  property.images?.[0] ||
                  `/placeholder.svg?height=300&width=300&query=${encodeURIComponent(property.title) || "/placeholder.svg"}`
                }
                alt={property.title}
                fill
                className="object-cover"
              />
              {property.categories && (
                <Badge className="absolute top-2 left-2 bg-white/90 text-black text-xs">
                  {property.categories.name}
                </Badge>
              )}
            </div>
            <CardContent className="p-3 md:p-4">
              <div className="space-y-1.5 md:space-y-2">
                <h3 className="font-semibold line-clamp-1 text-sm md:text-base">{property.title}</h3>
                <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                  <MapPin className="w-3 md:w-4 h-3 md:h-4 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    {property.city}, {property.country}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                    <Users className="w-3 md:w-4 h-3 md:h-4 mr-1 flex-shrink-0" />
                    Do {property.max_guests} osób
                  </div>
                  <div className="flex items-center">
                    <Star className="w-3 md:w-4 h-3 md:h-4 text-yellow-400 fill-current" />
                    <span className="text-xs md:text-sm ml-1">4.8</span>
                  </div>
                </div>
                <div className="text-base md:text-lg font-semibold">
                  {property.price_per_night} zł{" "}
                  <span className="text-xs md:text-sm font-normal text-muted-foreground">/ noc</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
