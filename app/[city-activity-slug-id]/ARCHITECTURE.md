# Component Architecture

## Attraction Detail Page Component Hierarchy

```
app/[city-activity-slug-id]/page.tsx (Server Component)
│
├── AttractionGallery (Client Component)
│   ├── Carousel
│   │   ├── CarouselContent
│   │   ├── CarouselItem (multiple)
│   │   ├── CarouselPrevious
│   │   └── CarouselNext
│   ├── ShareButton
│   ├── Heart Button (Favorites)
│   └── Dialog (Fullscreen view)
│
├── Header Section (Server Component)
│   ├── Title
│   ├── Rating & Reviews
│   ├── Location
│   └── Host Info
│       └── Avatar
│
├── ExpandableDescription (Client Component)
│   └── Card
│       ├── CardHeader
│       └── CardContent
│           └── Button (Show more/less)
│
├── WorthKnowing (Server Component)
│   └── Card
│       ├── CardHeader
│       └── CardContent
│           └── Dynamic Items (with icons)
│
├── HostAttractions (Client Component)
│   └── Card
│       ├── CardHeader
│       └── CardContent
│           └── Carousel
│               └── AttractionCard (multiple)
│
├── Map Section (Server Component)
│   └── Card
│       ├── CardHeader
│       ├── CardContent
│       │   ├── PropertyMap (Client Component)
│       │   └── ShareButton (Client Component)
│
├── AttractionReviews (Client Component)
│   └── Card
│       ├── CardHeader
│       └── CardContent
│           ├── Review Grid
│           │   └── Review Items (with Avatar, Stars, Expandable)
│           └── "Show All" Button
│
├── NearbyAttractions (Client Component)
│   └── Card
│       ├── CardHeader
│       └── CardContent
│           └── Carousel
│               └── AttractionCard (multiple)
│
└── Booking Sidebar (Server Component)
    └── Card (sticky)
        ├── CardHeader (Price)
        └── CardContent
            ├── Property Details
            └── Book Button
```

## Data Flow

```
User Request
    ↓
Dynamic Route: /[city-activity-slug-id]
    ↓
parseAttractionRoute(params) → Extract ID
    ↓
Server-side Supabase Queries:
    ├── Main Attraction (with host, reviews, categories)
    ├── Host's Other Attractions (max 6)
    └── Nearby Attractions (max 8)
    ↓
Calculate Derived Data:
    ├── Average Rating
    ├── Rounded Rating
    └── Review Count
    ↓
Format Data for Components:
    ├── formattedHostAttractions[]
    ├── formattedNearbyAttractions[]
    └── worthKnowingItems[]
    ↓
Server Component Rendering
    ↓
Hydrate Client Components:
    ├── AttractionGallery
    ├── ExpandableDescription
    ├── AttractionReviews
    ├── HostAttractions
    ├── NearbyAttractions
    ├── ShareButton
    └── PropertyMap
    ↓
Interactive Page
```

## Component Responsibilities

### Server Components
**Main Page** (`page.tsx`)
- Parse route parameters
- Fetch all data from Supabase
- Calculate ratings and aggregates
- Format data for child components
- Render static layout
- Generate SEO metadata

**WorthKnowing**
- Display static list of information items
- Render icons based on type
- Support optional links

### Client Components

**AttractionGallery**
- Manage carousel state
- Handle favorites toggle
- Integrate share functionality
- Control fullscreen dialog
- Display image counter

**ExpandableDescription**
- Manage expanded/collapsed state
- Auto-truncate long descriptions
- Toggle button functionality

**HostAttractions**
- Render horizontal carousel
- Display other attractions by host
- Link to host page

**NearbyAttractions**
- Render horizontal carousel
- Display nearby attractions
- Filter by same city

**AttractionReviews**
- Manage expanded review states
- Calculate relative dates
- Truncate long comments
- Display star ratings

**ShareButton**
- Handle Web Share API
- Fallback to clipboard
- Show toast notifications
- Support icon-only mode

**AttractionCard** (Reusable)
- Generate dynamic URLs
- Display attraction info
- Handle image loading
- Show ratings and badges

## State Management

### Local Component State
- Gallery: `currentImage`, `isFullscreen`, `isFavorite`
- Description: `isExpanded`
- Reviews: `expandedReviews` (Set<string>)
- ShareButton: `isSharing`

### Server State (Supabase)
- Attraction data
- Host information
- Reviews
- Related attractions

### Derived State
- Average ratings
- Review counts
- Formatted dates
- URL generation

## Styling Strategy

### Responsive Design
- Mobile-first approach
- Grid layouts: `grid-cols-1 lg:grid-cols-3`
- Carousel: `basis-full sm:basis-1/2 lg:basis-1/3`
- Typography: `text-sm md:text-base`
- Spacing: `gap-4 md:gap-6`
- Hidden elements: `hidden md:flex`

### Theme Support
- Uses CSS variables for colors
- Supports dark mode through Tailwind
- Consistent with existing design system

### Accessibility
- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management in dialogs
- Alt texts on all images
- Screen reader friendly content

## Performance Optimizations

1. **Server-Side Rendering**
   - Initial page load is server-rendered
   - SEO-friendly with metadata

2. **Image Optimization**
   - Next.js Image component
   - Lazy loading (priority on first image)
   - Responsive images

3. **Code Splitting**
   - Client components loaded separately
   - Dialog content loaded on demand

4. **Data Fetching**
   - Single server-side query per page
   - Efficient Supabase joins
   - Limited result sets (6, 8 items)

5. **Component Reusability**
   - AttractionCard shared component
   - ShareButton reused in multiple places
   - Carousel component reused
