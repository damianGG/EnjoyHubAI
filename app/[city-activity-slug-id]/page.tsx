import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AttractionGallery } from "@/components/attraction-gallery"
import { WorthKnowing } from "@/components/worth-knowing"
import { HostAttractions } from "@/components/host-attractions"
import { NearbyAttractions } from "@/components/nearby-attractions"
import { AttractionReviews } from "@/components/attraction-reviews"
import { ExpandableDescription } from "@/components/expandable-description"
import { ShareButton } from "@/components/share-button"
import PropertyMap from "@/components/property-map"
import { Metadata } from "next"

interface AttractionPageProps {
  params: {
    "city-activity-slug-id": string
  }
}

// Helper function to parse the dynamic route
function parseAttractionRoute(route: string) {
  // Expected format: {city}-{activity}-{slug}-{id}
  // Split from the end to get the ID first
  const parts = route.split("-")
  const id = parts[parts.length - 1]
  
  // For simplicity, we'll just use the ID to fetch the attraction
  return { id }
}

export async function generateMetadata({ params }: AttractionPageProps): Promise<Metadata> {
  const { id } = parseAttractionRoute(params["city-activity-slug-id"])
  
  if (!isSupabaseConfigured) {
    return {
      title: "Attraction Details",
    }
  }

  const supabase = createClient()
  const { data: attraction } = await supabase
    .from("properties")
    .select("title, description, city, country, images")
    .eq("id", id)
    .single()

  if (!attraction) {
    return {
      title: "Attraction Not Found",
    }
  }

  return {
    title: `${attraction.title} - ${attraction.city}, ${attraction.country}`,
    description: attraction.description || `Odkryj ${attraction.title} w ${attraction.city}`,
    openGraph: {
      title: attraction.title,
      description: attraction.description || "",
      images: attraction.images?.[0] ? [attraction.images[0]] : [],
      type: "website",
    },
  }
}

export default async function AttractionPage({ params }: AttractionPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const { id } = parseAttractionRoute(params["city-activity-slug-id"])
  const supabase = createClient()

  // Fetch attraction details with host info and reviews
  const { data: attraction } = await supabase
    .from("properties")
    .select(`
      *,
      users!properties_host_id_fkey (
        id,
        full_name,
        avatar_url,
        bio,
        created_at
      ),
      reviews (
        id,
        rating,
        comment,
        created_at,
        users!reviews_guest_id_fkey (
          full_name,
          avatar_url
        )
      ),
      categories (
        name,
        slug
      )
    `)
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if (!attraction) {
    notFound()
  }

  // Calculate average rating
  const ratings = attraction.reviews?.map((r: any) => r.rating) || []
  const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0
  const roundedRating = Math.round(avgRating * 10) / 10

  // Fetch other attractions by the same host
  const { data: hostAttractions } = await supabase
    .from("properties")
    .select(`
      id,
      title,
      city,
      country,
      images,
      price_per_night,
      max_guests,
      categories (name, slug)
    `)
    .eq("host_id", attraction.host_id)
    .eq("is_active", true)
    .neq("id", id)
    .limit(6)

  // Fetch nearby attractions (same city, different properties)
  const { data: nearbyAttractions } = await supabase
    .from("properties")
    .select(`
      id,
      title,
      city,
      country,
      images,
      price_per_night,
      max_guests,
      categories (name, slug)
    `)
    .eq("city", attraction.city)
    .eq("is_active", true)
    .neq("id", id)
    .limit(8)

  // Format host attractions for the component
  const formattedHostAttractions = hostAttractions?.map((attr: any) => ({
    id: attr.id,
    title: attr.title,
    city: attr.city,
    country: attr.country,
    images: attr.images || [],
    pricePerNight: attr.price_per_night,
    maxGuests: attr.max_guests,
    categoryName: attr.categories?.name,
    activitySlug: attr.categories?.slug,
  })) || []

  // Format nearby attractions for the component
  const formattedNearbyAttractions = nearbyAttractions?.map((attr: any) => ({
    id: attr.id,
    title: attr.title,
    city: attr.city,
    country: attr.country,
    images: attr.images || [],
    pricePerNight: attr.price_per_night,
    maxGuests: attr.max_guests,
    categoryName: attr.categories?.name,
    activitySlug: attr.categories?.slug,
  })) || []

  // Create "Worth Knowing" items from property data
  const worthKnowingItems = [
    {
      icon: "user" as const,
      title: "Minimalna liczba gości",
      description: `Ta atrakcja jest dostępna dla maksymalnie ${attraction.max_guests} osób.`,
    },
    {
      icon: "activity" as const,
      title: "Poziom aktywności",
      description: "Średni poziom aktywności fizycznej. Odpowiednie dla większości osób.",
    },
    {
      icon: "backpack" as const,
      title: "Co zabrać ze sobą",
      description: "Wygodne obuwie, wodę, aparat fotograficzny.",
    },
    {
      icon: "wheelchair" as const,
      title: "Dostępność",
      description: "Obiekt częściowo dostępny dla osób z niepełnosprawnościami.",
      link: {
        text: "Skontaktuj się z gospodarzem",
        action: "#contact",
      },
    },
    {
      icon: "calendar" as const,
      title: "Polityka anulowania",
      description: "Bezpłatne anulowanie do 24 godzin przed rezerwacją.",
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Gallery */}
        <div className="mb-6">
          <AttractionGallery images={attraction.images || []} title={attraction.title} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">{attraction.title}</h1>
              
              {/* Rating and Location */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{roundedRating}</span>
                    <span className="text-muted-foreground">({ratings.length} recenzji)</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{attraction.city}, {attraction.country}</span>
                </div>
              </div>

              {/* Host Info */}
              <div className="flex items-center gap-3 pb-6 border-b">
                <Avatar className="h-12 w-12">
                  {attraction.users?.avatar_url && (
                    <AvatarImage src={attraction.users.avatar_url} alt={attraction.users.full_name} />
                  )}
                  <AvatarFallback>
                    {attraction.users?.full_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">Gospodarz: {attraction.users?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {attraction.city}, {attraction.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <ExpandableDescription description={attraction.description || "Brak opisu"} />

            {/* Worth Knowing */}
            <WorthKnowing items={worthKnowingItems} />

            {/* Host's Other Attractions */}
            {formattedHostAttractions.length > 0 && (
              <HostAttractions
                attractions={formattedHostAttractions}
                hostName={attraction.users?.full_name || ""}
                hostId={attraction.host_id}
              />
            )}

            {/* Map */}
            <Card>
              <CardHeader>
                <CardTitle>Lokalizacja</CardTitle>
                <CardDescription>{attraction.address}</CardDescription>
              </CardHeader>
              <CardContent>
                <PropertyMap
                  properties={[
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
                  className="h-96"
                />
                <div className="mt-4">
                  <ShareButton
                    title={attraction.title}
                    description={attraction.description || ""}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Reviews */}
            <AttractionReviews
              reviews={attraction.reviews || []}
              avgRating={roundedRating}
              totalReviews={ratings.length}
            />

            {/* Nearby Attractions */}
            {formattedNearbyAttractions.length > 0 && (
              <NearbyAttractions
                attractions={formattedNearbyAttractions}
                currentCity={attraction.city}
              />
            )}
          </div>

          {/* Right Column - Booking/Info Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">
                    {attraction.price_per_night} zł
                    <span className="text-base font-normal text-muted-foreground"> / noc</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Typ</span>
                      <span className="font-medium">{attraction.property_type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Maksymalna liczba gości</span>
                      <span className="font-medium">{attraction.max_guests}</span>
                    </div>
                    {attraction.bedrooms > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sypialnie</span>
                        <span className="font-medium">{attraction.bedrooms}</span>
                      </div>
                    )}
                    {attraction.bathrooms > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Łazienki</span>
                        <span className="font-medium">{attraction.bathrooms}</span>
                      </div>
                    )}
                  </div>
                  <Button className="w-full" size="lg">
                    Zarezerwuj teraz
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Nie zostaniesz obciążony w tej chwili
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
