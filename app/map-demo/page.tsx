"use client"

import AttractionMap from "@/components/attraction-map"

export default function MapDemoPage() {
  // Sample data for demonstration
  const sampleAttractions = [
    {
      id: "1",
      title: "Góry Tatry - Wycieczka z przewodnikiem",
      city: "Zakopane",
      country: "Polska",
      latitude: 49.2992,
      longitude: 19.9496,
      price_per_night: 454,
      property_type: "Wycieczka",
      category_slug: "mountains",
      category_icon: "⛰️",
      max_guests: 15,
      bedrooms: 0,
      bathrooms: 0,
      images: [
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=600&fit=crop",
      ],
      avgRating: 4.9,
      reviewCount: 128,
    },
    {
      id: "2",
      title: "Rejs statkiem po Bałtyku",
      city: "Gdańsk",
      country: "Polska",
      latitude: 54.3520,
      longitude: 18.6466,
      price_per_night: 250,
      property_type: "Rejs",
      category_slug: "sea",
      category_icon: "⛵",
      max_guests: 50,
      bedrooms: 0,
      bathrooms: 2,
      images: [
        "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
      ],
      avgRating: 4.7,
      reviewCount: 86,
    },
    {
      id: "3",
      title: "Hotel Górski z widokiem na szczyty",
      city: "Karpacz",
      country: "Polska",
      latitude: 50.7753,
      longitude: 15.7393,
      price_per_night: 350,
      property_type: "Hotel",
      category_slug: "hotel",
      category_icon: "🏨",
      max_guests: 4,
      bedrooms: 2,
      bathrooms: 1,
      images: [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=600&fit=crop",
      ],
      avgRating: 4.8,
      reviewCount: 215,
    },
    {
      id: "4",
      title: "Wycieczka rowerowa po Mazurach",
      city: "Giżycko",
      country: "Polska",
      latitude: 54.0408,
      longitude: 21.7657,
      price_per_night: 180,
      property_type: "Wycieczka",
      category_slug: "bike",
      category_icon: "🚴",
      max_guests: 20,
      bedrooms: 0,
      bathrooms: 0,
      images: [
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&h=600&fit=crop",
      ],
      avgRating: 4.6,
      reviewCount: 54,
    },
    {
      id: "5",
      title: "Spa & Wellness w sercu Beskidów",
      city: "Wisła",
      country: "Polska",
      latitude: 49.6546,
      longitude: 18.8574,
      price_per_night: 420,
      property_type: "Spa",
      category_slug: "spa",
      category_icon: "💆",
      max_guests: 2,
      bedrooms: 1,
      bathrooms: 1,
      images: [
        "https://images.unsplash.com/photo-1513326738677-b964603b136d?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&h=600&fit=crop",
      ],
      avgRating: 4.9,
      reviewCount: 312,
    },
    {
      id: "6",
      title: "Spływ kajakowy Dunajcem",
      city: "Szczawnica",
      country: "Polska",
      latitude: 49.4171,
      longitude: 20.4956,
      price_per_night: 120,
      property_type: "Spływ",
      category_slug: "kayak",
      category_icon: "🛶",
      max_guests: 30,
      bedrooms: 0,
      bathrooms: 0,
      images: [
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=600&fit=crop",
      ],
      avgRating: 4.5,
      reviewCount: 97,
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Map View Demo - Attraction Cards</h1>
        <p className="text-muted-foreground">
          Click on any marker to see the attraction card with image slider (Airbnb style)
        </p>
      </div>

      <div className="h-[700px]">
        <AttractionMap attractions={sampleAttractions} className="h-full" />
      </div>

      <div className="mt-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">New Features</h2>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>Click on any map marker to display an attraction card with image slider</li>
          <li>The card includes all details: images carousel, rating, price, and reviews</li>
          <li>Navigation arrows and dots for browsing through images (Airbnb style)</li>
          <li>Close button (X) to dismiss the card</li>
          <li>Positioned at the bottom center for optimal visibility</li>
          <li>Smooth transitions and hover effects</li>
        </ul>
      </div>
    </div>
  )
}
