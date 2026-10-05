export const POSTHOG_CONSENT_STORAGE_KEY = "eh_posthog_consent"
export const POSTHOG_OPEN_SETTINGS_EVENT = "enjoyhub:open-cookie-settings"

export type AnalyticsConsent = "accepted" | "rejected"

type PostHogBrowser = {
  capture?: (eventName: string, properties?: Record<string, unknown>) => void
  opt_in_capturing?: () => void
  opt_out_capturing?: () => void
  startSessionRecording?: () => void
  stopSessionRecording?: () => void
}

declare global {
  interface Window {
    posthog?: PostHogBrowser
  }
}

export function getPostHog() {
  if (typeof window === "undefined") return null
  return window.posthog ?? null
}

export function hasAnalyticsConsent() {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(POSTHOG_CONSENT_STORAGE_KEY) === "accepted"
}

export function capturePostHogEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return
  getPostHog()?.capture?.(eventName, properties)
}
