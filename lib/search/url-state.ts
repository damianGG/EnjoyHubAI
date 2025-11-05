"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback, useRef } from "react"

/**
 * Hook for managing URL search params with debounced updates
 * Provides utilities to get and set query parameters while keeping URL as source of truth
 */
export function useUrlState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Get a query parameter value
   */
  const get = useCallback(
    (key: string): string | null => {
      return searchParams.get(key)
    },
    [searchParams]
  )

  /**
   * Get all current query parameters as an object
   */
  const getAll = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })
    return params
  }, [searchParams])

  /**
   * Set multiple query parameters at once
   * @param updates - Object with key-value pairs to update
   * @param options - Optional configuration
   * @param options.debounce - Whether to debounce the update (default: false)
   * @param options.debounceMs - Debounce delay in milliseconds (default: 300)
   * @param options.replace - Whether to replace or push history (default: true for replace)
   */
  const setMany = useCallback(
    (
      updates: Record<string, string | number | null | undefined>,
      options?: { debounce?: boolean; debounceMs?: number; replace?: boolean }
    ) => {
      const { debounce = false, debounceMs = 300, replace = true } = options || {}

      const updateUrl = () => {
        const params = new URLSearchParams(searchParams.toString())

        // Apply updates
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined || value === "") {
            // Remove empty values to keep URL clean
            params.delete(key)
          } else {
            params.set(key, String(value))
          }
        })

        // Build new URL
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname

        // Update URL
        if (replace) {
          router.replace(newUrl, { scroll: false })
        } else {
          router.push(newUrl, { scroll: false })
        }
      }

      if (debounce) {
        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }

        // Set new timer
        debounceTimerRef.current = setTimeout(() => {
          updateUrl()
          debounceTimerRef.current = null
        }, debounceMs)
      } else {
        updateUrl()
      }
    },
    [searchParams, pathname, router]
  )

  /**
   * Set a single query parameter
   */
  const set = useCallback(
    (key: string, value: string | number | null | undefined, options?: { debounce?: boolean; debounceMs?: number }) => {
      setMany({ [key]: value }, options)
    },
    [setMany]
  )

  /**
   * Remove a query parameter
   */
  const remove = useCallback(
    (key: string) => {
      setMany({ [key]: null })
    },
    [setMany]
  )

  /**
   * Remove multiple query parameters
   */
  const removeMany = useCallback(
    (keys: string[]) => {
      const updates: Record<string, null> = {}
      keys.forEach((key) => {
        updates[key] = null
      })
      setMany(updates)
    },
    [setMany]
  )

  /**
   * Clear all query parameters
   */
  const clear = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [pathname, router])

  return {
    get,
    getAll,
    set,
    setMany,
    remove,
    removeMany,
    clear,
  }
}
