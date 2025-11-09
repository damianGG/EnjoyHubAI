"use client"

import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Star } from "lucide-react"
import Link from "next/link"

const mockResults = [
  {
    id: "1",
    title: "Paintball Lublin Adventure",
    city: "Lublin",
    country: "Polska",
    price_per_night: 100,
    category_name: "Paintball",
    avg_rating: 4.8,
  },
  {
    id: "2",
    title: "Outdoor Paintball Kraków",
    city: "Kraków",
    country: "Polska",
    price_per_night: 120,
    category_name: "Paintball",
    avg_rating: 4.5,
  },
  {
    id: "3",
    title: "Paintball Park Wrocław",
    city: "Wrocław",
    country: "Polska",
    price_per_night: 90,
    category_name: "Paintball",
    avg_rating: 4.7,
  },
  {
    id: "4",
    title: "Escape Room Warszawa",
    city: "Warszawa",
    country: "Polska",
    price_per_night: 150,
    category_name: "Escape Room",
    avg_rating: 4.9,
  },
  {
    id: "5",
    title: "Laser Tag Gdańsk",
    city: "Gdańsk",
    country: "Polska",
    price_per_night: 80,
    category_name: "Gaming Center",
    avg_rating: 4.6,
  },
  {
    id: "6",
    title: "VR Arena Poznań",
    city: "Poznań",
    country: "Polska",
    price_per_night: 110,
    category_name: "Gaming Center",
    avg_rating: 4.8,
  },
]

export default function CategoryDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">E</span>
            </div>
            <span className="text-xl font-bold">EnjoyHub</span>
          </Link>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">All Properties</h1>
          <p className="text-muted-foreground">14 properties found</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-4">
          {mockResults.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="overflow-hidden border-0 md:border hover:shadow-lg transition-shadow cursor-pointer bg-transparent md:bg-card">
                <div className="aspect-[4/3] md:aspect-auto bg-muted relative rounded-xl md:rounded-none overflow-hidden md:hidden">
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="h-12 w-12 text-muted-foreground" />
                  </div>
                </div>
                
                <CardContent className="p-2 md:p-4">
                  <div className="flex items-start justify-between mb-0.5 md:mb-2">
                    <h3 className="font-semibold line-clamp-1 text-sm md:text-lg flex-1">{property.title}</h3>
                    {property.avg_rating > 0 && (
                      <div className="flex items-center space-x-0.5 md:space-x-1 text-xs md:text-sm flex-shrink-0 ml-1">
                        <Star className="h-3 w-3 md:h-4 md:w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{property.avg_rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs md:text-sm text-muted-foreground mb-1 md:mb-2 line-clamp-1">
                    {property.city}, {property.country}
                  </div>
                  
                  {property.category_name && (
                    <div className="text-xs md:text-sm text-muted-foreground mb-1 md:mb-2 hidden md:block">
                      Category: {property.category_name}
                    </div>
                  )}
                  
                  <div className="flex items-baseline mt-1 md:mt-0">
                    <span className="font-semibold text-sm md:text-xl">${property.price_per_night}</span>
                    <span className="text-xs md:text-sm text-muted-foreground ml-1">/night</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
