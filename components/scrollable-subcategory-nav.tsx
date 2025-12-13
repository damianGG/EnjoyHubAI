'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

    setShowLeftButton(container.scrollLeft > 0)
    setShowRightButton(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    )
  }

  useEffect(() => {
    checkScroll()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      return () => {
        container.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [subcategories])

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = 300
    const targetScroll =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    })
  }

  const renderSubcategoryIcon = (subcategory: Subcategory) => {
    if (subcategory.image_url) {
      return (
        <div className="relative w-4 h-4 rounded-full overflow-hidden">
          <Image
            src={subcategory.image_url}
            alt={subcategory.name}
            fill
            className="object-cover"
          />
        </div>
      )
    }
    if (subcategory.icon) {
      return <span className="text-base">{subcategory.icon}</span>
    }
    return <span>•</span>
  }

  return (
    <div className="relative w-full bg-card">
      <div className="relative flex items-center">
        {!compact && (
          <div className="flex items-center gap-1.5 pl-3">
            <span className="text-xs font-medium text-muted-foreground">
              {parentCategoryName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {showLeftButton && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 z-10 h-full rounded-none bg-gradient-to-r from-card via-card to-transparent px-2 hover:bg-card"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className={cn(
            "hide-scrollbar flex flex-1 gap-2 overflow-x-auto overflow-y-hidden px-4",
            compact ? "py-1.5" : "py-2"
          )}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {subcategories.map((subcategory) => (
            <button
              key={subcategory.id}
              onClick={() => onSubcategorySelect(subcategory.slug)}
              className={cn(
                compact 
                  ? 'flex items-center gap-1.5 rounded-full px-2.5 py-1 whitespace-nowrap'
                  : 'flex min-w-[60px] max-w-[80px] flex-col items-center gap-1 rounded-lg px-2 py-1.5',
                selectedSubcategory === subcategory.slug
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'bg-card text-card-foreground hover:bg-card/80'
              )}
            >
              {!compact && (
                <div className="flex h-4 w-4 items-center justify-center">
                  {renderSubcategoryIcon(subcategory)}
                </div>
              )}
              <span className={cn(
                "block truncate text-center font-medium",
                compact ? "text-xs" : "w-full text-[10px]"
              )}>
                {subcategory.name}
              </span>
            </button>
          ))}
        </div>

        {showRightButton && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 z-10 h-full rounded-none bg-gradient-to-l from-card via-card to-transparent px-2 hover:bg-card"
            onClick={() => scroll('right')}
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
