# AttractionPage Component

A comprehensive, responsive component for displaying entertainment venue details in the EnjoyHub application. Inspired by Airbnb and Booking.com design patterns.

## Overview

The AttractionPage component displays detailed information about entertainment venues such as paintball arenas, go-kart tracks, escape rooms, playgrounds, rope parks, and other recreational facilities.

## Features

### 📸 Image Gallery
- **Desktop**: Grid layout with 1 large image (2x2) and 4 smaller images
- **Mobile**: Horizontal scroll with snap-to-image
- **Fullscreen Modal**: Click any image to open fullscreen view with navigation
- **Thumbnail Strip**: Quick navigation in modal view
- **Image Counter**: Shows current position (e.g., "5 / 6")

### ℹ️ Attraction Details
- Category badge
- Opening hours
- Full address with map link
- Price range with currency
- Activity duration
- Age requirements
- Amenities grid with checkmarks
- Tips and recommendations

### ⭐ Reviews System
- Average rating display
- Individual review cards with star ratings (1-5)
- User avatars and names
- Review dates
- Review submission form (frontend only)
- Interactive star rating input

### 🏢 Organizer Information
- Profile display with avatar
- Organization description
- Contact buttons (phone, email)

### 📍 Nearby Attractions
- Grid of similar venues
- Cards with images and ratings
- Distance information
- Category badges
- Price display

### 💳 Booking Section
- Price summary
- "Book Now" CTA button
- Cancellation policy notice

## Component Structure

```
components/
├── attraction-page.tsx              # Main component
└── attraction/
    ├── image-gallery.tsx           # Gallery with modal
    ├── attraction-details.tsx      # Details cards
    ├── reviews-section.tsx         # Reviews list & form
    ├── organizer-info.tsx          # Organizer profile
    └── nearby-attractions.tsx      # Nearby venues grid

types/
└── attraction.ts                   # TypeScript interfaces
```

## Usage

### Basic Usage

```tsx
import AttractionPage from "@/components/attraction-page"

export default function Page() {
  return <AttractionPage />
}
```

### With Custom Data

```tsx
import AttractionPage from "@/components/attraction-page"
import { Attraction } from "@/types/attraction"

const myAttraction: Attraction = {
  id: "1",
  title: "My Venue",
  city: "Warsaw",
  region: "Mazowieckie",
  // ... other fields
}

export default function Page() {
  return <AttractionPage attraction={myAttraction} />
}
```

## TypeScript Interfaces

### Attraction

```typescript
interface Attraction {
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
```

### Organizer

```typescript
interface Organizer {
  name: string
  image?: string
  description: string
  phone?: string
  email?: string
}
```

### Review

```typescript
interface Review {
  id: string
  userName: string
  rating: number
  comment: string
  date: string
  userAvatar?: string
}
```

### NearbyAttraction

```typescript
interface NearbyAttraction {
  id: string
  name: string
  image: string
  distance: string
  category: string
  priceFrom?: number
  rating?: number
}
```

## Responsive Design

- **Mobile (< 768px)**: Single column layout, horizontal image scroll
- **Tablet (768px - 1024px)**: Optimized grid layouts
- **Desktop (> 1024px)**: Three-column layout with sticky sidebar

## Styling

The component uses:
- **Tailwind CSS** for styling
- **Radix UI** components for accessibility
- **Lucide React** icons
- **shadcn/ui** design system

## Demo

Visit `/attraction-demo` in the application to see the component with mock data.

## Mock Data

The component includes comprehensive mock data demonstrating all features:
- 6 placeholder images
- 4 sample reviews
- 9 amenities
- 5 tips
- 3 nearby attractions
- Complete organizer information

## Dependencies

Required UI components from shadcn/ui:
- `Button`
- `Card`
- `Badge`
- `Dialog`
- `Avatar`
- `Textarea`

Icons from lucide-react:
- `MapPin`, `Share2`, `Heart`, `Clock`, `DollarSign`, `Users`, `Calendar`
- `CheckCircle2`, `Lightbulb`, `ExternalLink`, `Star`, `ChevronLeft`, `ChevronRight`, `X`
- `Mail`, `Phone`

## Accessibility

- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support in gallery modal
- Screen reader friendly

## Future Enhancements

Potential improvements:
- [ ] Connect review form to backend API
- [ ] Add video player for attraction videos
- [ ] Implement map integration
- [ ] Add booking calendar
- [ ] Social sharing functionality
- [ ] Print-friendly view

## License

Part of the EnjoyHub application.
