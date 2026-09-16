import Link from "next/link"
import { ArrowLeft, MapPin, Star, Ticket } from "lucide-react"

import AttractionCard from "@/components/AttractionCard"
import { BottomNav } from "@/components/bottom-nav"
import { TopNav } from "@/components/top-nav"
import {
  getSeoAttractionPath,
  getSeoLandingDescription,
  getSeoLandingPath,
  isSeoCategoryIndexable,
  type SeoCatalogCity,
  type SeoLandingData,
} from "@/lib/seo/landings"

export function MarketplaceSeoLanding({
  landing,
  catalogCity,
}: {
  landing: SeoLandingData
  catalogCity: SeoCatalogCity
}) {
  if (!landing.location) return null

  const title = landing.category
    ? `${landing.category.name}: ${landing.location.name}`
    : `Atrakcje: ${landing.location.name}`
  const indexableCategories = catalogCity.categories.filter(isSeoCategoryIndexable)

  return (
    <div className="min-h-screen bg-[#fffdf9] pb-24 md:pb-10">
      <TopNav />

      <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <nav aria-label="Okruszki" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">EnjoyHub</Link>
          <span aria-hidden="true">/</span>
          <Link href="/attractions" className="hover:text-foreground">Atrakcje</Link>
          <span aria-hidden="true">/</span>
          {landing.category ? (
            <>
              <Link href={getSeoLandingPath(landing.location.slug)} className="hover:text-foreground">
                {landing.location.name}
              </Link>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-foreground">{landing.category.name}</span>
            </>
          ) : (
            <span className="font-medium text-foreground">{landing.location.name}</span>
          )}
        </nav>

        <section className="overflow-hidden rounded-[30px] border border-[#0b1220]/[0.07] bg-white px-5 py-7 shadow-[0_18px_60px_rgba(11,18,32,0.08)] sm:px-8 sm:py-9 lg:px-10">
          {landing.category ? (
            <Link
              href={getSeoLandingPath(landing.location.slug)}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Wszystkie atrakcje: {landing.location.name}
            </Link>
          ) : null}

          <div className="max-w-4xl">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
              <MapPin className="h-4 w-4" /> {landing.location.name}, {landing.location.country}
            </p>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-[#0b1220] sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              {getSeoLandingDescription(landing)}
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Miejsca</p>
              <p className="mt-1 text-2xl font-black text-foreground">{landing.stats.total}</p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rezerwacja online</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black text-foreground">
                <Ticket className="h-5 w-5 text-primary" /> {landing.stats.onlineSalesCount}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cena od</p>
              <p className="mt-1 text-2xl font-black text-foreground">
                {landing.stats.priceFrom !== null ? `${Math.round(landing.stats.priceFrom)} zł` : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oceny</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black text-foreground">
                <Star className="h-5 w-5 fill-primary text-primary" />
                {landing.stats.averageRating !== null ? landing.stats.averageRating.toFixed(1) : "—"}
              </p>
            </div>
          </div>
        </section>

        {!landing.category && indexableCategories.length > 0 ? (
          <section className="py-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-[#0b1220]">Kategorie w {landing.location.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pokazujemy tylko kategorie z wystarczającą liczbą kompletnych profili.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {indexableCategories.map((category) => (
                <Link
                  key={category.slug}
                  href={getSeoLandingPath(catalogCity.slug, category.slug)}
                  className="rounded-full border bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  {category.name} <span className="ml-1 text-muted-foreground">({category.activeCount})</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className={landing.category ? "py-8" : "pb-8"}>
          <div className="mb-5">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#0b1220]">
              {landing.category ? `${landing.category.name} – miejsca` : `Miejsca w ${landing.location.name}`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Dane pochodzą z aktualnie opublikowanych profili EnjoyHub.</p>
          </div>

          {landing.items.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {landing.items.map((item) => (
                <AttractionCard
                  key={item.id}
                  images={item.images}
                  title={item.title}
                  city={item.city}
                  region=""
                  country={item.country}
                  rating={item.avgRating}
                  reviewsCount={item.reviewCount}
                  price={0}
                  priceUnit="osobę"
                  isInstantBookable={item.hasOnlineSales}
                  href={getSeoAttractionPath(item)}
                  priceFrom={item.priceFrom}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed bg-white p-8 text-center text-muted-foreground">
              Brak aktywnych obiektów w tej kombinacji.
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
