'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { parseSearchParams, buildSearchParams, updateSearchParams } from '@/lib/urlSearch'

interface AttributeDefinition {
  id: number
  key: string
  label: string
  type: 'boolean' | 'enum' | 'number' | 'range' | 'string'
  category_slug?: string | null
  options?: any
  active: boolean
  sort_order: number
}

interface SearchFiltersProps {
  categories?: { slug: string; label: string }[]
}

/**
 * SearchFilters - Dynamic filters UI driven by attribute definitions
 * - Text search (q)
 * - Category selection
 * - Dynamic attribute filters fetched from /api/attributes
 * - Sort options
 * All changes update URL and trigger refetch
 */
export default function SearchFilters({ categories = [] }: SearchFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = parseSearchParams(searchParams)

  const [attributes, setAttributes] = useState<AttributeDefinition[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch attribute definitions on mount
  useEffect(() => {
    setLoading(true)
    fetch('/api/attributes')
      .then((res) => res.json())
      .then((data) => {
        setAttributes(data.attributes || [])
      })
      .catch((err) => {
        console.error('Failed to fetch attributes:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Update URL helper
  const updateParams = (updates: Partial<typeof params>) => {
    const updatedParams = updateSearchParams(params, updates)
    const newSearchParams = buildSearchParams(updatedParams)
    router.push(`/search?${newSearchParams.toString()}`)
  }

  // Handle text search
  const handleSearchChange = (q: string) => {
    updateParams({ q: q || undefined })
  }

  // Handle category toggle
  const handleCategoryToggle = (slug: string) => {
    const current = params.categories || []
    const updated = current.includes(slug)
      ? current.filter((c) => c !== slug)
      : [...current, slug]
    updateParams({ categories: updated.length > 0 ? updated : undefined })
  }

  // Handle sort change
  const handleSortChange = (sort: 'distance' | 'rating' | 'popular') => {
    updateParams({ sort })
  }

  // Handle attribute filter change
  const handleAttributeChange = (key: string, value: string | undefined) => {
    const current = params.af || {}
    const updated = { ...current }
    if (value === undefined || value === '') {
      delete updated[key]
    } else {
      updated[key] = value
    }
    updateParams({ af: Object.keys(updated).length > 0 ? updated : undefined })
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow">
      {/* Text search */}
      <div>
        <label htmlFor="search-q" className="block text-sm font-medium mb-1">
          Szukaj
        </label>
        <input
          id="search-q"
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Wpisz nazwę lub opis..."
          defaultValue={params.q || ''}
          onBlur={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearchChange(e.currentTarget.value)
            }
          }}
        />
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">Kategorie</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isActive = params.categories?.includes(cat.slug)
              return (
                <button
                  key={cat.slug}
                  onClick={() => handleCategoryToggle(cat.slug)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Sort */}
      <div>
        <label htmlFor="search-sort" className="block text-sm font-medium mb-1">
          Sortuj
        </label>
        <select
          id="search-sort"
          className="w-full px-3 py-2 border rounded-md"
          value={params.sort || 'popular'}
          onChange={(e) =>
            handleSortChange(e.target.value as 'distance' | 'rating' | 'popular')
          }
        >
          <option value="popular">Popularne</option>
          <option value="rating">Najlepiej oceniane</option>
          <option value="distance">Najbliższe</option>
        </select>
      </div>

      {/* Dynamic attribute filters */}
      {loading && <div className="text-sm text-gray-500">Ładowanie filtrów...</div>}
      {attributes.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium">Filtry</div>
          {attributes.map((attr) => {
            const currentValue = params.af?.[attr.key]

            if (attr.type === 'boolean') {
              return (
                <div key={attr.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`attr-${attr.key}`}
                    checked={currentValue === 'true'}
                    onChange={(e) =>
                      handleAttributeChange(attr.key, e.target.checked ? 'true' : undefined)
                    }
                    className="rounded"
                  />
                  <label htmlFor={`attr-${attr.key}`} className="text-sm">
                    {attr.label}
                  </label>
                </div>
              )
            }

            if (attr.type === 'enum' && Array.isArray(attr.options)) {
              return (
                <div key={attr.key}>
                  <label htmlFor={`attr-${attr.key}`} className="block text-sm mb-1">
                    {attr.label}
                  </label>
                  <select
                    id={`attr-${attr.key}`}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={currentValue || ''}
                    onChange={(e) =>
                      handleAttributeChange(attr.key, e.target.value || undefined)
                    }
                  >
                    <option value="">Wszystkie</option>
                    {attr.options.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )
            }

            if (attr.type === 'number') {
              return (
                <div key={attr.key}>
                  <label htmlFor={`attr-${attr.key}`} className="block text-sm mb-1">
                    {attr.label}
                  </label>
                  <input
                    id={`attr-${attr.key}`}
                    type="number"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={currentValue || ''}
                    onChange={(e) =>
                      handleAttributeChange(attr.key, e.target.value || undefined)
                    }
                  />
                </div>
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}
