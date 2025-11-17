'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
}

export function ScrollableCategoryNav({
  categories,
  selectedCategory,
  onCategorySelect,
  useNavigation = false,
}: ScrollableCategoryNavProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftButton, setShowLeftButton] = useState(false)
  const [showRightButton, setShowRightButton] = useState(false)
  const router = useRouter()

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
  }, [categories])

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

  const handleCategoryClick = (categorySlug: string) => {
    if (selectedCategory === categorySlug) {
      onCategorySelect(null)
    } else {
      onCategorySelect(categorySlug)
    }
  }

  const renderCategoryIcon = (category: Category) => {
    if (category.image_url) {
      return (
        <div className="relative w-6 h-6 rounded-full overflow-hidden">
          <Image
            src={category.image_url}
            alt={category.name}
            fill
            className="object-cover"
          />
        </div>
      )
    }
    return <span className="text-2xl">{category.icon}</span>
  }

  return (
    <div className="relative w-full border-b border-border bg-card">
      <div className="relative flex items-center">
        {showLeftButton && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 z-10 h-full rounded-none bg-gradient-to-r from-card via-card to-transparent px-2 hover:bg-card"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className="hide-scrollbar flex gap-2 overflow-x-auto px-4 py-3"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* All Categories Button */}
          <button
            onClick={() => {
              if (useNavigation) {
                router.push('/attractions')
              }
              onCategorySelect(null)
            }}
            className={cn(
              'flex min-w-[80px] max-w-[100px] flex-col items-center gap-1.5 rounded-lg px-3 py-3 transition-all duration-200',
              !selectedCategory
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            <div className="flex h-6 w-6 items-center justify-center">
              <div className="w-4 h-4 border-2 border-current rounded" />
            </div>
            <span className="block w-full truncate text-center text-xs font-medium">
              Wszystkie
            </span>
          </button>

          {categories.map((category) => {
            const buttonContent = (
              <>
                <div className="flex h-6 w-6 items-center justify-center">
                  {renderCategoryIcon(category)}
                </div>
                <span className="block w-full truncate text-center text-xs font-medium">
                  {category.name}
                </span>
              </>
            )

            return useNavigation ? (
              <Link href={`/attractions?categories=${category.slug}`} key={category.id}>
                <button
                  onClick={() => onCategorySelect(category.slug)}
                  className={cn(
                    'flex min-w-[80px] max-w-[100px] flex-col items-center gap-1.5 rounded-lg px-3 py-3 transition-all duration-200',
                    selectedCategory === category.slug
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : selectedCategory && selectedCategory !== category.slug
                        ? 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  )}
                >
                  {buttonContent}
                </button>
              </Link>
            ) : (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.slug)}
                className={cn(
                  'flex min-w-[80px] max-w-[100px] flex-col items-center gap-1.5 rounded-lg px-3 py-3 transition-all duration-200',
                  selectedCategory === category.slug
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : selectedCategory && selectedCategory !== category.slug
                      ? 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
              >
                {buttonContent}
              </button>
            )
          })}
        </div>

        {showRightButton && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 z-10 h-full rounded-none bg-gradient-to-l from-card via-card to-transparent px-2 hover:bg-card"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-5 w-5" />
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
