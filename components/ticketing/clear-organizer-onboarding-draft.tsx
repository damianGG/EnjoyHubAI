"use client"

import { useEffect } from "react"

export function ClearOrganizerOnboardingDraft({ userId }: { userId: string }) {
  useEffect(() => {
    window.localStorage.removeItem(`enjoyhub.organizer-onboarding.v1.${userId}`)
    window.localStorage.removeItem(`enjoyhub.organizer-onboarding-lite.v1.${userId}`)
    window.localStorage.removeItem(`enjoyhub.organizer-onboarding-lite.v2.${userId}`)
  }, [userId])

  return null
}
