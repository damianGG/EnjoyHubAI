"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback, useRef } from "react"

interface SetManyOptions {
  debounce?: number | boolean
  debounceMs?: number
}

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
        
        // Apply all updates
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined || value === "") {
            params.delete(key)
          } else {
            params.set(key, String(value))
          }
        })

        // Replace the URL without adding to history
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }

      // Determine debounce value
      const debounceValue = typeof options?.debounce === 'number' 
        ? options.debounce 
        : options?.debounceMs || (options?.debounce ? 300 : 0)

      if (debounceValue > 0) {
        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }

        // Set new timer
        debounceTimerRef.current = setTimeout(() => {
          performUpdate()
          debounceTimerRef.current = null
        }, debounceValue)
      } else {
        // Execute immediately
        performUpdate()
      }
    },
    [searchParams, router, pathname]
  )

  return { get, setMany }
}
