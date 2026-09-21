'use client'

import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getEnjoyHubCategoryIcon } from '@/lib/category-icon-assets'
import Image from 'next/image'
import type { Subcategory } from './scrollable-category-nav'

interface ScrollableSubcategoryNavProps {
  subcategories: Subcategory[]
  selectedSubcategory?: string | null
  onSubcategorySelect: (subcategorySlug: string | null) => void
  onClose: () => void
  parentCategoryName: string
  compact?: boolean
}

export function ScrollableSubcategoryNav({
  subcategories,
  selectedSubcategory,
  onSubcategorySelect,
  onClose,
  parentCategoryName,
  compact = false,
}: ScrollableSubcategoryNavProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftButton, setShowLeftButton] = useState(false)
  const [showRightButton, setShowRightButton] = useState(false)

  const checkScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return

    setShowLeftButton(container.scrollLeft > 4)
    setShowRightButton(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 4
    )
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
  }, [subcategories])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    container.scrollTo({
      left: container.scrollLeft + (direction === 'left' ? -300 : 300),
      behavior: 'smooth',
    })
  }

  const tileClassName = (selected: boolean) => cn(
    'shrink-0 transition-all duration-200',
    compact
      ? 'flex items-center gap-1.5 rounded-full border px-2.5 py-1 whitespace-nowrap'
      : 'flex min-w-[82px] flex-col items-center gap-2 rounded-2xl border px-2 py-2 md:min-w-[60px] md:max-w-[120px] md:gap-1 md:rounded-lg md:px-2 md:py-1.5',
    selected
      ? 'translate-y-px border-primary/35 bg-primary/[0.07] text-primary shadow-[inset_0_2px_5px_rgba(11,18,32,0.08),0_5px_16px_rgba(255,90,31,0.10)]'
      : 'border-transparent bg-white text-foreground hover:border-primary/15 hover:text-primary'
  )

  const renderSubcategoryVisual = (subcategory: Subcategory, selected: boolean) => {
    const localImage = getEnjoyHubCategoryIcon(subcategory.slug)
    const imageUrl = localImage || subcategory.image_url

    if (imageUrl) {
      return (
        <span className={cn(
          'relative h-12 w-12 overflow-hidden rounded-[15px] bg-gradient-to-br from-secondary to-white shadow-[0_8px_18px_rgba(11,18,32,0.10)] ring-1 md:h-4 md:w-4 md:rounded-full md:shadow-none',
          selected ? 'ring-primary/35' : 'ring-[#0b1220]/[0.05]'
        )}>
          <Image
            src={imageUrl}
            alt=""
            fill
            className={localImage ? 'object-contain p-1' : 'object-cover'}
            sizes="48px"
          />
        </span>
      )
    }

    if (subcategory.icon) {
      return (
        <span className={cn(
          'grid h-12 w-12 place-items-center rounded-[15px] bg-gradient-to-br from-secondary via-white to-[#fff8f4] text-[28px] shadow-[0_8px_18px_rgba(11,18,32,0.10)] ring-1 md:h-4 md:w-4 md:rounded-full md:bg-transparent md:text-lg md:shadow-none md:ring-0',
          selected ? 'ring-primary/35' : 'ring-[#0b1220]/[0.05]'
        )}>
          {subcategory.icon}
        </span>
      )
    }

    return (
      <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-secondary text-xl text-primary md:h-4 md:w-4 md:bg-transparent md:text-sm">
        •
      </span>
    )
  }

  return (
    <div className="relative w-full border-b border-[#0b1220]/[0.055] bg-white/95 backdrop-blur-xl">
      <div className="relative flex items-center">
        {!compact && (
          <div className="hidden items-center gap-1.5 pl-3 md:flex">
            <span className="text-xs font-medium text-muted-foreground">
              {parentCategoryName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onClose}
              aria-label={`Wyczyść kategorię ${parentCategoryName}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {showLeftButton && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 z-20 hidden h-9 w-9 rounded-full border-[#0b1220]/10 bg-white/95 shadow-lg md:flex"
            onClick={() => scroll('left')}
            aria-label="Przewiń podkategorie w lewo"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className={cn(
            'hide-scrollbar flex flex-1 overflow-x-auto overflow-y-hidden scroll-smooth',
            compact ? 'gap-2 px-4 py-1.5' : 'gap-2.5 px-3 py-2.5 md:gap-2 md:px-4 md:py-2'
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => onSubcategorySelect(null)}
            className={tileClassName(!selectedSubcategory)}
            aria-pressed={!selectedSubcategory}
          >
            {!compact && (
              <span className={cn(
                'grid h-12 w-12 place-items-center rounded-[15px] shadow-[0_8px_18px_rgba(11,18,32,0.10)] ring-1 md:h-4 md:w-4 md:rounded-full md:shadow-none md:ring-0',
                !selectedSubcategory
                  ? 'bg-primary text-white ring-primary/30'
                  : 'bg-gradient-to-br from-secondary to-white text-primary ring-[#0b1220]/[0.05]'
              )}>
                <Sparkles className="h-5 w-5 md:h-3.5 md:w-3.5" />
              </span>
            )}
            <span className={cn(
              'block max-w-[104px] truncate whitespace-nowrap text-center font-semibold',
              compact ? 'text-xs' : 'text-[11px] md:text-[10px]'
            )}>
              Wszystkie
            </span>
          </button>

          {subcategories.map((subcategory) => {
            const selected = selectedSubcategory === subcategory.slug

            return (
              <button
                key={subcategory.id}
                onClick={() => onSubcategorySelect(subcategory.slug)}
                className={tileClassName(selected)}
                aria-pressed={selected}
              >
                {!compact && renderSubcategoryVisual(subcategory, selected)}
                <span className={cn(
                  'block max-w-[104px] truncate whitespace-nowrap text-center font-semibold',
                  compact ? 'text-xs' : 'text-[11px] md:text-[10px]'
                )}>
                  {subcategory.name}
                </span>
              </button>
            )
          })}
        </div>

        {showRightButton && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 z-20 hidden h-9 w-9 rounded-full border-[#0b1220]/10 bg-white/95 shadow-lg md:flex"
            onClick={() => scroll('right')}
            aria-label="Przewiń podkategorie w prawo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
