import Link from "next/link"
import { ArrowRight } from "lucide-react"

import AttractionCard from "@/components/AttractionCard"
import { Button } from "@/components/ui/button"
import { getSeoAttractionPath } from "@/lib/seo/landings"
import type { SeoRelatedSection } from "@/lib/seo/internal-linking"

export function RelatedAttractions({ sections }: { sections: SeoRelatedSection[] }) {
  if (sections.length === 0) return null

  return (
    <section aria-label="Powiązane atrakcje" className="mt-10 space-y-10 border-t pt-9">
      {sections.map((section) => (
        <div key={section.path}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.03em] text-[#0b1220]">{section.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href={section.path}>
                Zobacz wszystkie <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {section.items.map((item) => (
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
        </div>
      ))}
    </section>
  )
}
