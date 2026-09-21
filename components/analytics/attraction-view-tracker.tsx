"use client"

import { useEffect } from "react"

import { trackAnalyticsEvent } from "@/lib/analytics/client"

export function AttractionViewTracker({ attractionId }: { attractionId: string }) {
  useEffect(() => {
    if (!attractionId) return
    trackAnalyticsEvent({
      eventName: "attraction_viewed",
      attractionId,
    })
  }, [attractionId])

  return null
}
