"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { slug: "paintball", name: "Paintball", icon: "🎯" },
  { slug: "gokarty", name: "Gokarty", icon: "🏎️" },
  { slug: "escape-room", name: "Escape Room", icon: "🔐" },
  { slug: "park-linowy", name: "Park Linowy", icon: "🌲" },
  { slug: "trampoliny", name: "Trampoliny", icon: "🤸" },
  { slug: "aquapark", name: "Aquapark", icon: "🏊" },
  { slug: "strzelnica", name: "Strzelnica", icon: "🎯" },
  { slug: "quady-offroad", name: "Quady / Offroad", icon: "🏍️" },
]

interface CategoryTabsProps {
  selectedCategory?: string
  onCategorySelect: (category: string | null) => void
}

export function CategoryTabs({ selectedCategory, onCategorySelect }: CategoryTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener("resize", checkScroll)
    return () => window.removeEventListener("resize", checkScroll)
  }, [])

  return (
    <div className="sticky top-[64px] z-40 bg-background border-b">
      <div className="relative">
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-center gap-2 md:gap-4 px-4 py-4 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* All Categories */}
          <Button
            variant={!selectedCategory ? "default" : "ghost"}
            onClick={() => onCategorySelect(null)}
            className={cn(
              "flex-shrink-0 h-auto py-2 px-4 rounded-xl",
              !selectedCategory && "border-2 border-primary"
            )}
          >
            <span className="text-sm font-medium">Wszystkie</span>
          </Button>

          {/* Category Buttons */}
          {CATEGORIES.map((category) => (
            <Button
              key={category.slug}
              variant={selectedCategory === category.slug ? "default" : "ghost"}
              onClick={() => onCategorySelect(category.slug)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center gap-1 h-auto py-2 px-4 rounded-xl min-w-[80px]",
                selectedCategory === category.slug && "border-2 border-primary"
              )}
            >
              <span className="text-2xl">{category.icon}</span>
              <span className="text-xs font-medium text-center whitespace-nowrap">
                {category.name}
              </span>
            </Button>
          ))}
        </div>

        {/* Scroll indicators for mobile */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none md:hidden" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
        )}
      </div>
    </div>
  )
}
