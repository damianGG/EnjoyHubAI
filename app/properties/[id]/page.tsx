import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, MapPin, Users, Bed, Bath, Wifi, Car, ArrowLeft, Heart } from "lucide-react"
import Link from "next/link"
import PropertyGallery from "@/components/property-gallery"
import BookingCard from "@/components/booking-card"
import ReviewsList from "@/components/reviews-list"
import PropertyMap from "@/components/property-map"

interface PropertyPageProps {
  params: {
    id: string
  }
}

const amenityIcons: Record<string, any> = {
  WiFi: Wifi,
  Parking: Car,
  // Add more icons as needed
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()

  // Get property details with host info and reviews
  const { data: property } = await supabase
    .from("properties")
    .select(`
      *,
      users!properties_host_id_fkey (full_name, avatar_url, created_at),
      reviews (
        id,
        rating,
        comment,
        created_at,
        users!reviews_guest_id_fkey (full_name)
      )
    `)
    .eq("id", params.id)
    .eq("is_active", true)
    .single()

  if (!property) {
    notFound()
  }

  // Calculate average rating
  const ratings = property.reviews?.map((r: any) => r.rating) || []
  const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0
  const roundedRating = Math.round(avgRating * 10) / 10

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/properties" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Properties
          </Link>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Heart className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" size="sm">
              Share
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Property Title and Rating */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-3xl font-bold">{property.title}</h1>
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

          <div className="flex items-center space-x-4 text-muted-foreground">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              <span>
                {property.city}, {property.country}
              </span>
            </div>
            <Badge variant="secondary">{property.property_type}</Badge>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-8">
          <PropertyGallery images={property.images || []} title={property.title} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Property Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Hosted by {property.users?.full_name}</span>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{property.max_guests} guests</span>
                    </div>
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 mr-1" />
                      <span>{property.bedrooms} bedrooms</span>
                    </div>
                    <div className="flex items-center">
                      <Bath className="h-4 w-4 mr-1" />
                      <span>{property.bathrooms} bathrooms</span>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{property.description}</p>
              </CardContent>
            </Card>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>What this place offers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {property.amenities.map((amenity: string) => {
                      const IconComponent = amenityIcons[amenity]
                      return (
                        <div key={amenity} className="flex items-center space-x-2">
                          {IconComponent ? (
                            <IconComponent className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <div className="w-5 h-5 bg-muted rounded-full" />
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
                <CardTitle>Where you'll be</CardTitle>
                <CardDescription>
                  {property.address}, {property.city}, {property.country}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PropertyMap
                  properties={[
                    {
                      id: property.id,
                      title: property.title,
                      city: property.city,
                      country: property.country,
                      latitude: property.latitude,
                      longitude: property.longitude,
                      price_per_night: property.price_per_night,
                      property_type: property.property_type,
                      max_guests: property.max_guests,
                      bedrooms: property.bedrooms,
                      bathrooms: property.bathrooms,
                      images: property.images,
                      avgRating: roundedRating,
                      reviewCount: ratings.length,
                    },
                  ]}
                  className="h-96"
                />
              </CardContent>
            </Card>

            {/* Reviews */}
            <ReviewsList reviews={property.reviews || []} avgRating={roundedRating} />
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <BookingCard
                propertyId={property.id}
                pricePerNight={property.price_per_night}
                maxGuests={property.max_guests}
                avgRating={roundedRating}
                reviewCount={ratings.length}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
