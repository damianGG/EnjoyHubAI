"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Share2, Heart } from "lucide-react"
import ImageGallery from "@/components/attraction/image-gallery"
import AttractionDetails from "@/components/attraction/attraction-details"
import ReviewsSection from "@/components/attraction/reviews-section"
import OrganizerInfo from "@/components/attraction/organizer-info"
import NearbyAttractions from "@/components/attraction/nearby-attractions"
import { Attraction } from "@/types/attraction"

// Section: Mock Data
const mockAttraction: Attraction = {
  id: "1",
  title: "Extreme Paintball Arena Warsaw",
  city: "Warsaw",
  region: "Mazowieckie",
  shortDescription: "The largest outdoor paintball arena in Warsaw with professional equipment",
  category: "Paintball",
  description:
    "Experience the ultimate adrenaline rush at our state-of-the-art paintball facility. With over 5 hectares of diverse terrain including forests, urban zones, and tactical obstacles, we offer an unforgettable adventure for both beginners and experienced players. Our professional staff ensures safety and fun for all participants.",
  openingHours: "Mon-Fri: 10:00-20:00, Sat-Sun: 9:00-21:00",
  address: "ul. Polna 123, 00-001 Warsaw, Poland",
  mapLink: "https://maps.google.com/?q=Warsaw+Paintball",
  priceFrom: 80,
  priceTo: 150,
  priceUnit: "zł / person",
  duration: "2-4 hours",
  ageLimit: "12+ years (parental consent required for minors)",
  amenities: [
    "Free parking",
    "Grill area",
    "Changing rooms",
    "Toilets",
    "Covered rest area",
    "Equipment rental",
    "First aid station",
    "Cafe/snack bar",
    "Lockers",
  ],
  tips: [
    "Bring spare clothes - you will get dirty!",
    "Wear comfortable sports shoes with good grip",
    "Book in advance on weekends",
    "Groups of 10+ get special discounts",
    "Waterproof clothing recommended in rainy weather",
  ],
  howItWorks:
    "Paintball is a tactical team sport where players eliminate opponents by hitting them with paint-filled capsules shot from special markers. Our games include various scenarios like Capture the Flag, Team Deathmatch, and VIP Protection. Each session starts with a safety briefing and equipment check. Our experienced marshals supervise all games to ensure fair play and safety.",
  images: [
    "/placeholder.svg?height=600&width=900&text=Paintball+Arena+Main",
    "/placeholder.svg?height=400&width=600&text=Combat+Zone",
    "/placeholder.svg?height=400&width=600&text=Equipment",
    "/placeholder.svg?height=400&width=600&text=Team+Action",
    "/placeholder.svg?height=400&width=600&text=Rest+Area",
    "/placeholder.svg?height=400&width=600&text=Urban+Zone",
  ],
  organizer: {
    name: "Warsaw Extreme Sports Ltd.",
    image: "/placeholder.svg?height=100&width=100&text=Logo",
    description:
      "We have been organizing paintball events and outdoor activities in Warsaw for over 10 years. Our mission is to provide safe, exciting experiences that bring people together through adventure sports.",
    phone: "+48 123 456 789",
    email: "info@warsawpaintball.pl",
  },
  reviews: [
    {
      id: "1",
      userName: "Jan Kowalski",
      rating: 5,
      comment:
        "Amazing experience! The staff was very professional and helpful. The terrain is huge with lots of variety. Perfect for a bachelor party!",
      date: "2024-10-15",
    },
    {
      id: "2",
      userName: "Anna Nowak",
      rating: 5,
      comment: "Great fun for the whole company outing. Equipment in excellent condition, fair prices. Will definitely come back!",
      date: "2024-10-08",
    },
    {
      id: "3",
      userName: "Piotr Wiśniewski",
      rating: 4,
      comment:
        "Very good arena with diverse scenarios. Only minus is that it can get crowded on weekends. Book early!",
      date: "2024-09-28",
    },
    {
      id: "4",
      userName: "Maria Lewandowska",
      rating: 5,
      comment: "Perfect organization, friendly staff, great facilities. The grill area is a nice bonus for after the game!",
      date: "2024-09-20",
    },
  ],
  nearbyAttractions: [
    {
      id: "2",
      name: "Go-Kart Racing Track",
      image: "/placeholder.svg?height=300&width=400&text=Go-Kart",
      distance: "2.5 km",
      category: "Go-Karts",
      priceFrom: 60,
      rating: 4.7,
    },
    {
      id: "3",
      name: "Escape Room Mystery",
      image: "/placeholder.svg?height=300&width=400&text=Escape+Room",
      distance: "3.8 km",
      category: "Escape Room",
      priceFrom: 100,
      rating: 4.9,
    },
    {
      id: "4",
      name: "Adventure Rope Park",
      image: "/placeholder.svg?height=300&width=400&text=Rope+Park",
      distance: "5.2 km",
      category: "Rope Park",
      priceFrom: 45,
      rating: 4.6,
    },
  ],
}

interface AttractionPageProps {
  attraction?: Attraction
}

export default function AttractionPage({ attraction = mockAttraction }: AttractionPageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Section: Header with navigation */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{attraction.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {attraction.city}, {attraction.region}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant="outline" size="sm">
              <Heart className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Section: Image Gallery */}
        <div className="mb-8">
          <ImageGallery images={attraction.images} title={attraction.title} />
        </div>

        {/* Section: Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left column - Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Section: Short description */}
            {attraction.shortDescription && (
              <div>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {attraction.shortDescription}
                </p>
              </div>
            )}

            {/* Section: Attraction details */}
            <AttractionDetails
              category={attraction.category}
              description={attraction.description}
              openingHours={attraction.openingHours}
              address={attraction.address}
              mapLink={attraction.mapLink}
              priceFrom={attraction.priceFrom}
              priceTo={attraction.priceTo}
              priceUnit={attraction.priceUnit}
              duration={attraction.duration}
              ageLimit={attraction.ageLimit}
              amenities={attraction.amenities}
              tips={attraction.tips}
            />

            {/* Section: How it works */}
            {attraction.howItWorks && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="text-2xl font-bold">How It Works</h2>
                  <p className="text-muted-foreground leading-relaxed">{attraction.howItWorks}</p>
                </CardContent>
              </Card>
            )}

            {/* Section: Reviews */}
            <ReviewsSection reviews={attraction.reviews} />

            {/* Section: Nearby attractions */}
            {attraction.nearbyAttractions && attraction.nearbyAttractions.length > 0 && (
              <NearbyAttractions attractions={attraction.nearbyAttractions} />
            )}
          </div>

          {/* Right column - Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Section: Organizer info */}
              <OrganizerInfo organizer={attraction.organizer} />

              {/* Section: Quick booking card (placeholder) */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {attraction.priceFrom && attraction.priceTo ? (
                        <>
                          {attraction.priceFrom} - {attraction.priceTo} zł
                        </>
                      ) : attraction.priceFrom ? (
                        <>From {attraction.priceFrom} zł</>
                      ) : null}
                    </div>
                    <div className="text-sm text-muted-foreground">{attraction.priceUnit}</div>
                  </div>
                  <Button className="w-full" size="lg">
                    Book Now
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Free cancellation up to 24 hours before
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
