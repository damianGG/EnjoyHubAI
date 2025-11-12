// Type definitions for attraction detail page

export interface AttractionHost {
  id: string
  full_name: string
  avatar_url?: string
  city?: string
  country?: string
  bio?: string
}

export interface AttractionReview {
  id: string
  rating: number
  comment: string
  created_at: string
  users: {
    full_name: string
    avatar_url?: string
    city?: string
  } | null
}

export interface CategoryField {
  field_name: string
  field_label: string
  field_type: string
}

export interface FieldValue {
  id: string
  value?: string
  file_url?: string
  category_fields: CategoryField | null
}

export interface AttractionCategory {
  id: string
  name: string
  slug: string
}

export interface Attraction {
  id: string
  host_id: string
  title: string
  description?: string
  address: string
  city: string
  country: string
  latitude?: number
  longitude?: number
  price_per_night: number
  images?: string[]
  is_active: boolean
  users?: AttractionHost | null
  categories?: AttractionCategory | null
  reviews?: AttractionReview[]
  object_field_values?: FieldValue[]
}

export interface RelatedAttraction {
  id: string
  title: string
  images?: string[]
  city: string
  price_per_night: number
  latitude?: number
  longitude?: number
  avgRating?: number
  reviewCount?: number
}
