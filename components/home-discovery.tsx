"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { ArrowRight, MapPin, ShieldCheck, Sparkles, TicketCheck } from "lucide-react"

import { TopNav } from "@/components/top-nav"
import { CategoryBar } from "@/components/category-bar"
import AttractionsView from "@/components/attractions-view"
import { Button } from "@/components/ui/button"

const SearchDialog = dynamic(
  () => import("@/components/search-dialog").then((mod) => ({ default: mod.SearchDialog })),
  { ssr: false }
)

interface Attraction {
  id: string
  title: string
  city: string
  country: string
  region?: string
  latitude?: number
  longitude?: number
  price_per_night: number
  property_type: string
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
  max_guests: number
  bedrooms: number
  bathrooms: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
  amenities?: string[]
}

const heroCategories = [
  { icon: "🏎️", label: "Gokarty", transform: "rotate-[-5deg]" },
  { icon: "🎯", label: "Paintball", transform: "rotate-[4deg]" },
  { icon: "🤸", label: "Trampoliny", transform: "rotate-[-2deg]" },
  { icon: "🧗", label: "Park linowy", transform: "rotate-[5deg]" },
]

export function HomeDiscovery({ attractions }: { attractions: Attraction[] }) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden overscroll-none bg-background md:static md:block md:h-auto md:min-h-screen md:overflow-visible md:overscroll-auto">
      <div className="relative z-[1200] shrink-0 bg-background md:sticky md:top-0">
        <TopNav onSearchClick={() => setSearchOpen(true)} />
        <CategoryBar useNavigation />
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <main className="min-h-0 flex-1 overflow-hidden md:block md:overflow-visible">
        {/* Desktop marketing hero. On mobile the map starts immediately below categories. */}
        <section className="relative hidden overflow-hidden border-b border-[#0b1220]/[0.05] bg-gradient-to-br from-[#fff8f4] via-white to-[#fff1eb] md:block">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-32 left-[35%] h-64 w-64 rounded-full bg-secondary/70 blur-3xl" />

          <div className="relative mx-auto grid max-w-[1500px] gap-8 px-7 py-12 md:grid-cols-[1.05fr_.95fr] lg:py-14">
            <div className="flex flex-col justify-center">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/85 px-3 py-1.5 text-xs font-bold text-primary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Pomysły na wolny czas w jednym miejscu
              </div>

              <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-[-0.055em] text-foreground lg:text-[3.65rem]">
                Znajdź coś, co <span className="text-primary">naprawdę</span> chcecie zrobić.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground lg:text-lg">
                Odkrywaj atrakcje na mapie, sprawdzaj dostępne terminy i rezerwuj bez telefonowania do obiektu.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Button onClick={() => setSearchOpen(true)} size="lg" className="h-12 rounded-full px-6 font-bold orange-glow">
                  Znajdź atrakcję <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-[#0b1220]/10 bg-white/85 px-6 font-bold shadow-sm">
                  <a href="#mapa">Zobacz mapę <MapPin className="ml-2 h-4 w-4 text-primary" /></a>
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5"><TicketCheck className="h-4 w-4 text-primary" /> rezerwacja online</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> bezpieczna płatność</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> atrakcje blisko Ciebie</span>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative h-[310px] w-full max-w-[520px] rounded-[36px] border border-[#0b1220]/[0.06] bg-white/70 p-6 shadow-[0_28px_70px_rgba(11,18,32,0.11)] backdrop-blur">
                <div className="absolute inset-4 rounded-[28px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,90,31,0.10),transparent_32%),linear-gradient(135deg,#fff8f4,#fff1eb)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-4">
                    {heroCategories.map((category) => (
                      <div key={category.label} className={`w-36 rounded-[24px] border border-[#0b1220]/[0.055] bg-white p-4 text-center shadow-[0_15px_32px_rgba(11,18,32,0.10)] ${category.transform}`}>
                        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-gradient-to-br from-secondary to-white text-4xl shadow-inner">{category.icon}</div>
                        <p className="mt-2 text-xs font-bold text-foreground">{category.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#0b1220] px-4 py-2 text-xs font-bold text-white shadow-xl">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Odkrywaj na mapie
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="mapa" className="h-full min-h-0 md:mx-auto md:h-auto md:max-w-[1600px] md:px-6 md:py-8">
          <div className="mb-5 hidden items-end justify-between gap-4 px-1 md:flex">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Odkrywaj</p>
              <h2 className="mt-1 text-3xl font-extrabold tracking-[-0.035em]">Atrakcje w pobliżu</h2>
              <p className="mt-1 text-sm text-muted-foreground">Porównuj miejsca i ceny bezpośrednio na mapie.</p>
            </div>
          </div>

          <AttractionsView attractions={attractions} mobileImmersive />
        </section>
      </main>
    </div>
  )
}