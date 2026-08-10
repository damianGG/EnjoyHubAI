// TypeScript interfaces for Attraction page

export interface Organizer {
  name: string
  image?: string
  description: string
  phone?: string
  email?: string
}

export interface Review {
  id: string
  userName: string
  rating: number
  comment: string
  date: string
  userAvatar?: string
}

export interface NearbyAttraction {
  id: string
  name: string
  image: string
  distance: string
  category: string
  priceFrom?: number
  rating?: number
}

export interface Attraction {
  id: string
  title: string
  city: string
  region: string
  shortDescription?: string
  category: string
  description: string
  openingHours: string
  address: string
  mapLink?: string
  priceFrom?: number
  priceTo?: number
  priceUnit?: string
  duration?: string
  ageLimit?: string
  amenities: string[]
  tips?: string[]
  howItWorks?: string
  images: string[]
  videoUrl?: string
  organizer: Organizer
  reviews: Review[]
  nearbyAttractions?: NearbyAttraction[]
}
