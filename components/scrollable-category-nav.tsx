'use client'

import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getEnjoyHubCategoryIcon } from '@/lib/category-icon-assets'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export interface Subcategory {
  id: string
  parent_category_id: string
  name: string
  slug: string
  icon?: string
  description?: string
  image_url?: string
  image_public_id?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string
  image_url?: string
  image_public_id?: string
  subcategories?: Subcategory[]
}

interface ScrollableCategoryNavProps {
  categories: Category[]
  selectedCategory?: string | null
  onCategorySelect: (categorySlug: string | null) => void
  useNavigation?: boolean
  compact?: boolean
}

export function ScrollableCategoryNav({
  categories,
  selectedCategory,
  onCategorySelect,
  useNavigation = false,
  compact = false,
}: ScrollableCategoryNavProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftButton, setShowLeftButton] = useState(false)
  const [showRightButton, setShowRightButton] = useState(false)
  const router = useRouter()

  const checkScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    setShowLeftButton(container.scrollLeft > 4)
    setShowRightButton(container.scrollLeft < container.scrollWidth - container.clientWidth - 4)
  }

  useEffect(() => {
    checkScroll()
    const container = scrollContainerRef.current
    if (!container) return
    container.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      container.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [categories])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTo({
      left: container.scrollLeft + (direction === 'left' ? -360 : 360),
      behavior: 'smooth',
    })
  }

  const handleCategoryClick = (categorySlug: string) => {
    onCategorySelect(selectedCategory === categorySlug ? null : categorySlug)
  }

  const CategoryVisual = ({ category }: { category: Category }) => {
    const localImage = getEnjoyHubCategoryIcon(category.slug)
    const imageUrl = localImage || category.image_url

    if (imageUrl) {
      return (
        <span className="relative h-12 w-12 overflow-hidden rounded-[15px] bg-gradient-to-br from-orange-50 to-amber-50 shadow-[0_8px_18px_rgba(87,53,20,0.10)] ring-1 ring-black/[0.05] md:h-14 md:w-14">
          <Image
            src={imageUrl}
            alt=""
            fill
            className={localImage ? "object-contain p-1" : "object-cover"}
            sizes="56px"
          />
        </span>
      )
    }

    return (
      <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-gradient-to-br from-orange-50 via-white to-amber-50 text-[28px] shadow-[0_8px_18px_rgba(87,53,20,0.10)] ring-1 ring-black/[0.05] md:h-14 md:w-14 md:text-[31px]">
        {category.icon || '✨'}
      </span>
    )
  }

  return (
    <div className={cn(
      "relative w-full border-b border-black/[0.055] bg-white/95 backdrop-blur-xl",
      compact ? "shadow-[0_8px_24px_rgba(48,31,16,0.04)]" : ""
    )}>
      <div className="relative mx-auto flex max-w-[1600px] items-center px-1 md:px-3">
        {showLeftButton && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 z-20 h-9 w-9 rounded-full border-black/10 bg-white/95 shadow-lg md:left-4"
            onClick={() => scroll('left')}
            aria-label="Przewiń kategorie w lewo"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className={cn(
            "hide-scrollbar flex w-full overflow-x-auto overflow-y-hidden scroll-smooth",
            compact ? "gap-2 px-3 py-2.5 md:px-4" : "gap-2.5 px-3 py-3 md:gap-4 md:px-4 md:py-4"
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => {
              if (useNavigation) router.push('/attractions')
              onCategorySelect(null)
            }}
            className={cn(
              "shrink-0 transition-all",
              compact
                ? "brand-pill flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold"
                : "flex min-w-[82px] flex-col items-center gap-2 rounded-2xl px-2 py-1.5 md:min-w-[96px]",
              !selectedCategory ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {!compact && (
              <span className={cn(
                "grid h-12 w-12 place-items-center rounded-[15px] shadow-[0_8px_18px_rgba(87,53,20,0.10)] ring-1 ring-black/[0.05] md:h-14 md:w-14",
                !selectedCategory ? "bg-primary text-white" : "bg-gradient-to-br from-orange-50 to-white text-primary"
              )}>
                <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
              </span>
            )}
            <span className={cn("whitespace-nowrap font-semibold", compact ? "text-xs" : "text-[11px] md:text-xs")}>Wszystkie</span>
          </button>

          {categories.map((category) => {
            const selected = selectedCategory === category.slug
            const content = (
              <>
                {!compact && <CategoryVisual category={category} />}
                <span className={cn(
                  "max-w-[104px] truncate whitespace-nowrap text-center font-semibold",
                  compact ? "text-xs" : "text-[11px] md:text-xs"
                )}>
                  {category.name}
                </span>
              </>
            )

            const className = cn(
              "shrink-0 transition-all duration-200",
              compact
                ? "brand-pill flex h-9 items-center rounded-full px-4"
                : "flex min-w-[82px] flex-col items-center gap-2 rounded-2xl px-2 py-1.5 md:min-w-[96px]",
              selected ? "text-primary" : "text-muted-foreground hover:-translate-y-0.5 hover:text-foreground"
            )

            return useNavigation ? (
              <Link href={`/attractions?categories=${category.slug}`} key={category.id}>
                <button onClick={() => onCategorySelect(category.slug)} className={className}>{content}</button>
              </Link>
            ) : (
              <button key={category.id} onClick={() => handleCategoryClick(category.slug)} className={className}>{content}</button>
            )
          })}
        </div>

        {showRightButton && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 z-20 h-9 w-9 rounded-full border-black/10 bg-white/95 shadow-lg md:right-4"
            onClick={() => scroll('right')}
            aria-label="Przewiń kategorie w prawo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
