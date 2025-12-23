import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, MapPin, Users, Bed, Bath, Wifi, Car, ArrowLeft, Heart, Share2 } from "lucide-react"
import Link from "next/link"
import AttractionGallery from "@/components/attraction-gallery"
import MultiSlotBookingWidget from "@/components/multi-slot-booking-widget"
import PropertyContactInfo from "@/components/property-contact-info"
import ReviewsList from "@/components/reviews-list"
import AttractionMap from "@/components/attraction-map"
import AvailabilityCalendar from "@/components/availability-calendar"
import { extractIdFromSlug } from "@/lib/utils"
import { TopNav } from "@/components/top-nav"
import { BottomNav } from "@/components/bottom-nav"
import type { Offer } from "@/lib/types/dynamic-fields"

// Enable ISR - revalidate every 120 seconds
export const revalidate = 120

interface AttractionPageProps {
  params: {
    slug: string
  }
}

const amenityIcons: Record<string, any> = {
  WiFi: Wifi,
  Parking: Car,
  // Add more icons as needed
}

export default async function AttractionPage({ params }: AttractionPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()
  
  // Extract ID from slug
  const id = extractIdFromSlug(params.slug)

  // Get attraction details with host info and reviews
  const { data: attraction } = await supabase
    .from("properties")
    .select(`
      *,
      users!properties_host_id_fkey (full_name, avatar_url, created_at, email, phone),
      reviews (
        id,
        rating,
        comment,
        created_at,
        users!reviews_guest_id_fkey (full_name)
      )
    `)
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if (!attraction) {
    notFound()
  }

  // Check if property has any active offers with availability configured
  const { data: offers } = await supabase
    .from("offers")
    .select("id")
    .eq("place_id", id)
    .eq("is_active", true)

  let hasAvailability = false
  if (offers && offers.length > 0) {
    // Check if at least one offer has availability configured
    const { count } = await supabase
      .from("offer_availability")
      .select("*", { count: "exact", head: true })
      .in("offer_id", offers.map(o => o.id))
    
    hasAvailability = !!count && count > 0
  }

  // Calculate average rating
  const ratings = attraction.reviews?.map((r: any) => r.rating) || []
  const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0
  const roundedRating = Math.round(avgRating * 10) / 10

  // Get offers for this property
  const { data: offers } = await supabase
    .from("offers")
    .select("*")
    .eq("place_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Navigation Bar */}
      <div className="hidden md:block">
        <TopNav />
      </div>

      {/* Desktop Secondary Navigation */}
      <div className="hidden md:block border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span>Powrót do strony głównej</span>
          </Link>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Heart className="h-4 w-4 mr-2" />
              Zapisz
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Udostępnij
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Floating Navigation - Airbnb Style */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 px-4 pt-4 flex items-center justify-between pointer-events-none">
        <Link 
          href="/" 
          className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white transition-colors"
          aria-label="Powrót do strony głównej"
        >
          <ArrowLeft className="h-5 w-5 text-gray-900" />
        </Link>

        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="pointer-events-auto h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white"
            aria-label="Udostępnij tę atrakcję"
          >
            <Share2 className="h-5 w-5 text-gray-900" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="pointer-events-auto h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white"
            aria-label="Zapisz w ulubionych"
          >
            <Heart className="h-5 w-5 text-gray-900" />
          </Button>
        </div>
      </div>

      {/* Image Gallery - Full Width on Mobile */}
      <div className="md:hidden">
        <AttractionGallery images={attraction.images || []} title={attraction.title} />
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Property Title and Rating - Desktop */}
        <div className="hidden md:block mb-6">
          <div className="flex items-start justify-between mb-2 gap-2">
            <h1 className="text-3xl font-bold">{attraction.title}</h1>
            {avgRating > 0 && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{roundedRating}</span>
                </div>
                <span className="text-muted-foreground">({ratings.length} reviews)</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-base text-muted-foreground">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              <span>
                {attraction.city}, {attraction.country}
              </span>
            </div>
            <Badge variant="secondary">{attraction.property_type}</Badge>
          </div>
        </div>

        {/* Image Gallery - Desktop */}
        <div className="hidden md:block mb-8">
          <AttractionGallery images={attraction.images || []} title={attraction.title} />
        </div>

        {/* Property Title and Rating - Mobile */}
        <div className="md:hidden mb-4">
          <div className="flex flex-col mb-2 gap-2">
            <h1 className="text-2xl font-bold">{attraction.title}</h1>
            {avgRating > 0 && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{roundedRating}</span>
                </div>
                <span className="text-muted-foreground">({ratings.length} reviews)</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              <span>
                {attraction.city}, {attraction.country}
              </span>
            </div>
            <Badge variant="secondary">{attraction.property_type}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            {/* Property Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span className="text-lg sm:text-xl">Hosted by {attraction.users?.full_name}</span>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span>{attraction.max_guests} guests</span>
                    </div>
                    <div className="flex items-center">
                      <Bed className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span>{attraction.bedrooms} bedrooms</span>
                    </div>
                    <div className="flex items-center">
                      <Bath className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span>{attraction.bathrooms} bathrooms</span>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{attraction.description}</p>
              </CardContent>
            </Card>

            {/* Amenities */}
            {attraction.amenities && attraction.amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">What this place offers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {attraction.amenities.map((amenity: string) => {
                      const IconComponent = amenityIcons[amenity]
                      return (
                        <div key={amenity} className="flex items-center space-x-2 text-sm sm:text-base">
                          {IconComponent ? (
                            <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-muted rounded-full flex-shrink-0" />
                          )}
                          <span>{amenity}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Where you'll be</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  {attraction.address}, {attraction.city}, {attraction.country}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AttractionMap
                  attractions={[
                    {
                      id: attraction.id,
                      title: attraction.title,
                      city: attraction.city,
                      country: attraction.country,
                      latitude: attraction.latitude,
                      longitude: attraction.longitude,
                      price_per_night: attraction.price_per_night,
                      property_type: attraction.property_type,
                      max_guests: attraction.max_guests,
                      bedrooms: attraction.bedrooms,
                      bathrooms: attraction.bathrooms,
                      images: attraction.images,
                      avgRating: roundedRating,
                      reviewCount: ratings.length,
                    },
                  ]}
                  className="h-64 sm:h-96"
                />
              </CardContent>
            </Card>

            {/* Reviews */}
            <ReviewsList reviews={attraction.reviews || []} avgRating={roundedRating} />

            {/* Availability Calendar for Offers */}
            {offers && offers.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-xl sm:text-2xl font-bold">Dostępność ofert</h2>
                {offers.map((offer: Offer) => (
                  <div key={offer.id} className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg sm:text-xl flex items-center justify-between">
                          <span>{offer.title}</span>
                          <Badge variant="secondary">
                            {offer.base_price} {offer.currency}
                          </Badge>
                        </CardTitle>
                        {offer.description && (
                          <CardDescription className="text-sm sm:text-base">
                            {offer.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                    <AvailabilityCalendar offerId={offer.id} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {hasAvailability ? (
                <MultiSlotBookingWidget propertyId={attraction.id} />
              ) : (
                <PropertyContactInfo
                  phone={attraction.users?.phone}
                  email={attraction.users?.email}
                  address={attraction.address}
                  city={attraction.city}
                  country={attraction.country}
                  openingHours={attraction.opening_hours}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar for Mobile */}
      <BottomNav />
    </div>
  )
}
