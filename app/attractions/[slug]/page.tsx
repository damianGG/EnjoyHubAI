import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  MapPin,
  Share2,
  ShieldCheck,
  Star,
  Ticket,
  Users,
} from "lucide-react"

import AttractionGallery from "@/components/attraction-gallery"
import AttractionMap from "@/components/attraction-map"
import { BottomNav } from "@/components/bottom-nav"
import PropertyContactInfo from "@/components/property-contact-info"
import ReviewsList from "@/components/reviews-list"
import { MarketplaceCalendar } from "@/components/ticketing/marketplace-calendar"
import { TopNav } from "@/components/top-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getMarketplaceTicketingVenue } from "@/lib/ticketing/marketplace"
import { extractIdFromSlug } from "@/lib/utils"

export const revalidate = 120

interface AttractionPageProps {
  params: Promise<{ slug: string }>
}

export default async function AttractionPage({ params }: AttractionPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold">Połącz Supabase, aby rozpocząć</h1>
      </div>
    )
  }

  const supabase = createClient()
  const { slug } = await params
  const id = extractIdFromSlug(slug)

  const [attractionResult, ticketingVenue] = await Promise.all([
    supabase
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
      .single(),
    getMarketplaceTicketingVenue(id),
  ])

  const attraction = attractionResult.data
  if (!attraction) notFound()

  const ratings = attraction.reviews?.map((review: any) => review.rating) || []
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length
    : 0
  const roundedRating = Math.round(avgRating * 10) / 10
  const locationLabel = [attraction.address, attraction.city].filter(Boolean).join(", ")

  const mapAttraction = {
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
  }

  return (
    <div className="min-h-screen bg-background pb-36 md:pb-0">
      <div className="hidden md:block">
        <TopNav />
      </div>

      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pt-4 md:hidden">
        <Link
          href="/attractions"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur"
          aria-label="Powrót do mapy atrakcji"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="pointer-events-auto h-11 w-11 rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur" aria-label="Udostępnij">
            <Share2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="pointer-events-auto h-11 w-11 rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur" aria-label="Dodaj do ulubionych">
            <Heart className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] md:px-4 md:pt-6">
        <div className="hidden items-center justify-between pb-4 md:flex">
          <Link href="/attractions" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Powrót do mapy
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Heart className="mr-2 h-4 w-4" />Zapisz</Button>
            <Button variant="outline" size="sm"><Share2 className="mr-2 h-4 w-4" />Udostępnij</Button>
          </div>
        </div>

        <AttractionGallery images={attraction.images || []} title={attraction.title} />

        <div className="relative z-10 -mt-5 rounded-t-[28px] bg-background px-4 pt-6 md:mt-0 md:rounded-none md:px-0 md:pt-7">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            <div className="space-y-7">
              <header className="space-y-3 border-b pb-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{attraction.title}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                      {avgRating > 0 && (
                        <span className="flex items-center gap-1 font-semibold">
                          <Star className="h-4 w-4 fill-[#ff9f0a] text-[#ff9f0a]" />
                          {roundedRating}
                          <span className="font-normal text-muted-foreground">({ratings.length} opinii)</span>
                        </span>
                      )}
                      <a href="#location" className="flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline">
                        <MapPin className="h-4 w-4" />{locationLabel || attraction.city}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1.5">{String(attraction.property_type).replaceAll("_", " ")}</Badge>
                  {attraction.max_guests > 0 && (
                    <Badge variant="outline" className="rounded-full px-3 py-1.5"><Users className="mr-1.5 h-3.5 w-3.5" />do {attraction.max_guests} osób</Badge>
                  )}
                  {ticketingVenue && (
                    <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                      <Ticket className="mr-1.5 h-3.5 w-3.5" />Rezerwacja online
                    </Badge>
                  )}
                </div>
              </header>

              <section className="space-y-4 border-b pb-7">
                <h2 className="text-xl font-bold">O atrakcji</h2>
                <p className="whitespace-pre-line text-[15px] leading-7 text-muted-foreground sm:text-base">{attraction.description}</p>
              </section>

              <section className="grid grid-cols-3 gap-3 border-b pb-7">
                <div className="rounded-2xl bg-muted/60 p-3 text-center sm:p-4">
                  <Users className="mx-auto mb-2 h-5 w-5 text-[#ff5a1f]" />
                  <p className="text-xs font-medium sm:text-sm">Dla {attraction.max_guests || "grup"} osób</p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-3 text-center sm:p-4">
                  <CalendarDays className="mx-auto mb-2 h-5 w-5 text-[#ff5a1f]" />
                  <p className="text-xs font-medium sm:text-sm">Wybierz termin</p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-3 text-center sm:p-4">
                  <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-[#ff5a1f]" />
                  <p className="text-xs font-medium sm:text-sm">Bezpieczna rezerwacja</p>
                </div>
              </section>

              {attraction.amenities?.length > 0 && (
                <section className="space-y-4 border-b pb-7">
                  <h2 className="text-xl font-bold">Na miejscu</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {attraction.amenities.slice(0, 9).map((amenity: string) => (
                      <div key={amenity} className="rounded-xl border px-3 py-3 text-sm">{amenity}</div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside id="booking" className="scroll-mt-24 lg:row-span-2">
              <div className="lg:sticky lg:top-5">
                {ticketingVenue ? (
                  <MarketplaceCalendar propertyId={attraction.id} />
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
            </aside>

            <div className="space-y-8">
              <section id="location" className="scroll-mt-24 space-y-4 border-t pt-7 lg:border-t-0 lg:pt-0">
                <div>
                  <h2 className="text-xl font-bold">Gdzie to jest</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{[attraction.address, attraction.city, attraction.country].filter(Boolean).join(", ")}</p>
                </div>
                <div className="h-72 overflow-hidden rounded-3xl sm:h-96">
                  <AttractionMap attractions={[mapAttraction]} className="h-full border-0 shadow-none" />
                </div>
              </section>

              <ReviewsList reviews={attraction.reviews || []} avgRating={roundedRating} />

              {attraction.users?.full_name && (
                <Card className="border-0 bg-muted/40 shadow-none">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organizator</p>
                    <p className="mt-1 font-semibold">{attraction.users.full_name}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {ticketingVenue && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white/95 p-3 shadow-[0_-8px_30px_rgba(11,18,32,0.12)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Cena od</p>
              <p className="text-lg font-bold">{Math.round(attraction.price_per_night)} zł</p>
            </div>
            <Button asChild className="h-12 flex-1 rounded-xl bg-[#ff5a1f] text-base font-semibold text-white hover:bg-[#e94f18]">
              <a href="#booking">Sprawdź terminy</a>
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
