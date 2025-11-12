# Attraction Detail Page

This directory contains the implementation of a full-featured attraction detail page for the EnjoyHubAI platform.

## Route Structure

The page uses a dynamic route pattern: `/{city}-{activity}-{slug}-{id}`

Example URLs:
- `/krakow-hiking-wieliczka-salt-mine-abc123`
- `/warsaw-museum-national-museum-def456`

The route parser extracts the `id` (last segment) to fetch attraction data from Supabase.

## Features

### 1. Image Gallery
- Full-width carousel using Embla Carousel
- Navigation arrows for browsing images
- Favorites button (heart icon) in top-right corner
- Share button for native sharing or copying link to clipboard
- Fullscreen dialog view with thumbnails
- Image counter display
- Responsive on mobile (swipeable)

### 2. Header Section
- Large, bold attraction title
- Average rating with star icon and review count (e.g., "★ 4.9 · 3250 recenzji")
- Location display (city, region, country)
- Host information with avatar, name, and location

### 3. Description
- Expandable description with "Show more/Show less" toggle
- Automatic truncation for long descriptions (>300 characters)
- Supports both short and full descriptions

### 4. "Warto wiedzieć" (Worth Knowing) Section
Dynamic fields with icons:
- **Minimum guest age/requirements** (User icon)
- **Activity level** (Activity icon)
- **What to bring** (Backpack icon)
- **Accessibility information** (Accessibility icon) with optional contact host link
- **Cancellation policy** (Calendar icon)

### 5. Host's Other Attractions
- Horizontal carousel showing up to 6 other attractions by the same host
- "See all from this host" link
- Uses reusable `AttractionCard` component
- Hidden if no other attractions available

### 6. Location Map
- Interactive Leaflet map showing attraction location
- Displays address
- Share button to copy URL or use native share dialog
- Responsive height (taller on desktop)

### 7. Reviews Section
- Overall rating and total review count at the top
- Grid layout (2 columns on desktop, 1 on mobile)
- Shows latest 3-6 reviews
- Each review includes:
  - Reviewer avatar and name
  - Location (if available)
  - Star rating (1-5 stars)
  - Relative date (e.g., "Dziś", "Wczoraj", "3 dni temu")
  - Expandable comment text
- "Show all reviews" button if more than 6 reviews

### 8. Nearby Attractions
- Horizontal carousel showing up to 8 nearby attractions in the same city
- Uses reusable `AttractionCard` component
- Hidden if no nearby attractions available

### 9. Booking Card (Sidebar)
- Sticky sidebar card on desktop
- Price per night display
- Property details (type, max guests, bedrooms, bathrooms)
- "Book now" CTA button
- Disclaimer text

### 10. SEO & Metadata
- Dynamic page title: "{Title} - {City}, {Country}"
- Meta description from attraction description
- Open Graph tags with title, description, and featured image
- Canonical URL

## Components Used

### New Components Created
- `AttractionCard` - Reusable card for displaying attractions in lists
- `AttractionGallery` - Full-width carousel with favorites and share buttons
- `ExpandableDescription` - Description section with show more/less toggle
- `WorthKnowing` - Dynamic "worth knowing" section with icons
- `HostAttractions` - Carousel of host's other attractions
- `NearbyAttractions` - Carousel of nearby attractions
- `AttractionReviews` - Enhanced reviews component with expandable comments
- `ShareButton` - Reusable share button with native share fallback

### Existing Components Reused
- `PropertyMap` - Interactive map component
- UI components from shadcn/ui (Card, Button, Avatar, etc.)
- Carousel components (Embla-based)

## Data Fetching

The page fetches data server-side from Supabase:

1. **Main attraction data**:
   - Basic details (title, description, images, etc.)
   - Host information (user profile)
   - Reviews with reviewer details
   - Category information

2. **Related data**:
   - Other attractions by same host (up to 6)
   - Nearby attractions in same city (up to 8)

3. **Calculated values**:
   - Average rating from reviews
   - Total review count

## Accessibility Features

- Proper semantic HTML structure
- Alt texts for all images derived from attraction title
- ARIA labels for buttons (favorites, share, navigation)
- Keyboard navigation support in carousels
- Focus management in dialogs
- Screen reader friendly content

## Responsive Design

- Mobile-first approach with Tailwind CSS
- Gallery becomes fully swipeable on mobile
- Grid layouts stack vertically on smaller screens
- Sticky sidebar only on desktop (lg+)
- Touch-friendly button sizes
- Optimized image loading with Next.js Image component

## Example Usage

The page is automatically available at the dynamic route. To link to an attraction:

```tsx
import Link from "next/link"

// Create a link to an attraction
const citySlug = "krakow"
const activitySlug = "hiking"
const titleSlug = "wieliczka-salt-mine"
const id = "abc-123-def-456"

<Link href={`/${citySlug}-${activitySlug}-${titleSlug}-${id}`}>
  View Attraction
</Link>
```

Or use the `AttractionCard` component which handles URL generation automatically:

```tsx
<AttractionCard
  id="abc-123-def-456"
  title="Wieliczka Salt Mine"
  city="Krakow"
  country="Poland"
  images={["image1.jpg", "image2.jpg"]}
  rating={4.9}
  reviewsCount={3250}
  maxGuests={30}
  pricePerNight={50}
  categoryName="Hiking"
  activitySlug="hiking"
  slug="wieliczka-salt-mine"
/>
```

## Future Enhancements

Potential improvements:
- Implement actual favorites functionality (save to database)
- Add booking calendar integration
- Support for video galleries
- Virtual tour integration
- Social proof widgets (recent bookings, views)
- Multi-language support for Polish/English toggle
- Dynamic "Worth Knowing" fields from database
- Amenities/facilities section
- FAQ section
- Host contact form
