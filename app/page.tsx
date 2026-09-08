import { HomeDiscovery } from "@/components/home-discovery"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"

export const revalidate = 60

type Attraction = {
  id: string
  title: string
  city: string
  country: string
  region?: string
  latitude?: number
  longitude?: number
  price_per_night: number
  property_type: string
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
  max_guests: number
  bedrooms: number
  bathrooms: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
  amenities?: string[]
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function getAttractions(): Promise<Attraction[]> {
  if (!isSupabaseConfigured) return []

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("properties")
      .select(`
        *,
        categories (
          slug,
          icon,
          image_url
        ),
        subcategories (
          slug,
          icon,
          image_url
        )
      `)
      .eq("is_active", true)
      .limit(120)

    if (error || !data) {
      console.error("[home] Failed to load attractions", error)
      return []
    }

    return data.map((row: any) => {
      const category = firstRelation(row.categories)
      const subcategory = firstRelation(row.subcategories)

      return {
        ...row,
        category_slug: category?.slug ?? null,
        category_icon: category?.icon ?? null,
        category_image_url: category?.image_url ?? null,
        subcategory_slug: subcategory?.slug ?? null,
        subcategory_icon: subcategory?.icon ?? null,
        subcategory_image_url: subcategory?.image_url ?? null,
      } as Attraction
    })
  } catch (error) {
    console.error("[home] Unexpected attractions error", error)
    return []
  }
}

export default async function Home() {
  const attractions = await getAttractions()
  return <HomeDiscovery attractions={attractions} />
}
