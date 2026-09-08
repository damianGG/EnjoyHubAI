"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback, useRef } from "react"

interface SetManyOptions {
  debounce?: number | boolean
  debounceMs?: number
}

const MARKETPLACE_SEARCH_KEYS = new Set([
  "categories",
  "q",
  "date",
  "guests",
  "age_min",
  "age_max",
])

export function useUrlState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const get = useCallback(
    (key: string): string | null => {
      return searchParams.get(key)
    },
    [searchParams]
  )

  const setMany = useCallback(
    (updates: Record<string, string | number | null | undefined>, options?: SetManyOptions) => {
      const performUpdate = () => {
        const params = new URLSearchParams(searchParams.toString())

        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined || value === "") {
            params.delete(key)
          } else {
            params.set(key, String(value))
          }
        })

        const isMarketplaceSearch = Object.keys(updates).some((key) => MARKETPLACE_SEARCH_KEYS.has(key))
        const targetPath = pathname === "/" && isMarketplaceSearch ? "/attractions" : pathname
        const query = params.toString()

        router.replace(query ? `${targetPath}?${query}` : targetPath, { scroll: false })
      }

      const debounceValue = typeof options?.debounce === "number"
        ? options.debounce
        : options?.debounceMs || (options?.debounce ? 300 : 0)

      if (debounceValue > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }

        debounceTimerRef.current = setTimeout(() => {
          performUpdate()
          debounceTimerRef.current = null
        }, debounceValue)
      } else {
        performUpdate()
      }
    },
    [searchParams, router, pathname]
  )

  return { get, setMany }
}
