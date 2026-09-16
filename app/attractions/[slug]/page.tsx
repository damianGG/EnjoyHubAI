import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Heart,
  MapPin,
  Share2,
  ShieldCheck,
  Star,
  Store,
  Ticket,
  Users,
} from "lucide-react"

import AttractionGallery from "@/components/attraction-gallery"
import { AttractionDemandCard } from "@/components/attraction-demand-card"
import AttractionMap from "@/components/attraction-map"
import { BottomNav } from "@/components/bottom-nav"
import PropertyContactInfo from "@/components/property-contact-info"
import ReviewsList from "@/components/reviews-list"
import { MarketplaceCalendar } from "@/components/ticketing/marketplace-calendar"
import { TopNav } from "@/components/top-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  buildAttractionJsonLd,
  getAttractionAverageRating,
  getAttractionCanonicalPath,
  getAttractionCanonicalUrl,
  getAttractionMetaDescription,
  getAttractionSocialImages,
  getPublicAttractionSeoRecord,
  serializeJsonLd,
} from "@/lib/seo/attraction"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getMarketplaceTicketingVenue, listMarketplacePropertySessions } from "@/lib/ticketing/marketplace"
import { extractIdFromSlug } from "@/lib/utils"

export const revalidate = 120

interface AttractionPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ zainteresowanie?: string; blad_zainteresowania?: string }>
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function generateMetadata({ params }: Pick<AttractionPageProps, "params">): Promise<Metadata> {
  const { slug } = await params
  const attraction = await getPublicAttractionSeoRecord(extractIdFromSlug(slug))

  if (!attraction) {
    return {
      title: "Atrakcja",
      description: "Ta atrakcja nie jest obecnie dostępna w publicznym katalogu EnjoyHub.",
      robots: { index: false, follow: false },
    }
  }

  const canonicalUrl = getAttractionCanonicalUrl(attraction)
  const description = getAttractionMetaDescription(attraction)
  const pageTitle = `${attraction.title}${attraction.city ? ` – ${attraction.city}` : ""}`
  const socialImages = getAttractionSocialImages(attraction)

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: "EnjoyHub",
      url: canonicalUrl,
      title: pageTitle,
      description,
      images: socialImages.map((url) => ({
        url,
        alt: `${attraction.title}${attraction.city ? ` – ${attraction.city}` : ""}`,
      })),
    },
    twitter: {
      card: socialImages.length > 0 ? "summary_large_image" : "summary",
      title: pageTitle,
      description,
      ...(socialImages.length > 0 ? { images: [socialImages[0]] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  }
}

export default async function AttractionPage({ params, searchParams }: AttractionPageProps) {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold">Połącz Supabase, aby rozpocząć</h1>
      </div>
    )
  }

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const id = extractIdFromSlug(slug)
  const today = new Date()
  const sessionRangeEnd = new Date(today)
  sessionRangeEnd.setUTCDate(sessionRangeEnd.getUTCDate() + 90)

  const [attraction, ticketingVenue, marketplaceSessions] = await Promise.all([
    getPublicAttractionSeoRecord(id),
    getMarketplaceTicketingVenue(id),
    listMarketplacePropertySessions(id, isoDate(today), isoDate(sessionRangeEnd)),
  ])

  if (!attraction) notFound()

  const canonicalPath = getAttractionCanonicalPath(attraction)
  if (`/attractions/${slug}` !== canonicalPath) permanentRedirect(canonicalPath)

  const supabase = createClient()
  const { data: claimData } = await supabase.rpc("profile_claim_get", { p_attraction_id: id })
  const claimContext = claimData as { claimable?: boolean } | null
  const venueContact = attraction.venueContact
  const { ratingValue: roundedRating, reviewCount } = getAttractionAverageRating(attraction)
  const locationLabel = [attraction.address, attraction.city].filter(Boolean).join(", ")
  const livePrices = marketplaceSessions
    .map((session) => session.priceFrom)
    .filter((price) => Number.isFinite(price) && price >= 0)
  const priceFrom = livePrices.length > 0 ? Math.min(...livePrices) : null
  const nextSession = marketplaceSessions[0] ?? null
  const canonicalUrl = getAttractionCanonicalUrl(attraction)
  const bookingTarget = ticketingVenue
    ? `${canonicalUrl}#booking`
    : venueContact?.external_booking_url || null
  const jsonLd = buildAttractionJsonLd({
    attraction,
    priceFrom,
    hasAvailability: marketplaceSessions.length > 0,
    bookingUrl: bookingTarget,
  })

  const mapAttraction = {
    id: attraction.id,
    title: attraction.title,
    city: attraction.city,
    country: attraction.country || "Polska",
    latitude: attraction.latitude ?? undefined,
    longitude: attraction.longitude ?? undefined,
    priceFrom,
    property_type: attraction.property_type || "attraction",
    max_guests: attraction.max_guests || 0,
    images: attraction.images || [],
    avgRating: roundedRating,
    reviewCount,
    nextAvailableSlot: nextSession
      ? {
          date: nextSession.localDate,
          startTime: nextSession.localStartTime,
          availableCapacity: nextSession.availableCapacity,
        }
      : null,
  }

  return (
    <div className="min-h-screen bg-background pb-36 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="hidden md:block"><TopNav /></div>

      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pt-4 md:hidden">
        <Link href="/attractions" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur" aria-label="Powrót do mapy atrakcji">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="pointer-events-auto h-11 w-11 rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur" aria-label="Udostępnij"><Share2 className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="pointer-events-auto h-11 w-11 rounded-full bg-white/95 text-[#0b1220] shadow-lg backdrop-blur" aria-label="Dodaj do ulubionych"><Heart className="h-5 w-5" /></Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] md:px-4 md:pt-5">
        <div className="hidden items-center justify-between gap-5 pb-4 md:flex">
          <nav aria-label="Okruszki" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="shrink-0 hover:text-foreground">EnjoyHub</Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <Link href="/attractions" className="shrink-0 hover:text-foreground">Atrakcje</Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate text-foreground" aria-current="page">{attraction.title}</span>
          </nav>
          <div className="flex shrink-0 gap-2">
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
                      {roundedRating > 0 && (
                        <span className="flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-[#ff9f0a] text-[#ff9f0a]" />{roundedRating}<span className="font-normal text-muted-foreground">({reviewCount} opinii)</span></span>
                      )}
                      <a href="#location" className="flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"><MapPin className="h-4 w-4" />{locationLabel || attraction.city}</a>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1.5">{String(attraction.property_type || "atrakcja").replaceAll("_", " ")}</Badge>
                  {(attraction.max_guests || 0) > 0 && <Badge variant="outline" className="rounded-full px-3 py-1.5"><Users className="mr-1.5 h-3.5 w-3.5" />do {attraction.max_guests} osób</Badge>}
                  {ticketingVenue && <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800"><Ticket className="mr-1.5 h-3.5 w-3.5" />Rezerwacja online</Badge>}
                </div>
              </header>

              <section className="space-y-4 border-b pb-7">
                <h2 className="text-xl font-bold">O atrakcji</h2>
                <p className="whitespace-pre-line text-[15px] leading-7 text-muted-foreground sm:text-base">{attraction.description}</p>
              </section>

              <section className="grid grid-cols-3 gap-3 border-b pb-7">
                <div className="rounded-2xl bg-muted/60 p-3 text-center sm:p-4"><Users className="mx-auto mb-2 h-5 w-5 text-[#ff5a1f]" /><p className="text-xs font-medium sm:text-sm">Dla {attraction.max_guests || "grup"} osób</p></div>
                <div className="rounded-2xl bg-muted/60 p-3 text-center sm:p-4"><CalendarDays className="mx-auto mb-2 h-5 w-5 text-[#ff5a1f]" /><p className="text-xs font-medium sm:text-sm">Wybierz termin</p></div>
                <div className="rounded-2xl bg-muted/60 p-3 text-center sm:p-4"><ShieldCheck className="mx-auto mb-2 h-5 w-5 text-[#ff5a1f]" /><p className="text-xs font-medium sm:text-sm">Bezpieczna rezerwacja</p></div>
              </section>

              {(attraction.amenities?.length || 0) > 0 && (
                <section className="space-y-4 border-b pb-7">
                  <h2 className="text-xl font-bold">Na miejscu</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(attraction.amenities || []).slice(0, 9).map((amenity) => <div key={amenity} className="rounded-xl border px-3 py-3 text-sm">{amenity}</div>)}
                  </div>
                </section>
              )}
            </div>

            <aside id="booking" className="scroll-mt-24 lg:row-span-2">
              <div className="space-y-4 lg:sticky lg:top-5">
                {ticketingVenue ? (
                  <MarketplaceCalendar propertyId={attraction.id} />
                ) : (
                  <>
                    {claimContext?.claimable && (
                      <AttractionDemandCard
                        attractionId={attraction.id}
                        slug={slug}
                        success={query.zainteresowanie === "1"}
                        error={query.blad_zainteresowania === "1"}
                      />
                    )}
                    <PropertyContactInfo
                      phone={venueContact?.contact_phone || attraction.users?.phone || undefined}
                      email={venueContact?.contact_email || attraction.users?.email || undefined}
                      address={attraction.address || undefined}
                      city={attraction.city || undefined}
                      country={attraction.country || undefined}
                      openingHours={attraction.opening_hours || undefined}
                      websiteUrl={venueContact?.website_url || undefined}
                      bookingUrl={venueContact?.external_booking_url || undefined}
                    />
                  </>
                )}
              </div>
            </aside>

            <div className="space-y-8">
              <section id="location" className="scroll-mt-24 space-y-4 border-t pt-7 lg:border-t-0 lg:pt-0">
                <div><h2 className="text-xl font-bold">Gdzie to jest</h2><p className="mt-1 text-sm text-muted-foreground">{[attraction.address, attraction.city, attraction.country].filter(Boolean).join(", ")}</p></div>
                <div className="h-72 overflow-hidden rounded-3xl sm:h-96"><AttractionMap attractions={[mapAttraction]} className="h-full border-0 shadow-none" /></div>
              </section>

              <ReviewsList reviews={attraction.reviews || []} avgRating={roundedRating} />

              {attraction.users?.full_name && (
                <Card className="border-0 bg-muted/40 shadow-none"><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organizator</p><p className="mt-1 font-semibold">{attraction.users.full_name}</p></CardContent></Card>
              )}

              {claimContext?.claimable && (
                <Card className="border-dashed bg-muted/20 shadow-none">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4" />Zarządzasz tym miejscem?</p>
                      <p className="mt-1 text-sm text-muted-foreground">Przejmij profil, aby edytować zdjęcia, ofertę, ceny i później uruchomić sprzedaż w EnjoyHub.</p>
                    </div>
                    <Button asChild variant="outline"><Link href={`/przejmij-profil/${attraction.id}`}>Przejmij profil</Link></Button>
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
              <p className="text-xs text-muted-foreground">{priceFrom !== null ? "Cena od" : "Cena"}</p>
              <p className="text-lg font-bold">{priceFrom !== null ? `${Math.round(priceFrom)} zł` : "Sprawdź termin"}</p>
            </div>
            <Button asChild className="h-12 flex-1 rounded-xl bg-[#ff5a1f] text-base font-semibold text-white hover:bg-[#e94f18]"><a href="#booking">Sprawdź terminy</a></Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
