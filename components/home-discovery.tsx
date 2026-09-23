"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ArrowRight, CalendarDays, MapPin, Search, ShieldCheck, TicketCheck } from "lucide-react"

import AttractionsView from "@/components/attractions-view"
import { CategoryBar } from "@/components/category-bar"
import { TopNav } from "@/components/top-nav"
import { Button } from "@/components/ui/button"
import { publicAttractionPath } from "@/lib/marketplace/attraction-path"

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
  property_type: string
  category_slug?: string | null
  category_icon?: string | null
  category_image_url?: string | null
  subcategory_slug?: string | null
  subcategory_icon?: string | null
  subcategory_image_url?: string | null
  max_guests: number
  images?: string[]
  avgRating?: number
  reviewCount?: number
  amenities?: string[]
  nextAvailableSlot?: {
    date: string
    startTime: string
    availableCapacity?: number
  } | null
  priceFrom?: number | null
  hasOnlineSales?: boolean
}

export function HomeDiscovery({ attractions }: { attractions: Attraction[] }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const featured = attractions
    .filter((attraction) => attraction.images?.some(Boolean))
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-[1200] bg-background/95 backdrop-blur-xl">
        <TopNav onSearchClick={() => setSearchOpen(true)} />
        <CategoryBar useNavigation />
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <main>
        <section className="border-b border-[#0b1220]/[0.06]">
          <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-12 lg:px-8 lg:py-14">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Odkrywaj · wybieraj · rezerwuj
              </p>

              <h1 className="mt-4 text-[2.55rem] font-semibold leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-[4rem]">
                Znajdź doświadczenie, które naprawdę chcecie przeżyć.
              </h1>

              <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-base">
                Atrakcje, aktywności i miejsca na wolny czas. Porównaj zdjęcia, lokalizację, dostępne terminy i cenę bez przeskakiwania między stronami.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => setSearchOpen(true)}
                  size="lg"
                  className="h-13 rounded-2xl px-6 text-[15px] font-semibold shadow-none"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Czego szukasz?
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-13 rounded-2xl border-[#0b1220]/10 bg-background px-6 text-[15px] font-semibold shadow-none"
                >
                  <a href="#odkrywaj">
                    Odkrywaj na mapie
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-[#0b1220]/[0.07] pt-5 text-xs text-muted-foreground">
                <div className="space-y-1.5">
                  <MapPin className="h-4 w-4 text-foreground" />
                  <p>miejsca blisko Ciebie</p>
                </div>
                <div className="space-y-1.5">
                  <CalendarDays className="h-4 w-4 text-foreground" />
                  <p>realne terminy</p>
                </div>
                <div className="space-y-1.5">
                  <TicketCheck className="h-4 w-4 text-foreground" />
                  <p>rezerwacja online</p>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              {featured.length ? (
                <div className="grid h-[340px] grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-[28px] bg-muted sm:h-[440px] lg:h-[500px]">
                  {featured.map((attraction, index) => (
                    <Link
                      key={attraction.id}
                      href={publicAttractionPath(attraction)}
                      className={
                        index === 0
                          ? "group relative col-span-2 row-span-1 overflow-hidden sm:col-span-1 sm:row-span-2"
                          : "group relative overflow-hidden"
                      }
                    >
                      <Image
                        src={attraction.images?.find(Boolean) || "/placeholder.jpg"}
                        alt={attraction.title}
                        fill
                        priority={index === 0}
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                        sizes={index === 0 ? "(max-width: 640px) 100vw, 50vw" : "(max-width: 640px) 50vw, 25vw"}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent p-4 pt-10 text-white">
                        {index === 0 ? (
                          <>
                            <p className="text-xs font-medium text-white/80">{attraction.city}</p>
                            <p className="mt-1 line-clamp-2 text-lg font-semibold leading-tight">{attraction.title}</p>
                          </>
                        ) : (
                          <p className="line-clamp-2 text-sm font-semibold leading-tight">{attraction.title}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex h-[340px] items-end rounded-[28px] bg-muted p-6 sm:h-[440px] lg:h-[500px]">
                  <div className="max-w-sm">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    <p className="mt-3 text-xl font-semibold tracking-tight">Tu pojawią się najlepsze zdjęcia atrakcji.</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      EnjoyHub stawia doświadczenia na pierwszym planie — bez dekoracji konkurujących z treścią.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="odkrywaj" className="mx-auto max-w-[1600px] px-3 py-7 sm:px-6 sm:py-10">
          <div className="mb-5 flex items-end justify-between gap-4 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Odkrywaj</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Atrakcje w pobliżu</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Wybierz miejsce z listy albo mapy. Kontekst mapy pozostaje bez zmian, gdy przeglądasz kolejne obiekty.
              </p>
            </div>
          </div>

          <AttractionsView attractions={attractions} />
        </section>
      </main>
    </div>
  )
}
