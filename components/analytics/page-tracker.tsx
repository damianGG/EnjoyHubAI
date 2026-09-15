"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { trackAnalyticsEvent } from "@/lib/analytics/client"
import { extractIdFromSlug } from "@/lib/utils"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function AnalyticsPageTracker() {
  const pathname = usePathname()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || lastTracked.current === pathname) return
    lastTracked.current = pathname

    const attractionMatch = pathname.match(/^\/attractions\/([^/]+)$/)
    if (attractionMatch) {
      const attractionId = extractIdFromSlug(attractionMatch[1])
      if (UUID_RE.test(attractionId)) {
        trackAnalyticsEvent({ eventName: "attraction_viewed", attractionId })
      }
      return
    }

    const checkoutMatch = pathname.match(/^\/checkout\/([0-9a-f-]{36})$/i)
    if (checkoutMatch && UUID_RE.test(checkoutMatch[1])) {
      trackAnalyticsEvent({
        eventName: "checkout_started",
        ticketingSessionId: checkoutMatch[1],
      })
    }
  }, [pathname])

  return null
}
