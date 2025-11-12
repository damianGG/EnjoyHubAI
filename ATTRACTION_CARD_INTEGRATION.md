# AttractionCard Integration - Main View

This document describes the integration of the AttractionCard component into the main application view and map functionality.

## Changes Made

### 1. Main Page Integration (`app/page.tsx`)

**Updated Imports:**
- Removed: `Card`, `CardContent`, `MapPin`, `Star`, `Link` (replaced by AttractionCard)
- Added: `AttractionCard` component import

**Updated Search Results Interface:**
```typescript
interface SearchResult {
  id: string
  title: string
  city: string
  country: string
  region?: string          // Added
  latitude: number | null
  longitude: number | null
  price_per_night: number
  category_slug: string | null
  category_name: string | null
  category_icon: string | null
  avg_rating: number
  images?: string[]        // Added
  review_count?: number    // Added
}
```

**Replaced Simple Cards with AttractionCard:**
- Changed from basic `Card` components to full-featured `AttractionCard` components
- Now displays image carousel, badges, ratings with review counts
- Grid layout: 1-3 columns responsive (was list view)
- All properties now show as Airbnb-style cards

**Enhanced Map Popups:**
- Popups now show property images
- Card-like styling with better information layout
- Displays rating, review count, and price in Polish złoty (zł)
- Improved visual presentation when clicking map markers

### 2. Search API Enhancement (`app/api/search/route.ts`)

**Updated Response Data:**
```typescript
// Added to query
- region field
- images array

// Added to response
return {
  ...existing fields,
  region: property.region || property.city,
  images: property.images || [],
  review_count: ratings.length
}
```

Now the API returns all necessary data for AttractionCard to display properly.

## Features

### Main View Grid
- **Responsive Grid Layout**: 1 column (mobile) → 2 columns (tablet) → 3 columns (desktop)
- **Image Carousels**: Each card shows property images with navigation
- **Optional Badges**: "Ulubieniec Gości" and "Rezerwacja natychmiastowa" when applicable
- **Rating Display**: Star icon with numerical rating and review count
- **Price Information**: Shows price with unit (per night in main view)

### Map Integration
- **Enhanced Popups**: Clicking a map marker shows a card-like popup with:
  - Property image
  - Title with location
  - Rating and review count
  - Price in złoty per night
  - Better styling and formatting

### Polish Language Support
- All prices shown in "zł" (Polish złoty)
- Price units: "noc" (night), "osobę" (person), "dzień" (day)
- Review count in Polish: "opinia/opinii"

## Visual Comparison

**Before:**
- Simple text cards with minimal information
- List-style layout
- No images in main view
- Basic map popups with text only

**After:**
- Rich AttractionCard components with images
- Grid layout matching Airbnb/Booking.com style
- Image carousels with hover navigation
- Enhanced map popups with images and better styling

## Usage Example

The main page (`/`) now automatically uses AttractionCard for all search results:

```tsx
<AttractionCard
  id={result.id}
  images={result.images || []}
  title={result.title}
  city={result.city}
  region={result.region || result.category_name || ''}
  country={result.country}
  rating={result.avg_rating || 0}
  reviewsCount={result.review_count || 0}
  price={result.price_per_night}
  priceUnit="noc"
  href={`/properties/${result.id}`}
/>
```

## Map Hover Behavior

When users hover over a map marker:
1. Marker highlights with category icon
2. Clicking shows enhanced popup with property card preview
3. Popup displays image, title, location, rating, and price
4. Clicking the popup title navigates to property details

## Benefits

1. **Consistent UI**: Same card component used in main view and demo
2. **Better UX**: Visual property previews make browsing easier
3. **Modern Design**: Matches current booking platform standards
4. **Mobile Friendly**: Responsive grid adapts to screen size
5. **Rich Information**: Users see more details at a glance
