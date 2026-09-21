import "server-only"

import { createClient } from "@supabase/supabase-js"
import { cache } from "react"

import { getPublicSiteUrl } from "@/lib/site-url"
import { publicAttractionPath } from "@/lib/marketplace/attraction-path"

export type PublicAttractionReview = {
  id: string
  rating: number
  comment: string
  created_at: string
  author_name?: string | null
  verified_visit?: boolean | null
  users?: { full_name?: string | null } | null
}

export type PublicAttractionSeoRecord = {
  id: string
  title: string
  category?: { slug: string } | null
  subcategory?: { slug: string } | null
  description?: string | null
  address?: string | null
  city: string
  region?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  property_type?: string | null
  max_guests?: number | null
  images?: string[] | null
  amenities?: string[] | null
  opening_hours?: string | null
  venue_id?: string | null
  updated_at?: string | null
  users?: {
    full_name?: string | null
    avatar_url?: string | null
    created_at?: string | null
    email?: string | null
    phone?: string | null
  } | null
  reviews?: PublicAttractionReview[] | null
  venueContact?: {
    contact_phone?: string | null
    contact_email?: string | null
    website_url?: string | null
    external_booking_url?: string | null
  } | null
}

function createPublicSeoClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) return null

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const getPublicAttractionSeoRecord = cache(async (id: string): Promise<PublicAttractionSeoRecord | null> => {
  const supabase = createPublicSeoClient()
  if (!supabase || !id) return null

  const { data: attraction, error } = await supabase
    .from("properties")
    .select(`
      id,
      title,
      category:categories(slug),
      subcategory:subcategories(slug),
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      property_type,
      max_guests,
      images,
      amenities,
      opening_hours,
      venue_id,
      updated_at,
      users!properties_host_id_fkey (full_name, avatar_url, created_at, email, phone),
      reviews (
        id,
        rating,
        comment,
        created_at,
        author_name,
        verified_visit,
        users!reviews_guest_id_fkey (full_name)
      )
    `)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    console.error("[seo:attraction] Failed to load public attraction", error)
    return null
  }
  if (!attraction) return null

  let venueContact: PublicAttractionSeoRecord["venueContact"] = null
  if (attraction.venue_id) {
    const { data, error: venueError } = await supabase
      .from("venues")
      .select("contact_phone,contact_email,website_url,external_booking_url")
      .eq("id", attraction.venue_id)
      .maybeSingle()

    if (venueError) {
      console.error("[seo:attraction] Failed to load venue contact", venueError)
    } else {
      venueContact = data
    }
  }

  return {
    ...({ ...attraction,
      category: Array.isArray(attraction.category) ? attraction.category[0] ?? null : attraction.category,
      subcategory: Array.isArray(attraction.subcategory) ? attraction.subcategory[0] ?? null : attraction.subcategory,
    } as PublicAttractionSeoRecord),
    venueContact,
  }
})

export function getAttractionCanonicalPath(attraction: Pick<PublicAttractionSeoRecord, "id" | "title" | "city" | "property_type">) {
  return publicAttractionPath(attraction)
}

export function getAttractionCanonicalUrl(attraction: Pick<PublicAttractionSeoRecord, "id" | "title" | "city" | "property_type">) {
  return `${getPublicSiteUrl()}${getAttractionCanonicalPath(attraction)}`
}

export function getAttractionAverageRating(attraction: Pick<PublicAttractionSeoRecord, "reviews">) {
  const ratings = (attraction.reviews ?? [])
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5)

  if (ratings.length === 0) return { ratingValue: 0, reviewCount: 0 }

  const value = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
  return {
    ratingValue: Math.round(value * 10) / 10,
    reviewCount: ratings.length,
  }
}

function compactText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  const candidate = value.slice(0, maxLength + 1)
  const lastSpace = candidate.lastIndexOf(" ")
  return `${candidate.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength).trim()}…`
}

function publicHttpUrl(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

export function getAttractionMetaDescription(attraction: Pick<PublicAttractionSeoRecord, "title" | "city" | "description">) {
  const prefix = `${attraction.title}${attraction.city ? ` w ${attraction.city}` : ""}. `
  const description = compactText(attraction.description)

  if (description) return truncateAtWord(`${prefix}${description}`, 160)

  return truncateAtWord(
    `${prefix}Sprawdź informacje, lokalizację, opinie, dostępne terminy i możliwość rezerwacji online w EnjoyHub.`,
    160,
  )
}

export function getAttractionSocialImages(attraction: Pick<PublicAttractionSeoRecord, "images">) {
  return (attraction.images ?? [])
    .map((image) => publicHttpUrl(image))
    .filter((image): image is string => Boolean(image))
    .slice(0, 4)
}

function validCoordinate(value: unknown, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

function visibleReviews(attraction: PublicAttractionSeoRecord) {
  return (attraction.reviews ?? [])
    .filter((review) => Number(review.rating) >= 1 && Number(review.rating) <= 5)
    .filter((review) => compactText(review.comment).length > 0)
    .slice(0, 6)
}

export function buildAttractionJsonLd({
  attraction,
  priceFrom,
  hasAvailability,
  bookingUrl,
}: {
  attraction: PublicAttractionSeoRecord
  priceFrom: number | null
  hasAvailability: boolean
  bookingUrl?: string | null
}) {
  const siteUrl = getPublicSiteUrl()
  const canonicalUrl = getAttractionCanonicalUrl(attraction)
  const description = getAttractionMetaDescription(attraction)
  const { ratingValue, reviewCount } = getAttractionAverageRating(attraction)
  const latitude = validCoordinate(attraction.latitude, -90, 90)
  const longitude = validCoordinate(attraction.longitude, -180, 180)
  const phone = attraction.venueContact?.contact_phone || attraction.users?.phone || undefined
  const email = attraction.venueContact?.contact_email || attraction.users?.email || undefined
  const operatorWebsite = publicHttpUrl(attraction.venueContact?.website_url)
  const safeBookingUrl = publicHttpUrl(bookingUrl)
  const reviews = visibleReviews(attraction)
  const images = getAttractionSocialImages(attraction)

  const place: Record<string, unknown> = {
    "@type": ["TouristAttraction", "LocalBusiness"],
    "@id": `${canonicalUrl}#attraction`,
    name: attraction.title,
    description,
    url: canonicalUrl,
    identifier: attraction.id,
    ...(images.length > 0 ? { image: images } : {}),
    address: {
      "@type": "PostalAddress",
      ...(attraction.address ? { streetAddress: attraction.address } : {}),
      ...(attraction.city ? { addressLocality: attraction.city } : {}),
      ...(attraction.region ? { addressRegion: attraction.region } : {}),
      ...(attraction.country ? { addressCountry: attraction.country } : {}),
    },
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email } : {}),
    ...(operatorWebsite ? { sameAs: [operatorWebsite] } : {}),
  }

  if (latitude !== null && longitude !== null) {
    place.geo = {
      "@type": "GeoCoordinates",
      latitude,
      longitude,
    }
  }

  if (reviewCount > 0) {
    place.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  if (reviews.length > 0) {
    place.review = reviews.map((review) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: Number(review.rating),
        bestRating: 5,
        worstRating: 1,
      },
      author: {
        "@type": "Person",
        name: review.author_name || review.users?.full_name || "Gość EnjoyHub",
      },
      datePublished: review.created_at,
      reviewBody: compactText(review.comment),
    }))
  }

  if (priceFrom !== null && Number.isFinite(priceFrom) && priceFrom >= 0) {
    place.makesOffer = {
      "@type": "Offer",
      url: safeBookingUrl || `${canonicalUrl}#booking`,
      priceCurrency: "PLN",
      price: Math.round(priceFrom * 100) / 100,
      availability: hasAvailability ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    }
  }

  const reservationTarget = safeBookingUrl || (priceFrom !== null ? `${canonicalUrl}#booking` : null)
  if (reservationTarget) {
    place.potentialAction = {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: reservationTarget,
      },
      result: {
        "@type": "Reservation",
        name: `Rezerwacja: ${attraction.title}`,
      },
    }
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: `${attraction.title}${attraction.city ? ` – ${attraction.city}` : ""}`,
        description,
        inLanguage: "pl-PL",
        mainEntity: { "@id": `${canonicalUrl}#attraction` },
        breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
      },
      place,
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "EnjoyHub",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Atrakcje",
            item: `${siteUrl}/attractions`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: attraction.title,
            item: canonicalUrl,
          },
        ],
      },
    ],
  }
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}
