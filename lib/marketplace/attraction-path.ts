import { generateAttractionSlug } from "@/lib/utils"

// Shared by map cards and the detail page's canonical redirect.
export function publicAttractionPath(attraction: {id:string;title:string;city:string;property_type?:string|null}) {
  return `/attractions/${generateAttractionSlug({id:attraction.id,title:attraction.title,city:attraction.city,category:attraction.property_type ?? null})}`
}
