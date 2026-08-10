# AttractionPage Component

## Overview

The `AttractionPage` component is a comprehensive, production-ready page component for displaying entertainment venue details in an Airbnb/Booking.com style. It's designed for showcasing attractions like paintball arenas, go-kart tracks, escape rooms, playgrounds, rope parks, and similar entertainment facilities.

## Features

- 📱 **Fully Responsive** - Optimized for mobile, tablet, and desktop devices
- 🖼️ **Image Gallery** - Grid layout with fullscreen modal viewer
- ⭐ **Reviews System** - Display and add user reviews with star ratings
- 🏢 **Organizer Information** - Profile and contact details
- 🎯 **Nearby Attractions** - Carousel of similar venues
- ♿ **Accessible** - WCAG compliant with proper ARIA labels
- 🎨 **Modern Design** - Clean, professional Airbnb-style layout

## Component Structure

### Main Component
- **`AttractionPage`** - Main page component that assembles all sections

### Sub-components
- **`ImageGallery`** - Desktop grid + fullscreen modal with navigation
- **`AttractionDetails`** - Comprehensive details section
- **`ReviewsSection`** - Reviews display + add review form
- **`OrganizerInfo`** - Organizer profile and contact
- **`NearbyAttractions`** - Carousel of similar attractions

### TypeScript Types
All types are defined in `types/attraction.ts`:
- `Attraction` - Main attraction data structure
- `Organizer` - Organizer information
- `Review` - User review structure
- `NearbyAttraction` - Related attraction data

## Usage

### Basic Usage (with mock data)

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
  title: "Amazing Paintball Arena",
  city: "Warsaw",
  region: "Mazovia",
  category: "Paintball",
  description: "Professional paintball arena...",
  // ... other fields
}

export default function Page() {
  return <AttractionPage attraction={myAttraction} />
}
```

### Individual Components

You can also use the sub-components separately:

```tsx
import ImageGallery from "@/components/image-gallery"
import AttractionDetails from "@/components/attraction-details"
import ReviewsSection from "@/components/reviews-section"
import OrganizerInfo from "@/components/organizer-info"
import NearbyAttractions from "@/components/nearby-attractions"

// Use components individually as needed
```

## Data Structure

### Attraction Interface

```typescript
interface Attraction {
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
```

## Sections Explained

### 1. Header
- Back button
- Share and favorite buttons
- Sticky navigation

### 2. Title and Location
- Attraction name
- City and region
- Short description

### 3. Image Gallery
- Desktop: 2x2 grid with main large image + 4 smaller images
- Mobile: Horizontal scrollable gallery
- Click any image to open fullscreen modal with navigation

### 4. Attraction Details
- Category badge
- Full description
- Opening hours
- Address with map link
- Price range
- Duration
- Age restrictions
- Amenities list
- Tips and recommendations

### 5. How It Works Section
- Detailed explanation of the attraction
- Optional video or additional images

### 6. Reviews
- Average rating display
- List of user reviews with ratings
- Add review form (frontend only)

### 7. Organizer Information
- Organizer profile
- Contact details (phone, email)
- Contact button

### 8. Booking Card (Sidebar)
- Price display
- Duration information
- Booking button
- Best price guarantee

### 9. Nearby Attractions
- Carousel of similar venues
- Distance information
- Quick links to other attractions

## Responsive Behavior

### Desktop (≥1024px)
- Grid image gallery
- Two-column layout (content + sidebar)
- Full carousel controls

### Tablet (≥768px)
- Adjusted grid layout
- Single column with sticky sidebar
- Touch-friendly controls

### Mobile (<768px)
- Horizontal scrolling image gallery
- Single column layout
- Optimized touch interactions

## Styling

The component uses:
- **Tailwind CSS** for styling
- **Radix UI** components (Dialog, Carousel, Card, etc.)
- Responsive utility classes
- Custom animations and transitions

## Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus management in modal dialogs

## Demo

Visit `/attraction-demo` to see the component with mock data.

## Dependencies

- Next.js 15+
- React 19+
- Tailwind CSS
- Radix UI components:
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-avatar`
  - Carousel component (embla-carousel-react)
- Lucide React icons

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

Potential improvements:
- [ ] Backend integration for reviews
- [ ] Real-time availability checking
- [ ] Integration with booking system
- [ ] Map integration for location display
- [ ] Photo upload for reviews
- [ ] Social sharing functionality
- [ ] Favorite/save functionality
- [ ] Print-friendly version

## License

This component is part of the EnjoyHub project.
