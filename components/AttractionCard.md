# AttractionCard Component

A reusable React component for displaying attraction cards with image sliders, similar to Airbnb/Alohacamp listings.

## Features

- **Image Carousel**: Smooth image slider with navigation arrows
- **Responsive Design**: Works on mobile and desktop
- **Optional Badges**: Guest favorite and instant booking indicators
- **Accessibility**: Proper alt text and ARIA labels
- **Next.js Optimized**: Uses Next.js Image component for performance

## Usage

### Basic Example

```tsx
import AttractionCard from "@/components/AttractionCard"

export default function AttractionsList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      <AttractionCard
        images={[
          "/attractions/mountain-view-1.jpg",
          "/attractions/mountain-view-2.jpg",
          "/attractions/mountain-view-3.jpg",
        ]}
        title="Góry Tatry - Wycieczka z przewodnikiem"
        city="Zakopane"
        region="Małopolska"
        country="Polska"
        rating={4.9}
        reviewsCount={128}
        price={454}
        priceUnit="osobę"
        isGuestFavorite={true}
        href="/attractions/123"
      />

      <AttractionCard
        images={[
          "/attractions/beach-1.jpg",
          "/attractions/beach-2.jpg",
        ]}
        title="Rejs statkiem po Bałtyku"
        city="Gdańsk"
        region="Pomorskie"
        country="Polska"
        rating={4.7}
        reviewsCount={86}
        price={250}
        priceUnit="osobę"
        isInstantBookable={true}
        href="/attractions/124"
      />

      <AttractionCard
        images={[
          "/attractions/hotel-1.jpg",
          "/attractions/hotel-2.jpg",
          "/attractions/hotel-3.jpg",
        ]}
        title="Hotel Górski z widokiem na szczyty"
        city="Karpacz"
        region="Dolnośląskie"
        country="Polska"
        rating={4.8}
        reviewsCount={215}
        price={350}
        priceUnit="noc"
        isGuestFavorite={true}
        isInstantBookable={true}
        href="/properties/456"
      />
    </div>
  )
}
```

### With Dynamic Data

```tsx
import AttractionCard from "@/components/AttractionCard"

interface Attraction {
  id: string
  images: string[]
  title: string
  city: string
  region: string
  country: string
  rating: number
  reviewsCount: number
  price: number
  priceUnit: 'noc' | 'osobę' | 'dzień'
  isGuestFavorite?: boolean
  isInstantBookable?: boolean
}

export default function AttractionsList({ attractions }: { attractions: Attraction[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {attractions.map((attraction) => (
        <AttractionCard
          key={attraction.id}
          images={attraction.images}
          title={attraction.title}
          city={attraction.city}
          region={attraction.region}
          country={attraction.country}
          rating={attraction.rating}
          reviewsCount={attraction.reviewsCount}
          price={attraction.price}
          priceUnit={attraction.priceUnit}
          isGuestFavorite={attraction.isGuestFavorite}
          isInstantBookable={attraction.isInstantBookable}
          href={`/attractions/${attraction.id}`}
        />
      ))}
    </div>
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `images` | `string[]` | Yes | Array of image URLs for the slider |
| `title` | `string` | Yes | Title of the attraction |
| `city` | `string` | Yes | City name |
| `region` | `string` | Yes | Region name |
| `country` | `string` | Yes | Country name |
| `rating` | `number` | Yes | Average rating (e.g., 4.9) |
| `reviewsCount` | `number` | Yes | Number of reviews |
| `price` | `number` | Yes | Starting price |
| `priceUnit` | `'noc' \| 'osobę' \| 'dzień'` | Yes | Price unit depending on category |
| `isGuestFavorite` | `boolean` | No | Show "Ulubieniec Gości" badge |
| `isInstantBookable` | `boolean` | No | Show "Rezerwacja natychmiastowa" badge |
| `href` | `string` | No | Link URL for the card |
| `id` | `string` | No | Unique identifier for the attraction |

## Styling

The component uses Tailwind CSS and is fully responsive. It matches the design pattern of existing property cards in the project and features:

- Rounded corners on the card
- Hover effects with shadow elevation
- Smooth carousel transitions
- Mobile-friendly touch swipe support
- Image optimization with Next.js Image component

## Accessibility

- All images include descriptive alt text
- Navigation buttons have aria-labels
- Keyboard navigation supported in carousel
- Semantic HTML structure
