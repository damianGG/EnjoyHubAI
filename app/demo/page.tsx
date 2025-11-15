import AttractionCard from "@/components/AttractionCard"

export default function DemoPage() {
  // Sample data for demonstration
  const sampleAttractions = [
    {
      id: "1",
      images: [
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=600&fit=crop",
      ],
      title: "Góry Tatry - Wycieczka z przewodnikiem",
      city: "Zakopane",
      region: "Małopolska",
      country: "Polska",
      rating: 4.9,
      reviewsCount: 128,
      price: 454,
      priceUnit: "osobę" as const,
      isGuestFavorite: true,
      href: "/attractions/1",
    },
    {
      id: "2",
      images: [
        "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
      ],
      title: "Rejs statkiem po Bałtyku",
      city: "Gdańsk",
      region: "Pomorskie",
      country: "Polska",
      rating: 4.7,
      reviewsCount: 86,
      price: 250,
      priceUnit: "osobę" as const,
      isInstantBookable: true,
      href: "/attractions/2",
    },
    {
      id: "3",
      images: [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=600&fit=crop",
      ],
      title: "Hotel Górski z widokiem na szczyty",
      city: "Karpacz",
      region: "Dolnośląskie",
      country: "Polska",
      rating: 4.8,
      reviewsCount: 215,
      price: 350,
      priceUnit: "noc" as const,
      isGuestFavorite: true,
      isInstantBookable: true,
      href: "/properties/3",
    },
    {
      id: "4",
      images: [
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&h=600&fit=crop",
      ],
      title: "Wycieczka rowerowa po Mazurach",
      city: "Giżycko",
      region: "Warmińsko-Mazurskie",
      country: "Polska",
      rating: 4.6,
      reviewsCount: 54,
      price: 180,
      priceUnit: "dzień" as const,
      href: "/attractions/4",
    },
    {
      id: "5",
      images: [
        "https://images.unsplash.com/photo-1513326738677-b964603b136d?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&h=600&fit=crop",
      ],
      title: "Spa & Wellness w sercu Beskidów",
      city: "Wisła",
      region: "Śląskie",
      country: "Polska",
      rating: 4.9,
      reviewsCount: 312,
      price: 420,
      priceUnit: "noc" as const,
      isGuestFavorite: true,
      href: "/properties/5",
    },
    {
      id: "6",
      images: [
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=600&fit=crop",
      ],
      title: "Spływ kajakowy Dunajcem",
      city: "Szczawnica",
      region: "Małopolska",
      country: "Polska",
      rating: 4.5,
      reviewsCount: 97,
      price: 120,
      priceUnit: "osobę" as const,
      isInstantBookable: true,
      href: "/attractions/6",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AttractionCard Component Demo</h1>
        <p className="text-muted-foreground">
          Showcase of the reusable AttractionCard component with various configurations
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {sampleAttractions.map((attraction) => (
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
            href={attraction.href}
            id={attraction.id}
          />
        ))}
      </div>

      <div className="mt-12 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Component Features</h2>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>Image carousel with smooth navigation (hover to see arrows)</li>
          <li>Optional badges for "Ulubieniec Gości" and "Rezerwacja natychmiastowa"</li>
          <li>Responsive grid layout adapting to screen size</li>
          <li>Rating display with star icon</li>
          <li>Flexible price units (per night, per person, per day)</li>
          <li>Optimized images using Next.js Image component</li>
          <li>Accessibility features with proper alt text and ARIA labels</li>
          <li>Hover effects for enhanced interactivity</li>
        </ul>
      </div>
    </div>
  )
}
