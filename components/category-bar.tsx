"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SlidersHorizontal } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string
}

interface CategoryBarProps {
  selectedCategory?: string
  onCategorySelect?: (categorySlug: string | null) => void
  onFiltersClick?: () => void
  activeFiltersCount?: number
  useNavigation?: boolean
}

export function CategoryBar({ selectedCategory, onCategorySelect, onFiltersClick, activeFiltersCount, useNavigation = false }: CategoryBarProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const s = createClient()
    s.from("categories")
      .select("id,name,slug,icon,description")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) setCategories(data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex space-x-4 p-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center space-y-2">
            <div className="w-16 h-16 bg-muted rounded-full animate-pulse" />
            <div className="w-20 h-4 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <ScrollArea className="w-full whitespace-nowrap border-b">
      <div className="flex items-center space-x-2 md:space-x-4 p-4">
        {/* All Categories Button */}
        <Button
          variant={!selectedCategory ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            if (useNavigation) {
              router.push("/attractions")
            }
            onCategorySelect?.(null)
          }}
          className="flex flex-col items-center space-y-1 md:space-y-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl"
        >
          <div className="w-6 md:w-8 h-6 md:h-8 flex items-center justify-center">
            <div className="w-4 md:w-6 h-4 md:h-6 border-2 border-current rounded" />
          </div>
          <span className="text-xs font-medium text-center leading-tight">Wszystkie</span>
        </Button>

        {/* Category Buttons */}
        {categories.map((category) => {
          const buttonContent = (
            <>
              <span className="text-2xl md:text-3xl">{category.icon}</span>
              <span className="text-xs font-medium text-center leading-tight">{category.name}</span>
            </>
          )

          return useNavigation ? (
            <Link href={`/attractions?categories=${category.slug}`} key={category.id}>
              <Button
                variant={selectedCategory === category.slug ? "default" : "ghost"}
                size="sm"
                className="flex flex-col items-center space-y-1 md:space-y-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl hover:bg-muted/50 transition-colors"
              >
                {buttonContent}
              </Button>
            </Link>
          ) : (
            <Button
              key={category.id}
              variant={selectedCategory === category.slug ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                if (useNavigation) {
                  router.push(`/attractions?categories=${category.slug}`)
                }
                onCategorySelect?.(category.slug)
              }}
              className="flex flex-col items-center space-y-1 md:space-y-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl hover:bg-muted/50 transition-colors"
            >
              {buttonContent}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={onFiltersClick}
          className="flex items-center space-x-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl bg-transparent border-2 relative"
        >
          <SlidersHorizontal className="w-4 md:w-5 h-4 md:h-5" />
          <span className="text-xs font-medium">Filtry</span>
          {activeFiltersCount && activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
