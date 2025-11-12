import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import AttractionGallery from "@/components/attraction-gallery"
import AttractionHeader from "@/components/attraction-header"
import AttractionDescription from "@/components/attraction-description"
import WorthKnowing from "@/components/worth-knowing"
import HostAttractions from "@/components/host-attractions"
import AttractionMap from "@/components/attraction-map"
import AttractionReviews from "@/components/attraction-reviews"
import NearbyAttractions from "@/components/nearby-attractions"

interface AttractionPageProps {
  params: Promise<{
    city: string
    activity: string
    slug: string
    id: string
  }>
}

export async function generateMetadata({ params }: AttractionPageProps): Promise<Metadata> {
  const resolvedParams = await params
  
  if (!isSupabaseConfigured) {
    return {
      title: "Attraction Details",
      description: "View attraction details",
    }
  }

  const supabase = createClient()
  const { data: property } = await supabase
    .from("properties")
    .select("title, description, images, city, country")
    .eq("id", resolvedParams.id)
    .eq("is_active", true)
    .single()

  if (!property) {
    return {
      title: "Attraction Not Found",
    }
  }

  const canonicalUrl = `/${resolvedParams.city}-${resolvedParams.activity}-${resolvedParams.slug}-${resolvedParams.id}`
  
  return {
    title: `${property.title} - ${property.city}, ${property.country}`,
    description: property.description || `Visit ${property.title} in ${property.city}`,
    openGraph: {
      title: property.title,
      description: property.description || `Visit ${property.title} in ${property.city}`,
      images: property.images?.[0] ? [property.images[0]] : [],
      url: canonicalUrl,
      type: "website",
    },
    alternates: {
      canonical: canonicalUrl,
    },
  }
}

export default async function AttractionPage({ params }: AttractionPageProps) {
  const resolvedParams = await params
  
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()

  // Fetch attraction details with all related data
  const { data: property } = await supabase
    .from("properties")
    .select(`
      *,
      users!properties_host_id_fkey (
        id,
        full_name,
        avatar_url,
        city,
        country,
        bio
      ),
      categories (
        id,
        name,
        slug
      ),
      reviews (
        id,
        rating,
        comment,
        created_at,
        users!reviews_guest_id_fkey (
          full_name,
          avatar_url,
          city
        )
      ),
      object_field_values (
        id,
        value,
        file_url,
        category_fields (
          field_name,
          field_label,
          field_type
        )
      )
    `)
    .eq("id", resolvedParams.id)
    .eq("is_active", true)
    .single()

  if (!property) {
    notFound()
  }

  // Calculate average rating
  const ratings = property.reviews?.map((r: any) => r.rating) || []
  const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0
  const roundedRating = Math.round(avgRating * 10) / 10

  // Fetch other attractions by the same host (exclude current)
  const { data: hostAttractions } = await supabase
    .from("properties")
    .select("id, title, images, city, price_per_night, latitude, longitude")
    .eq("host_id", property.host_id)
    .eq("is_active", true)
    .neq("id", resolvedParams.id)
    .limit(6)

  // Fetch nearby attractions in the same city
  const { data: nearbyAttractions } = await supabase
    .from("properties")
    .select(`
      id,
      title,
      images,
      city,
      price_per_night,
      latitude,
      longitude,
      reviews (rating)
    `)
    .eq("city", property.city)
    .eq("is_active", true)
    .neq("id", resolvedParams.id)
    .limit(8)

  // Transform nearby attractions to include rating
  const nearbyWithRatings = nearbyAttractions?.map((attr: any) => {
    const attrRatings = attr.reviews?.map((r: any) => r.rating) || []
    const attrAvg = attrRatings.length > 0 
      ? attrRatings.reduce((a: number, b: number) => a + b, 0) / attrRatings.length 
      : 0
    return {
      ...attr,
      avgRating: Math.round(attrAvg * 10) / 10,
      reviewCount: attrRatings.length,
    }
  }) || []

  return (
    <div className="min-h-screen bg-background">
      {/* Gallery Section */}
      <AttractionGallery 
        images={property.images || []} 
        title={property.title}
        propertyId={property.id}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Header Info */}
        <AttractionHeader
          title={property.title}
          city={property.city}
          country={property.country}
          host={property.users}
          avgRating={roundedRating}
          reviewsCount={ratings.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Short/Full Description */}
            <AttractionDescription
              shortDescription={property.description?.substring(0, 200) || ""}
              fullDescription={property.description || ""}
            />

            {/* Worth Knowing Section */}
            <WorthKnowing fieldValues={property.object_field_values || []} />

            {/* Other Attractions by Host */}
            {hostAttractions && hostAttractions.length > 0 && (
              <HostAttractions
                attractions={hostAttractions}
                hostName={property.users?.full_name || "this host"}
              />
            )}

            {/* Map & Share */}
            <AttractionMap
              latitude={property.latitude}
              longitude={property.longitude}
              address={property.address}
              city={property.city}
              country={property.country}
              title={property.title}
            />

            {/* Reviews Section */}
            <AttractionReviews
              reviews={property.reviews || []}
              avgRating={roundedRating}
              reviewsCount={ratings.length}
            />

            {/* More Attractions Nearby */}
            {nearbyWithRatings.length > 0 && (
              <NearbyAttractions attractions={nearbyWithRatings} city={property.city} />
            )}
          </div>

          {/* Sidebar - Could add booking card or other info here */}
          <div className="lg:col-span-1">
            {/* Placeholder for future booking/contact card */}
          </div>
        </div>
      </div>
    </div>
  )
}
