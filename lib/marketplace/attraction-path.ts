import { generatePublicAttractionSlug } from "@/lib/utils"

export type PublicAttractionPathInput = {
  id: string
  title: string
  city: string
  property_type?: string | null
}

// Canonical public route for a single attraction. Collection/local SEO pages remain under /atrakcje.
export function publicAttractionPath(attraction: PublicAttractionPathInput) {
  return `/atrakcja/${generatePublicAttractionSlug(attraction)}`
}
