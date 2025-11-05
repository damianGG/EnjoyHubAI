"use client"

import { useState, useEffect } from "react"
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
  useNavigation?: boolean // If true, use Link navigation instead of callback
}

export function CategoryBar({ selectedCategory, onCategorySelect, useNavigation = false }: CategoryBarProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

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
        {useNavigation ? (
          <Link href="/k/all">
            <Button
              variant={!selectedCategory ? "default" : "ghost"}
              size="sm"
              className="flex flex-col items-center space-y-1 md:space-y-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl"
            >
              <div className="w-6 md:w-8 h-6 md:h-8 flex items-center justify-center">
                <div className="w-4 md:w-6 h-4 md:h-6 border-2 border-current rounded" />
              </div>
              <span className="text-xs font-medium text-center leading-tight">Wszystkie</span>
            </Button>
          </Link>
        ) : (
          <Button
            variant={!selectedCategory ? "default" : "ghost"}
            size="sm"
            onClick={() => onCategorySelect?.(null)}
            className="flex flex-col items-center space-y-1 md:space-y-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl"
          >
            <div className="w-6 md:w-8 h-6 md:h-8 flex items-center justify-center">
              <div className="w-4 md:w-6 h-4 md:h-6 border-2 border-current rounded" />
            </div>
            <span className="text-xs font-medium text-center leading-tight">Wszystkie</span>
          </Button>
        )}

        {/* Category Buttons */}
        {categories.map((category) => {
          const buttonContent = (
            <>
              <span className="text-2xl md:text-3xl">{category.icon}</span>
              <span className="text-xs font-medium text-center leading-tight">{category.name}</span>
            </>
          )

          return useNavigation ? (
            <Link href={`/k/${category.slug}`} key={category.id}>
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
              onClick={() => onCategorySelect?.(category.slug)}
              className="flex flex-col items-center space-y-1 md:space-y-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl hover:bg-muted/50 transition-colors"
            >
              {buttonContent}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 h-auto py-2 md:py-3 px-3 md:px-4 min-w-[70px] md:min-w-[80px] flex-shrink-0 rounded-xl bg-transparent border-2"
        >
          <SlidersHorizontal className="w-4 md:w-5 h-4 md:h-5" />
          <span className="text-xs font-medium">Filtry</span>
        </Button>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
