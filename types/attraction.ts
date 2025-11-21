// TypeScript interfaces for Attraction Page

export interface Organizer {
  name: string
  image?: string
  description: string
  phone: string
  email: string
}

export interface Review {
  id: string
  userName: string
  userAvatar?: string
  rating: number
  comment: string
  date: string
}

export interface NearbyAttraction {
  id: string
  title: string
  image: string
  distance: string
  category: string
  priceFrom: number
}

export interface Attraction {
  id: string
  title: string
  city: string
  region: string
  shortDescription?: string
  category: string
  description: string
  howItWorks?: string
  images: string[]
  openingHours: string
  address: string
  mapLink?: string
  priceFrom: number
  priceTo: number
  priceUnit: string
  duration?: string
  ageLimit?: string
  amenities: string[]
  tips?: string[]
  organizer: Organizer
  reviews: Review[]
  nearbyAttractions?: NearbyAttraction[]
}
