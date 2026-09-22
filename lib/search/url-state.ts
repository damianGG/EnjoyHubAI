"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

interface SetManyOptions {
  debounce?: number | boolean
  debounceMs?: number
  navigateToResults?: boolean
}

export const MARKETPLACE_SEARCH_PARAM_KEYS = [
  "categories",
  "q",
  "date",
  "date_from",
  "date_to",
  "when",
  "guests",
  "age_min",
  "age_max",
  "min_price",
  "max_price",
  "types",
  "amenities",
  "attrs",
  "sort",
  "bbox",
] as const

export type MarketplaceSearchParamKey = (typeof MARKETPLACE_SEARCH_PARAM_KEYS)[number]

const MARKETPLACE_SEARCH_KEYS = new Set<string>(MARKETPLACE_SEARCH_PARAM_KEYS)

export function marketplaceSearchResetUpdates(
  preserve: readonly MarketplaceSearchParamKey[] = [],
): Record<string, null> {
  const preserved = new Set<string>(preserve)
  return Object.fromEntries(
    MARKETPLACE_SEARCH_PARAM_KEYS
      .filter((key) => !preserved.has(key))
      .map((key) => [key, null]),
  )
}

export function useUrlState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const get = useCallback(
    (key: string): string | null => {
      return searchParams.get(key)
    },
    [searchParams],
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
        const shouldNavigateToResults = options?.navigateToResults !== false
        const targetPath = pathname === "/" && isMarketplaceSearch && shouldNavigateToResults
          ? "/attractions"
          : pathname
        const query = params.toString()

        router.replace(query ? `${targetPath}?${query}` : targetPath, { scroll: false })
      }

      const debounceValue = typeof options?.debounce === "number"
        ? options.debounce
        : options?.debounceMs || (options?.debounce ? 300 : 0)

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      if (debounceValue > 0) {
        debounceTimerRef.current = setTimeout(() => {
          performUpdate()
          debounceTimerRef.current = null
        }, debounceValue)
      } else {
        performUpdate()
      }
    },
    [searchParams, router, pathname],
  )

  return { get, setMany }
}
