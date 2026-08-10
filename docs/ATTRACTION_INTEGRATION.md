# Integration Guide: AttractionPage Component

This guide explains how to integrate the AttractionPage component into your EnjoyHub application.

## Quick Start

### 1. Basic Integration

Create a new page for attractions in your app:

```tsx
// app/attractions/[id]/page.tsx
import AttractionPage from "@/components/attraction-page"

export default function AttractionDetailPage() {
  return <AttractionPage />
}
```

### 2. With Dynamic Data

Fetch data from your backend and pass it to the component:

```tsx
// app/attractions/[id]/page.tsx
import AttractionPage from "@/components/attraction-page"
import { Attraction } from "@/types/attraction"

async function getAttraction(id: string): Promise<Attraction> {
  // Fetch from your API
  const res = await fetch(`/api/attractions/${id}`)
  return res.json()
}

export default async function AttractionDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const attraction = await getAttraction(params.id)
  
  return <AttractionPage attraction={attraction} />
}
```

### 3. With Supabase

If you're using Supabase (like the existing properties):

```tsx
// app/attractions/[id]/page.tsx
import { createClient } from "@/lib/supabase/server"
import AttractionPage from "@/components/attraction-page"
import { notFound } from "next/navigation"

export default async function AttractionDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const supabase = createClient()
  
  const { data: attraction } = await supabase
    .from("attractions")
    .select(`
      *,
      organizer:organizers (*),
      reviews (
        id,
        rating,
        comment,
        created_at,
        user:users (full_name, avatar_url)
      ),
      nearby_attractions:attractions!nearby (*)
    `)
    .eq("id", params.id)
    .single()

  if (!attraction) {
    notFound()
  }

  return <AttractionPage attraction={attraction} />
}
```

## Database Schema Suggestion

If you want to store attractions in Supabase, here's a suggested schema:

```sql
-- Attractions table
CREATE TABLE attractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  short_description TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  opening_hours TEXT NOT NULL,
  address TEXT NOT NULL,
  map_link TEXT,
  price_from DECIMAL(10,2),
  price_to DECIMAL(10,2),
  price_unit TEXT DEFAULT 'zł / person',
  duration TEXT,
  age_limit TEXT,
  amenities TEXT[],
  tips TEXT[],
  how_it_works TEXT,
  images TEXT[],
  video_url TEXT,
  organizer_id UUID REFERENCES organizers(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Organizers table
CREATE TABLE organizers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  image TEXT,
  description TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews table
CREATE TABLE attraction_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attraction_id UUID REFERENCES attractions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Routes (Optional)

If you prefer using API routes:

```tsx
// app/api/attractions/[id]/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  
  const { data: attraction, error } = await supabase
    .from("attractions")
    .select(`
      *,
      organizer:organizers (*),
      reviews:attraction_reviews (
        id,
        rating,
        comment,
        created_at,
        user:users (full_name, avatar_url)
      )
    `)
    .eq("id", params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!attraction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(attraction)
}
```

## Using Individual Components

You can also use sub-components individually:

```tsx
import { 
  ImageGallery, 
  ReviewsSection, 
  OrganizerInfo 
} from "@/components/attraction"

export default function CustomAttractionPage() {
  return (
    <div>
      <h1>My Custom Layout</h1>
      <ImageGallery images={images} title={title} />
      <ReviewsSection reviews={reviews} />
      <OrganizerInfo organizer={organizer} />
    </div>
  )
}
```

## Customization

### Styling

All components use Tailwind CSS classes. You can customize by:

1. Modifying the component files directly
2. Using CSS modules for overrides
3. Adjusting Tailwind configuration

### Adding Features

To add new features:

1. Update the TypeScript interfaces in `types/attraction.ts`
2. Modify the relevant component in `components/attraction/`
3. Update mock data in `components/attraction-page.tsx`

## Navigation

Add links to attraction pages from other parts of your app:

```tsx
import Link from "next/link"

// In a list or card component
<Link href={`/attractions/${attraction.id}`}>
  <h3>{attraction.title}</h3>
</Link>
```

## SEO Optimization

Add metadata for better SEO:

```tsx
// app/attractions/[id]/page.tsx
import { Metadata } from "next"

export async function generateMetadata({ 
  params 
}: { 
  params: { id: string } 
}): Promise<Metadata> {
  const attraction = await getAttraction(params.id)
  
  return {
    title: `${attraction.title} - EnjoyHub`,
    description: attraction.shortDescription || attraction.description,
    openGraph: {
      images: attraction.images,
    },
  }
}
```

## Testing

Test the component:

1. **Demo Page**: Visit `/attraction-demo` to see it with mock data
2. **Manual Testing**: Create test data and verify all features work
3. **Responsive Testing**: Test on mobile, tablet, and desktop viewports

## Troubleshooting

### Images not loading
- Ensure image URLs are valid
- Check Next.js image configuration in `next.config.mjs`
- Add domains to `images.remotePatterns` if using external images

### Reviews not submitting
- The current implementation is frontend-only
- Implement API endpoint to handle review submissions
- Connect the form's `handleSubmit` function to your API

### Styling issues
- Verify all required shadcn/ui components are installed
- Check Tailwind CSS configuration
- Ensure all dependencies are installed

## Next Steps

1. **Database Setup**: Create tables for attractions, organizers, and reviews
2. **API Implementation**: Build endpoints for CRUD operations
3. **Authentication**: Add user authentication for reviews
4. **Search & Filters**: Create attraction search/filter functionality
5. **Admin Panel**: Add management interface for attractions

## Support

For questions or issues:
- Check the component README: `components/attraction/README.md`
- Review the demo page: `/attraction-demo`
- Check TypeScript interfaces: `types/attraction.ts`
