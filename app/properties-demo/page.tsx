import PropertiesView from "@/components/properties-view"

// Mock data for demonstration
const mockProperties = [
  {
    id: "1",
    title: "Luksusowy apartament w centrum",
    city: "Warszawa",
    country: "Polska",
    latitude: 52.2297,
    longitude: 21.0122,
    price_per_night: 450,
    property_type: "Apartament",
    max_guests: 4,
    bedrooms: 2,
    bathrooms: 2,
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400"],
    avgRating: 4.8,
    reviewCount: 24,
    amenities: ["WiFi", "Parking"],
    users: {
      full_name: "Jan Kowalski"
    }
  },
  {
    id: "2",
    title: "Przytulne studio nad morzem",
    city: "Gdańsk",
    country: "Polska",
    latitude: 54.352,
    longitude: 18.6466,
    price_per_night: 320,
    property_type: "Studio",
    max_guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400"],
    avgRating: 4.5,
    reviewCount: 18,
    amenities: ["WiFi"],
    users: {
      full_name: "Anna Nowak"
    }
  },
  {
    id: "3",
    title: "Dom z ogrodem",
    city: "Kraków",
    country: "Polska",
    latitude: 50.0647,
    longitude: 19.945,
    price_per_night: 600,
    property_type: "Dom",
    max_guests: 6,
    bedrooms: 3,
    bathrooms: 2,
    images: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400"],
    avgRating: 4.9,
    reviewCount: 42,
    amenities: ["WiFi", "Parking", "Ogród"],
    users: {
      full_name: "Piotr Wiśniewski"
    }
  },
  {
    id: "4",
    title: "Nowoczesne loft",
    city: "Wrocław",
    country: "Polska",
    latitude: 51.1079,
    longitude: 17.0385,
    price_per_night: 380,
    property_type: "Loft",
    max_guests: 3,
    bedrooms: 1,
    bathrooms: 1,
    images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400"],
    avgRating: 4.6,
    reviewCount: 15,
    amenities: ["WiFi"],
    users: {
      full_name: "Maria Lewandowska"
    }
  },
  {
    id: "5",
    title: "Willa z basenem",
    city: "Zakopane",
    country: "Polska",
    latitude: 49.2992,
    longitude: 19.9496,
    price_per_night: 850,
    property_type: "Willa",
    max_guests: 8,
    bedrooms: 4,
    bathrooms: 3,
    images: ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400"],
    avgRating: 5.0,
    reviewCount: 67,
    amenities: ["WiFi", "Parking", "Basen"],
    users: {
      full_name: "Tomasz Kamiński"
    }
  },
  {
    id: "6",
    title: "Apartament w kamienicy",
    city: "Poznań",
    country: "Polska",
    latitude: 52.4064,
    longitude: 16.9252,
    price_per_night: 290,
    property_type: "Apartament",
    max_guests: 3,
    bedrooms: 1,
    bathrooms: 1,
    images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400"],
    avgRating: 4.4,
    reviewCount: 31,
    amenities: ["WiFi"],
    users: {
      full_name: "Katarzyna Zielińska"
    }
  }
]

export default function PropertiesDemoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Wszystkie obiekty (Demo)</h1>
        <p className="text-muted-foreground">Demonstracja widoku mobilnego z 2 kolumnami</p>
      </div>

      <section>
        <PropertiesView properties={mockProperties} />
      </section>
    </div>
  )
}
