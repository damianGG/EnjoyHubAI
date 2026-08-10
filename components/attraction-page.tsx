"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Share2, Heart, ArrowLeft } from "lucide-react"
import { Attraction } from "@/types/attraction"
import ImageGallery from "./image-gallery"
import AttractionDetails from "./attraction-details"
import ReviewsSection from "./reviews-section"
import OrganizerInfo from "./organizer-info"
import NearbyAttractions from "./nearby-attractions"

// Mock data for demonstration
const mockAttraction: Attraction = {
  id: "1",
  title: "Paintball Arena Warszawa",
  city: "Warszawa",
  region: "Mazowieckie",
  shortDescription: "Najlepsza arena paintballowa w Warszawie z 5 scenariuszami gry",
  category: "Paintball",
  description:
    "Profesjonalna arena paintballowa wyposażona w najnowszy sprzęt i różnorodne scenerie gry. Oferujemy niezapomniane rozgrywki dla grup przyjaciół, firm oraz eventów okolicznościowych. Nasi instruktorzy zapewnią bezpieczną i ekscytującą zabawę.",
  howItWorks:
    "Paintball to sportowa gra zespołowa, w której gracze eliminują przeciwników, strzelając do nich kulkami z farbą wypuszczanymi z markerów. Gra odbywa się na specjalnie przygotowanym terenie z przeszkodami i ukryciami. Przed rozpoczęciem rozgrywki każdy uczestnik otrzymuje pełen instruktaż bezpieczeństwa oraz komplet sprzętu ochronnego.",
  images: [
    "https://images.unsplash.com/photo-1624395149011-470cf6f6ec02?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1511886929837-354d827aae26?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1534329539061-64caeb388c42?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1520529301723-e3a4c0b69e3d?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=300&fit=crop",
  ],
  openingHours: "Pn-Pt: 10:00-22:00, Sb-Nd: 9:00-23:00",
  address: "ul. Paintballowa 15, 01-234 Warszawa",
  mapLink: "https://maps.google.com/?q=52.2297,21.0122",
  priceFrom: 80,
  priceTo: 150,
  priceUnit: "zł / osoba",
  duration: "2-4 godziny",
  ageLimit: "12+ (z opiekunem), 16+ (samodzielnie)",
  amenities: [
    "Parking",
    "Szatnia",
    "Toalety",
    "Grill",
    "Wiata",
    "Profesjonalny sprzęt",
    "Instruktor",
    "Zaplecze sanitarne",
  ],
  tips: [
    "Zabierz ubranie na zmianę - może być mokro i brudno",
    "Zalecany wygodny strój sportowy",
    "Warto zarezerwować wcześniej, szczególnie w weekendy",
    "Minimalna grupa to 6 osób",
  ],
  organizer: {
    name: "Active Sport Events",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop",
    description:
      "Organizujemy profesjonalne eventy sportowe i rekreacyjne od 2010 roku. Specjalizujemy się w paintballu, lasertagu oraz innych atrakcjach outdoor.",
    phone: "+48 123 456 789",
    email: "kontakt@activesportevents.pl",
  },
  reviews: [
    {
      id: "1",
      userName: "Jan Kowalski",
      rating: 5,
      comment:
        "Świetna zabawa! Profesjonalna obsługa, sprzęt w bardzo dobrym stanie. Scenerie ciekawe i zróżnicowane. Na pewno wrócimy z ekipą!",
      date: "2024-01-15",
    },
    {
      id: "2",
      userName: "Anna Nowak",
      rating: 4,
      comment:
        "Bardzo fajne miejsce, polecam na imprezy firmowe. Jedyny minus to brak możliwości zamówienia jedzenia na miejscu, ale grill ratuje sytuację.",
      date: "2024-01-10",
    },
    {
      id: "3",
      userName: "Piotr Wiśniewski",
      rating: 5,
      comment:
        "Najlepsza arena paintballowa w Warszawie! Instruktorzy pomocni i zorientowani w temacie. Świetna organizacja, zero przestojów.",
      date: "2024-01-05",
    },
  ],
  nearbyAttractions: [
    {
      id: "2",
      title: "Gokarty Speed Track",
      image: "https://images.unsplash.com/photo-1566134616566-77a6952a92a8?w=400&h=300&fit=crop",
      distance: "2.5 km",
      category: "Gokarty",
      priceFrom: 60,
    },
    {
      id: "3",
      title: "Escape Room Enigma",
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
      distance: "3.8 km",
      category: "Escape Room",
      priceFrom: 100,
    },
    {
      id: "4",
      title: "Park Linowy Adventure",
      image: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=400&h=300&fit=crop",
      distance: "5.2 km",
      category: "Park Linowy",
      priceFrom: 50,
    },
    {
      id: "5",
      title: "Laser Tag Arena",
      image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop",
      distance: "1.8 km",
      category: "Laser Tag",
      priceFrom: 70,
    },
  ],
}

interface AttractionPageProps {
  attraction?: Attraction
}

export default function AttractionPage({ attraction = mockAttraction }: AttractionPageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Section: Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Wróć</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Share2 className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Heart className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Section: Title and Location */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{attraction.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>
                {attraction.city}, {attraction.region}
              </span>
            </div>
            {attraction.shortDescription && (
              <>
                <span>•</span>
                <span className="text-sm">{attraction.shortDescription}</span>
              </>
            )}
          </div>
        </div>

        {/* Section: Image Gallery */}
        <div className="mb-8">
          <ImageGallery images={attraction.images} title={attraction.title} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Section: Attraction Details */}
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

            {/* Section: How it Works */}
            {attraction.howItWorks && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-2xl font-bold mb-4">Na czym polega atrakcja</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {attraction.howItWorks}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Section: Reviews */}
            <ReviewsSection reviews={attraction.reviews} />
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Section: Organizer Info */}
              <OrganizerInfo organizer={attraction.organizer} />

              {/* Booking/Contact Card */}
              <Card className="border-2 border-primary">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold">{attraction.priceFrom}</span>
                      <span className="text-muted-foreground">- {attraction.priceTo}</span>
                      <span className="text-sm text-muted-foreground">{attraction.priceUnit}</span>
                    </div>
                    {attraction.duration && (
                      <p className="text-sm text-muted-foreground">
                        Czas trwania: {attraction.duration}
                      </p>
                    )}
                  </div>
                  <Button className="w-full" size="lg">
                    Zarezerwuj teraz
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Gwarancja najlepszej ceny
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Section: Nearby Attractions */}
        {attraction.nearbyAttractions && attraction.nearbyAttractions.length > 0 && (
          <div className="mt-12">
            <NearbyAttractions attractions={attraction.nearbyAttractions} />
          </div>
        )}
      </div>
    </div>
  )
}
