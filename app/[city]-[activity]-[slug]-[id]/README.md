# Attraction Detail Page

This directory contains the implementation of a full-featured attraction detail page for the EnjoyHubAI project.

## Route Structure

The page is accessible via the dynamic route pattern:
```
/{city}-{activity}-{slug}-{id}
```

Example:
```
/warsaw-escape-room-fun-adventure-123e4567-e89b-12d3-a456-426614174000
```

## Components

### Server Components

- **page.tsx**: Main server component that fetches all data from Supabase and orchestrates the layout

### Client Components

1. **AttractionGallery** (`/components/attraction-gallery.tsx`)
   - Full-width carousel for images
   - Navigation arrows with accessibility labels
   - Favorites button overlay
   - Responsive design

2. **AttractionHeader** (`/components/attraction-header.tsx`)
   - Title display
   - Host information with avatar
   - Location display
   - Average rating and review count

3. **AttractionDescription** (`/components/attraction-description.tsx`)
   - Short description preview
   - Expandable full description
   - "Show more/less" toggle

4. **WorthKnowing** (`/components/worth-knowing.tsx`)
   - Dynamic fields from category configuration
   - Contextual icons for different field types
   - Supports text, file, and various input types

5. **HostAttractions** (`/components/host-attractions.tsx`)
   - Carousel of other attractions by the same host
   - Limit of 6 attractions
   - Links to individual attraction pages

6. **AttractionMap** (`/components/attraction-map.tsx`)
   - Interactive Leaflet map
   - Location marker
   - Address display
   - Share functionality (native share or copy to clipboard)

7. **AttractionReviews** (`/components/attraction-reviews.tsx`)
   - Display of latest reviews
   - Expandable review comments
   - "Show all" functionality
   - Relative date formatting
   - Rating stars display

8. **NearbyAttractions** (`/components/nearby-attractions.tsx`)
   - Carousel of nearby attractions in the same city
   - Limit of 8 attractions
   - Includes ratings and review counts

## Features

### Data Fetching

The page fetches the following data from Supabase:

- **Main Attraction Data**:
  - Title, description, address, location coordinates
  - Images array
  - Price per night
  - Host information (name, avatar, location, bio)
  - Category information

- **Reviews**:
  - Rating, comment, creation date
  - Reviewer information (name, avatar, location)

- **Dynamic Fields**:
  - Category-specific fields and their values
  - Supports minimum age, activity level, equipment, accessibility, etc.

- **Related Attractions**:
  - Other attractions by the same host (max 6)
  - Nearby attractions in the same city (max 8)
  - Includes rating calculations

### SEO Optimization

- Dynamic metadata generation
- Open Graph tags
- Canonical URL
- Descriptive titles and meta descriptions

### Accessibility

- ARIA labels on interactive elements
- Alt text on all images
- Proper heading hierarchy
- Keyboard navigation support
- Role attributes where appropriate

### Responsive Design

- Mobile-first approach
- Breakpoints for tablet and desktop
- Touch-friendly carousels
- Stacked layout on mobile, side-by-side on desktop

## Loading States

- **loading.tsx**: Skeleton loading UI with animated placeholders
- **not-found.tsx**: Custom 404 page with navigation options

## Type Definitions

TypeScript types are defined in `/lib/types/attraction.ts`:

- `AttractionHost`
- `AttractionReview`
- `CategoryField`
- `FieldValue`
- `AttractionCategory`
- `Attraction`
- `RelatedAttraction`

## Usage Example

Users navigate to the page via:
1. Clicking on attraction cards from search results
2. Direct URL access
3. Links from related attractions

The page will:
1. Parse the URL parameters
2. Fetch data from Supabase
3. Render server components with static data
4. Hydrate client components for interactivity
5. Display loading states during data fetch
6. Show 404 if attraction not found

## Dependencies

- Next.js 15.5.6
- React 19
- Supabase client
- Leaflet for maps
- Embla Carousel (via shadcn/ui)
- Lucide React for icons
- date-fns for date formatting
- Tailwind CSS for styling

## Future Improvements

- [ ] Implement actual favorites functionality with Supabase
- [ ] Add booking integration
- [ ] Implement review submission
- [ ] Add image zoom/lightbox
- [ ] Implement virtual tours
- [ ] Add social media sharing options
- [ ] Implement distance calculation for nearby attractions
- [ ] Add filtering for host attractions by category
