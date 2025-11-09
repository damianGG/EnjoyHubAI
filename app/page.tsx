"use client"

import { useState, useEffect, Suspense } from "react"
import { Loader2 } from "lucide-react"
import { SearchBar } from "@/components/SearchBar"
import { SearchModal } from "@/components/SearchModal"
import { CategoryTabs } from "@/components/CategoryTabs"
import { OfferCard } from "@/components/OfferCard"
import { BottomNav } from "@/components/BottomNav"
import Link from "next/link"

interface Offer {
  id: string
  image: string
  title: string
  city: string
  price: number
  rating: number
  category: string
}

function HomePageContent() {
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)

  // Load offers from JSON file
  useEffect(() => {
    const loadOffers = async () => {
      try {
        const response = await fetch("/data/offers.json")
        const data = await response.json()
        setOffers(data)
      } catch (error) {
        console.error("Failed to load offers:", error)
      } finally {
        setLoading(false)
      }
    }
    
    loadOffers()
  }, [])

  // Filter offers by selected category
  const filteredOffers = selectedCategory
    ? offers.filter((offer) => offer.category === selectedCategory)
    : offers

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Top Navigation */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">E</span>
              </div>
              <span className="text-xl font-bold hidden md:inline">EnjoyHub</span>
            </Link>

            {/* Search Bar - Centered on desktop */}
            <div className="flex-1 max-w-2xl mx-auto hidden md:block">
              <SearchBar onSearchClick={() => setSearchModalOpen(true)} />
            </div>

            {/* Right side - Host link */}
            <div className="hidden md:block flex-shrink-0">
              <Link
                href="/host"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Zostań gospodarzem
              </Link>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="md:hidden mt-3">
            <SearchBar onSearchClick={() => setSearchModalOpen(true)} />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <CategoryTabs
        selectedCategory={selectedCategory || undefined}
        onCategorySelect={setSelectedCategory}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {selectedCategory
                  ? `${filteredOffers.length} ofert`
                  : "Odkrywaj najlepsze aktywności"}
              </h1>
              <p className="text-muted-foreground">
                {selectedCategory
                  ? "Znajdź idealną przygodę dla siebie"
                  : "Przygody czekają w Twojej okolicy"}
              </p>
            </div>

            {/* Offers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => (
                <OfferCard key={offer.id} {...offer} />
              ))}
            </div>

            {filteredOffers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Nie znaleziono ofert w tej kategorii. Spróbuj wybrać inną kategorię.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Search Modal */}
      <SearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} />

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
